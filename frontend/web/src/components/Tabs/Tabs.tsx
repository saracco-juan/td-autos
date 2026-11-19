import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Tabs.module.css'

type TabItem = { id: string; label: string }
type TabsProps = {
  label: string
  items: readonly TabItem[]
  children: (id: string) => ReactNode
  className?: string
  panelClassName?: string
  /** 'underline': compact text tabs on a hairline, left aligned; the default keeps the boxed look. */
  variant?: 'underline'
  /** Shown at the right end of the tabs row (for example an info button), outside the tablist. */
  trailing?: ReactNode
} & ({ value: string; onValueChange: (value: string) => void } | {
  value?: never
  onValueChange?: never
})

/** Automatically activates tabs on arrow navigation, matching the vehicle-detail pattern. */
export default function Tabs({ label, items, children, value, onValueChange, className = '', panelClassName = '', variant, trailing }: TabsProps) {
  const id = useId()
  const [selected, setSelected] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const tablist = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const pointerSelection = useRef(false)
  const lastIndicatorPosition = useRef('')
  const active = value === undefined ? (selected < items.length ? selected : 0)
    : Math.max(0, items.findIndex((item) => item.id === value))

  useLayoutEffect(() => {
    const list = tablist.current
    const line = indicator.current
    const button = buttons.current[active]
    if (variant !== 'underline' || !list || !line || !button) return

    const position = (animate: boolean) => {
      const left = button.offsetLeft
      const bottom = button.offsetTop + button.offsetHeight
      const clip = `inset(${bottom - 2}px ${Math.max(0, list.clientWidth - left - button.offsetWidth)}px ${Math.max(0, list.clientHeight + 1 - bottom)}px ${left}px)`
      if (lastIndicatorPosition.current === clip && line.style.visibility === 'visible') return
      lastIndicatorPosition.current = clip
      line.dataset.animate = String(animate)
      line.style.clipPath = clip
      line.style.visibility = 'visible'
    }
    position(pointerSelection.current)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => position(false))
    observer.observe(list)
    buttons.current.forEach((tab) => { if (tab) observer.observe(tab) })
    return () => observer.disconnect()
  }, [active, items, variant])
  if (!items[active]) return null

  function select(index: number) {
    if (value === undefined) setSelected(index)
    onValueChange?.(items[index].id)
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = { ArrowRight: (index + 1) % items.length,
      ArrowLeft: (index + items.length - 1) % items.length,
      Home: 0, End: items.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    pointerSelection.current = false
    select(next)
    buttons.current[next]?.focus()
  }

  return <div className={`${styles.root} ${className}`}>
    <div className={styles.row} data-variant={variant}>
      <div ref={tablist} className={styles.tabs} role="tablist" aria-label={label} data-variant={variant}>
      {items.map((item, index) => <button key={item.id} type="button" role="tab"
        id={`${id}-tab-${index}`} aria-controls={`${id}-panel`} aria-selected={active === index}
        tabIndex={active === index ? 0 : -1} className={styles.tab}
        ref={(element) => { buttons.current[index] = element }}
        onClick={(event) => { pointerSelection.current = event.detail > 0; select(index) }} onKeyDown={(event) => navigate(event, index)}>
        {item.label}
      </button>)}
      {variant === 'underline' ? <span ref={indicator} className={styles.indicator} aria-hidden="true" /> : null}
      </div>
      {trailing}
    </div>
    <div className={`${styles.panel} ${panelClassName}`} role="tabpanel" id={`${id}-panel`}
      aria-labelledby={`${id}-tab-${active}`} tabIndex={0}>
      {children(items[active].id)}
    </div>
  </div>
}
