import { useEffect, useId, useRef, type RefObject } from 'react'
import styles from './Scrollbar.module.css'

/** A native range keeps dragging and keyboard input while giving both scrollers the same thumb. */
export default function Scrollbar({ containerRef, contentKey, label }: Readonly<{
  containerRef?: RefObject<HTMLElement | null>
  contentKey?: string
  label: string
}>) {
  const control = useRef<HTMLInputElement>(null)
  const target = useRef<HTMLElement | null>(null)
  const id = useId()

  useEffect(() => {
    const element = containerRef
      ? containerRef.current?.querySelector<HTMLElement>('[role="tabpanel"]')
      : document.documentElement
    const input = control.current
    if (!element || !input) return
    target.current = element
    const originalId = element.id
    if (!element.id) element.id = id
    input.setAttribute('aria-controls', element.id)
    element.classList.add(styles.nativeHidden)
    const header = containerRef ? null : document.querySelector('header:not(main header)')
    const footer = containerRef ? null : document.querySelector('footer:not(main footer)')
    const update = () => {
      const height = containerRef ? element.clientHeight : window.innerHeight
      const maximum = Math.max(0, element.scrollHeight - height)
      input.hidden = maximum <= 0
      input.max = String(maximum)
      input.value = String(element.scrollTop)
      input.setAttribute('aria-valuemax', String(maximum))
      input.setAttribute('aria-valuenow', String(Math.round(element.scrollTop)))
      if (containerRef) input.style.height = `${height}px`
      else {
        const top = Math.max(0, Math.min(height, header?.getBoundingClientRect().bottom ?? 0))
        const bottom = Math.min(height, footer?.getBoundingClientRect().top ?? height)
        input.style.top = `${top}px`
        input.style.height = `${Math.max(0, bottom - top)}px`
        input.hidden = maximum <= 0 || bottom - top < 48
      }
    }
    update()
    const scrollSource = containerRef ? element : window
    scrollSource.addEventListener('scroll', update, { passive: true })
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      event.preventDefault()
      let unit = 1
      if (event.deltaMode === 1) unit = 16
      else if (event.deltaMode === 2) unit = element.clientHeight
      element.scrollTop += event.deltaY * unit
    }
    if (containerRef) input.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(element)
    observer?.observe(containerRef ? element.firstElementChild ?? element : document.body)
    if (header) observer?.observe(header)
    if (footer) observer?.observe(footer)
    return () => {
      element.classList.remove(styles.nativeHidden)
      if (!originalId) element.removeAttribute('id')
      scrollSource.removeEventListener('scroll', update)
      input.removeEventListener('wheel', wheel)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [containerRef, contentKey, id])

  return <input ref={control} type="range" role="scrollbar" min="0" defaultValue="0" step="1"
    aria-label={label} aria-orientation="vertical" aria-valuemin={0} aria-valuenow={0} aria-controls={id}
    className={`${styles.control} ${containerRef ? styles.panel : styles.page}`}
    onChange={(event) => {
      if (target.current) target.current.scrollTop = Number(event.currentTarget.value)
    }} />
}
