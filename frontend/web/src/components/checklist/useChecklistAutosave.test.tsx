import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { STEPS } from '@shared/checklist/fixtures'
import { withCode } from '@shared/checklist/autosave'
import { useChecklistAutosave } from './useChecklistAutosave'

// A promise the test settles by hand, to hold a request in flight.
function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(save: (code: string, value: boolean) => Promise<unknown>, onSaveFailed = vi.fn()) {
  const view = renderHook(() => useChecklistAutosave({ steps: STEPS, save, onSaveFailed }))
  return { ...view, onSaveFailed }
}

describe('withCode', () => {
  it('adds a code once and removes it when unticked', () => {
    expect(withCode(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(withCode(['a', 'b'], 'b', true)).toEqual(['a', 'b'])
    expect(withCode(['a', 'b'], 'a', false)).toEqual(['b'])
  })
})

describe('useChecklistAutosave', () => {
  it('starts with nothing ticked and shows the codes it was loaded with', () => {
    const { result } = setup(vi.fn().mockResolvedValue(undefined))
    expect(result.current.completed).toEqual([])

    act(() => result.current.load(['papeles_vtv']))

    expect(result.current.completed).toEqual(['papeles_vtv'])
  })

  it('ticks at once and sends the value of the item', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = setup(save)

    await act(async () => result.current.toggle('papeles_vtv', true))

    expect(result.current.completed).toEqual(['papeles_vtv'])
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('papeles_vtv', true)
  })

  it('keeps one request in flight per item and sends the newer value after the first settles', async () => {
    const first = deferred()
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const { result } = setup(save)

    act(() => {
      result.current.toggle('papeles_vtv', true)
      result.current.toggle('papeles_vtv', false)
    })

    expect(save).toHaveBeenCalledTimes(1)
    await act(async () => first.resolve())
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('papeles_vtv', false)
    expect(result.current.completed).toEqual([])
  })

  it('sends nothing more when the item ends where the request in flight is going', async () => {
    const first = deferred()
    const save = vi.fn().mockReturnValueOnce(first.promise)
    const { result } = setup(save)

    act(() => {
      result.current.toggle('papeles_vtv', true)
      result.current.toggle('papeles_vtv', false)
      result.current.toggle('papeles_vtv', true)
    })
    await act(async () => first.resolve())

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('reverts the item, marks its step as failed and reports it when the save fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('boom'))
    const { result, onSaveFailed } = setup(save)

    await act(async () => result.current.toggle('exterior_luces', true))

    expect(result.current.completed).toEqual([])
    expect([...result.current.failedSteps]).toEqual([2])
    expect(onSaveFailed).toHaveBeenCalledWith(2)
  })

  it('reverts to the last value the server confirmed', async () => {
    const save = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = setup(save)
    act(() => result.current.load(['papeles_vtv']))

    await act(async () => result.current.toggle('papeles_vtv', false))

    expect(result.current.completed).toEqual(['papeles_vtv'])
  })

  it('clears the failed step on the next successful save in it', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const { result } = setup(save)
    await act(async () => result.current.toggle('exterior_luces', true))
    expect(result.current.failedSteps.has(2)).toBe(true)

    await act(async () => result.current.toggle('exterior_luces', true))

    expect(result.current.failedSteps.size).toBe(0)
    expect(result.current.completed).toEqual(['exterior_luces'])
  })

  it('sends the newer value when the request in flight fails, with no revert or failure', async () => {
    const first = deferred()
    const second = deferred()
    const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, onSaveFailed } = setup(save)
    act(() => result.current.load(['papeles_vtv']))
    act(() => {
      result.current.toggle('papeles_vtv', false)
      result.current.toggle('papeles_vtv', true)
    })

    await act(async () => first.reject(new Error('boom')))

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('papeles_vtv', true)
    expect(result.current.completed).toEqual(['papeles_vtv'])
    expect(onSaveFailed).not.toHaveBeenCalled()
    await act(async () => second.resolve())
    expect(result.current.failedSteps.size).toBe(0)
  })

  it('settle waits for the saves in flight and reports true when none failed', async () => {
    const saving = deferred()
    const { result } = setup(vi.fn().mockReturnValue(saving.promise))
    act(() => result.current.toggle('papeles_vtv', true))

    let done: boolean | undefined
    const settled = result.current.settle().then((ok) => (done = ok))
    await Promise.resolve()
    expect(done).toBeUndefined()
    await act(async () => saving.resolve())
    await settled

    expect(done).toBe(true)
  })

  it('settle reports false when a save failed while it waited', async () => {
    const saving = deferred()
    const { result } = setup(vi.fn().mockReturnValue(saving.promise))
    act(() => result.current.toggle('papeles_vtv', true))

    const settled = result.current.settle()
    await act(async () => saving.reject(new Error('boom')))

    await expect(settled).resolves.toBe(false)
  })

  it('settle resolves true at once when nothing is saving', async () => {
    const { result } = setup(vi.fn())

    await expect(result.current.settle()).resolves.toBe(true)
  })
})
