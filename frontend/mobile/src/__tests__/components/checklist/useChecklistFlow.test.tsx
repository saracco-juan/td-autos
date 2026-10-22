import { AccessibilityInfo } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'
import { STEPS } from '@shared/checklist/fixtures'
import { useChecklistFlow } from '../../../components/checklist/useChecklistFlow'

// The autosave rules are covered by useChecklistAutosave.test; these tests check the flow around it:
// the finish rules, the pending-items warning and the checklist/summary view.

const FLAGGED = STEPS.flatMap((step) => step.items).filter((item) => item.flagged)

async function setup(finish = jest.fn().mockResolvedValue(undefined)) {
  const save = jest.fn().mockResolvedValue(undefined)
  const view = await renderHook(() =>
    useChecklistFlow({ steps: STEPS, save, finish, warningFor: (count) => `pending ${count}` }),
  )
  await act(async () => view.result.current.load([]))
  return { ...view, finish, save }
}

describe('useChecklistFlow', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('starts on the first step, in the checklist view, without a warning', async () => {
    const { result } = await setup()

    expect(result.current.selected).toBe(1)
    expect(result.current.view).toBe('checklist')
    expect(result.current.warningText).toBeNull()
  })

  it('opens the warning instead of finishing while flagged items are pending, and announces it', async () => {
    const { result, finish } = await setup()
    expect(FLAGGED.length).toBeGreaterThan(0)

    await act(async () => result.current.requestFinish())

    expect(finish).not.toHaveBeenCalled()
    expect(result.current.showWarning).toBe(true)
    expect(result.current.warningText).toBe(`pending ${FLAGGED.length}`)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(`pending ${FLAGGED.length}`)
  })

  it('closes the warning when keeping working', async () => {
    const { result } = await setup()
    await act(async () => result.current.requestFinish())

    await act(async () => result.current.keepWorking())

    expect(result.current.showWarning).toBe(false)
  })

  it('closes the warning once the last flagged item is ticked', async () => {
    const { result } = await setup()
    await act(async () => result.current.requestFinish())

    for (const item of FLAGGED) await act(async () => result.current.handleToggle(item.codigo, true))

    expect(result.current.showWarning).toBe(false)
  })

  it('finishes anyway with the warning open and moves to the summary', async () => {
    const { result, finish } = await setup()
    await act(async () => result.current.requestFinish())

    await act(async () => result.current.finishAnyway())

    expect(finish).toHaveBeenCalledTimes(1)
    expect(result.current.view).toBe('summary')
    expect(result.current.showWarning).toBe(false)
    expect(result.current.finishing).toBe(false)
  })

  it('finishes at once when no flagged item is pending', async () => {
    const { result, finish } = await setup()
    for (const item of FLAGGED) await act(async () => result.current.handleToggle(item.codigo, true))

    await act(async () => result.current.requestFinish())

    expect(finish).toHaveBeenCalledTimes(1)
    expect(result.current.view).toBe('summary')
  })

  it('stays on the checklist and flags the failure when finishing fails', async () => {
    const { result } = await setup(jest.fn().mockRejectedValue(new Error('down')))

    await act(async () => result.current.finishAnyway())

    expect(result.current.view).toBe('checklist')
    expect(result.current.finishFailed).toBe(true)
    expect(result.current.finishing).toBe(false)
  })

  it('shows the step whose save failed and does not finish', async () => {
    let fail!: () => void
    const save = jest.fn().mockReturnValue(
      new Promise<void>((_, reject) => {
        fail = () => reject(new Error('down'))
      }),
    )
    const finish = jest.fn().mockResolvedValue(undefined)
    const { result } = await renderHook(() => useChecklistFlow({ steps: STEPS, save, finish, warningFor: String }))
    await act(async () => result.current.load([]))
    await act(async () => result.current.setSelected(STEPS[STEPS.length - 1].numero))
    await act(async () => result.current.handleToggle(STEPS[0].items[0].codigo, true))

    // The save fails while the finish waits for it.
    await act(async () => {
      const finishing = result.current.finishAnyway()
      fail()
      await finishing
    })

    expect(result.current.selected).toBe(STEPS[0].numero)
    expect(finish).not.toHaveBeenCalled()
    expect(result.current.view).toBe('checklist')
  })
})
