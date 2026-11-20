export type FeedbackProps = Readonly<{
  message?: string | null
  variant?: 'success' | 'error'
  onRetry?: () => void
}>
export const feedbackMotion = { duration: 250, easing: [0.23, 1, 0.32, 1] as const }

// Pausing preserves reading time; disposing prevents an old message dismissing its replacement.
export function feedbackTimer(dismiss: () => void) {
  let remaining = 4000
  let started = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const pause = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    remaining = Math.max(0, remaining - (Date.now() - started))
  }
  const resume = () => {
    if (timer !== undefined) return
    started = Date.now()
    timer = setTimeout(dismiss, remaining)
  }
  return { pause, resume, reset: () => { pause(); remaining = 4000 } }
}
