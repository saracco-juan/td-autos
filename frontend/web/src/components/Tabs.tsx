import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
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
  const active = value === undefined ? (selected < items.length ? selected : 0)
    : Math.max(0, items.findIndex((item) => item.id === value))
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
    select(next)
    buttons.current[next]?.focus()
  }

  return <div className={`${styles.root} ${className}`}>
    <div className={styles.row} data-variant={variant}>
      <div className={styles.tabs} role="tablist" aria-label={label} data-variant={variant}>
      {items.map((item, index) => <button key={item.id} type="button" role="tab"
        id={`${id}-tab-${index}`} aria-controls={`${id}-panel`} aria-selected={active === index}
        tabIndex={active === index ? 0 : -1} className={styles.tab}
        ref={(element) => { buttons.current[index] = element }}
        onClick={() => select(index)} onKeyDown={(event) => navigate(event, index)}>
        {item.label}
      </button>)}
      </div>
      {trailing}
    </div>
    <div className={`${styles.panel} ${panelClassName}`} role="tabpanel" id={`${id}-panel`}
      aria-labelledby={`${id}-tab-${active}`} tabIndex={0}>
      {children(items[active].id)}
    </div>
  </div>
}
