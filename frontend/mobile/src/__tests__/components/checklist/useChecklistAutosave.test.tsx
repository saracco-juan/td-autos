import { act, renderHook } from '@testing-library/react-native'
import { STEPS } from '@shared/checklist/fixtures'
import type { ChecklistStep } from '@shared/checklist/types'
import { useChecklistAutosave } from '../../../components/checklist/useChecklistAutosave'

// The drain/revert/settle rules live in the shared engine and are covered by the web suite;
// these tests check the React wiring of the mobile hook.

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Props = { steps: ChecklistStep[]; save: (code: string, value: boolean) => Promise<unknown> }

async function setup(save: Props['save'], onSaveFailed = jest.fn()) {
  const view = await renderHook((props: Props) => useChecklistAutosave({ ...props, onSaveFailed }), {
    initialProps: { steps: STEPS, save },
  })
  return { ...view, onSaveFailed }
}

describe('useChecklistAutosave (mobile)', () => {
  it('shows the codes it was loaded with', async () => {
    const { result } = await setup(jest.fn())

    expect(result.current.completed).toEqual([])
    await act(async () => result.current.load(['papeles_vtv']))

    expect(result.current.completed).toEqual(['papeles_vtv'])
  })

  it('ticks at once and saves the item in the background', async () => {
    const saving = deferred()
    const save = jest.fn().mockReturnValue(saving.promise)
    const { result } = await setup(save)

    await act(async () => result.current.toggle('papeles_vtv', true))

    expect(result.current.completed).toEqual(['papeles_vtv'])
    expect(save).toHaveBeenCalledWith('papeles_vtv', true)
    await act(async () => saving.resolve())
    await expect(result.current.settle()).resolves.toBe(true)
  })

  it('reverts the item, marks its step as failed and reports it when the save fails', async () => {
    const save = jest.fn().mockRejectedValue(new Error('boom'))
    const { result, onSaveFailed } = await setup(save)

    await act(async () => result.current.toggle('exterior_luces', true))

    expect(result.current.completed).toEqual([])
    expect([...result.current.failedSteps]).toEqual([2])
    expect(onSaveFailed).toHaveBeenCalledWith(2)
  })

  it('settle reports false when a save failed while it waited', async () => {
    const saving = deferred()
    const { result } = await setup(jest.fn().mockReturnValue(saving.promise))
    await act(async () => result.current.toggle('papeles_vtv', true))

    const settled = result.current.settle()
    await act(async () => saving.reject(new Error('boom')))

    await expect(settled).resolves.toBe(false)
  })

  it('uses the latest save function and steps after a re-render', async () => {
    const first = jest.fn().mockResolvedValue(undefined)
    const second = jest.fn().mockRejectedValue(new Error('boom'))
    const { result, rerender, onSaveFailed } = await setup(first)
    const renamed = STEPS.map((step) => (step.numero === 1 ? { ...step, numero: 9 } : step))

    await rerender({ steps: renamed, save: second })
    await act(async () => result.current.toggle('papeles_vtv', true))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('papeles_vtv', true)
    expect(onSaveFailed).toHaveBeenCalledWith(9)
  })
})
