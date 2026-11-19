import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useDealerRegistrationStep from '../../../../features/auth/dealer/hooks/useDealerRegistrationStep'

function Harness() {
  const { step, changing, containerRef, goToStep } = useDealerRegistrationStep()
  return <div ref={containerRef}>
    <output>{step}</output>
    <button disabled={changing} onClick={() => void goToStep(step + 1)}>Next</button>
    <button disabled={changing} onClick={() => void goToStep(step - 1)}>Back</button>
    <button onClick={() => void goToStep(step + 1, true)}>Keyboard next</button>
  </div>
}

afterEach(() => vi.unstubAllGlobals())

describe('Dealer step motion', () => {
  function motion() {
    const pending: Array<() => void> = []
    const cancel = vi.fn()
    const animate = vi.fn<(frames: Keyframe[], options: KeyframeAnimationOptions) => { finished: Promise<void>; cancel: typeof cancel }>(() => ({
      finished: new Promise<void>((resolve) => pending.push(resolve)), cancel,
    }))
    const original = HTMLElement.prototype.animate
    HTMLElement.prototype.animate = animate as unknown as typeof original
    return { animate, pending, cancel, restore: () => { HTMLElement.prototype.animate = original } }
  }

  it('finishes the old card before changing steps and reverses the return direction', async () => {
    const animation = motion()
    try {
      render(<Harness />)
      fireEvent.click(screen.getByText('Next'))
      expect(screen.getByRole('status')).toHaveTextContent('0')
      expect(screen.getByText('Next')).toBeDisabled()
      await act(async () => animation.pending[0]())
      expect(screen.getByRole('status')).toHaveTextContent('1')
      expect(animation.animate.mock.calls[1]).toEqual([
        [{ transform: 'translateX(100%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
        expect.objectContaining({ duration: 250 }),
      ])
      await act(async () => animation.pending[1]())
      fireEvent.click(screen.getByText('Back'))
      await act(async () => animation.pending[2]())
      expect(animation.animate.mock.calls[3][0]).toEqual([
        { transform: 'translateX(-100%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 },
      ])
      await act(async () => animation.pending[3]())
      expect(screen.getByText('Next')).toBeEnabled()
    } finally { animation.restore() }
  })

  it('skips motion for keyboard navigation and cancels pending animation on unmount', async () => {
    const animation = motion()
    try {
      const view = render(<Harness />)
      fireEvent.click(screen.getByText('Keyboard next'))
      expect(screen.getByRole('status')).toHaveTextContent('1')
      expect(animation.animate).not.toHaveBeenCalled()
      fireEvent.click(screen.getByText('Next'))
      view.unmount()
      expect(animation.cancel).toHaveBeenCalledOnce()
      await act(async () => animation.pending[0]())
      expect(animation.animate).toHaveBeenCalledOnce()
    } finally { animation.restore() }
  })
})
