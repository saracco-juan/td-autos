import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import Button from '../Buttons/Button'
import styles from './Dialog.module.css'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  busy?: boolean
  animate?: boolean
}

// Native top-layer modality supplies focus containment, inert background and focus restoration.
export default function Dialog({ open, title, onClose, children, busy = false, animate = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.scrollTop = 0
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (open && busy) titleRef.current?.focus()
  }, [open, busy])

  const keepFocusInside = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    // Traverse in document order so sequential focus follows the visible form.
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('*')).filter((element) =>
      element.matches('button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')
      && !element.hidden && getComputedStyle(element).display !== 'none',
    )
    const first = controls[0]
    const last = controls.at(-1)
    if (!first) {
      event.preventDefault()
      titleRef.current?.focus()
    } else if (!controls.includes(document.activeElement as HTMLElement)) {
      // Validation messages and the title can receive programmatic focus.
      event.preventDefault()
      const target = event.shiftKey ? last : first
      target?.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  return (
    <dialog ref={ref} aria-labelledby={titleId} className={styles.dialog} data-motion={animate ? 'full' : 'none'} onKeyDown={keepFocusInside}
      onClose={onClose} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>{title}</h2>
          <Button type="button" onClick={onClose} disabled={busy} className={styles.close}>CERRAR</Button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
