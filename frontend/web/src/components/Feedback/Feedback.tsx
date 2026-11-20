import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { feedbackTimer, feedbackMotion, type FeedbackProps } from '@shared/feedback/feedback'
import styles from './Feedback.module.css'

type Props = FeedbackProps & { focusOnShow?: boolean }
export default function Feedback(props: Props) {
  return props.message ? <Notification {...props} /> : null
}
function Notification({ message, variant = 'success', onRetry, focusOnShow = false }: Props) {
  const [closing, setClosing] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [previous, setPrevious] = useState({ message, variant })
  if (previous.message !== message || previous.variant !== variant) {
    setPrevious({ message, variant })
    setClosing(false)
    setHidden(false)
  }
  const node = useRef<HTMLDivElement>(null)
  useEffect(() => { if (focusOnShow) node.current?.focus() }, [focusOnShow])
  const hovered = useRef(false)
  const [clock] = useState(() => feedbackTimer(() => setClosing(true)))
  const sync = () => {
    if (variant === 'error' || document.hidden || hovered.current || node.current?.contains(document.activeElement)) clock.pause()
    else clock.resume()
  }
  useEffect(() => {
    clock.reset()
    const visibility = () => {
      if (document.hidden) clock.pause()
      else if (variant === 'success' && !hovered.current && !node.current?.contains(document.activeElement)) clock.resume()
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => { clock.pause(); document.removeEventListener('visibilitychange', visibility) }
  }, [clock, variant, message])
  useEffect(() => {
    if (!closing) return
    clock.pause()
    const timeout = setTimeout(() => setHidden(true), feedbackMotion.duration)
    return () => clearTimeout(timeout)
  }, [closing, clock])
  if (hidden) return null
  return createPortal(
    <div ref={node} tabIndex={-1} role={variant === 'error' ? 'alert' : 'status'} aria-atomic="true"
      className={`${styles.toast} ${styles[variant]} ${closing ? styles.closing : ''}`}
      onMouseEnter={() => { hovered.current = true; sync() }} onMouseLeave={() => { hovered.current = false; sync() }}
      onFocus={sync} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !hovered.current && !document.hidden && variant === 'success') clock.resume() }}>
      <span className={styles.icon} aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {variant === 'success' ? <path d="m5 12 4 4L19 6" /> : <path d="m7 7 10 10M17 7 7 17" />}
      </svg></span>
      <div className={styles.content}>{message}{variant === 'error' && onRetry ? <button type="button" onClick={onRetry}>REINTENTAR</button> : null}</div>
      <button type="button" className={styles.close} aria-label="Cerrar notificación" onClick={() => setClosing(true)}>×</button>
    </div>, document.body,
  )
}
