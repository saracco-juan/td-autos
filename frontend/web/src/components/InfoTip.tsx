import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './InfoTip.module.css'

type InfoTipProps = {
  /** Accessible name of the button, for example "Cómo calculamos Seguro". */
  label: string
  /** The explanation shown in the tooltip. */
  children: ReactNode
}

const MARGIN = 8
const GAP = 6

// Small round "i" button with a tooltip. It opens on hover, on keyboard focus and on click or tap (touch has no hover);
// Escape, a click outside, a second click and leaving with the keyboard close it. The tooltip is fixed and clamped, so it never leaves the viewport.
export default function InfoTip({ label, children }: InfoTipProps) {
  const id = useId()
  const wrapper = useRef<HTMLSpanElement>(null)
  const tooltip = useRef<HTMLSpanElement>(null)
  const pinned = useRef(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})

  const close = useCallback(() => {
    pinned.current = false
    setOpen(false)
  }, [])

  const place = useCallback(() => {
    const anchor = wrapper.current?.getBoundingClientRect()
    const box = tooltip.current?.getBoundingClientRect()
    if (!anchor || !box) return
    const left = Math.min(Math.max(MARGIN, anchor.left + anchor.width / 2 - box.width / 2), window.innerWidth - box.width - MARGIN)
    const below = anchor.bottom + GAP
    const top = below + box.height + MARGIN > window.innerHeight && anchor.top - GAP - box.height >= MARGIN
      ? anchor.top - GAP - box.height
      : below
    setPosition({ left: Math.max(MARGIN, left), top })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onPointer = (event: Event) => {
      if (!wrapper.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, close, place])

  const toggle = () => {
    if (pinned.current) close()
    else {
      pinned.current = true
      setOpen(true)
    }
  }

  return (
    <span
      ref={wrapper}
      className={styles.wrapper}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned.current) setOpen(false) }}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={toggle}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span ref={tooltip} id={id} role="tooltip" hidden={!open} className={styles.tooltip} style={position}>
        {children}
      </span>
    </span>
  )
}
