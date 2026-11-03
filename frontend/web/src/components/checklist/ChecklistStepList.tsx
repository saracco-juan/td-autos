import { useCallback, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { stepPanelId, stepTabId } from './ids'
import { checklistSurface } from './checklistSurface'
import styles from './ChecklistStepList.module.css'
import type { ChecklistStep } from '@shared/checklist/types'

export type ListOrientation = 'vertical' | 'horizontal'

type Props = {
  // Prefix of the tab and panel ids; one per checklist on the page.
  idPrefix: string
  steps: ChecklistStep[]
  completedCodes: ReadonlySet<string>
  selected: number
  orientation: ListOrientation
  // Flagged items still pending per step number; only filled while the warning is open.
  pendingFlagged: ReadonlyMap<number, number>
  // Accessible text of the marker, given the count of flagged items pending in the step.
  pendingLabel: (count: number) => string
  onSelect: (numero: number) => void
}

const KEYS: Record<ListOrientation, { previous: string; next: string }> = {
  vertical: { previous: 'ArrowUp', next: 'ArrowDown' },
  horizontal: { previous: 'ArrowLeft', next: 'ArrowRight' },
}

// The steps as tabs: arrows move and select, Home and End jump to the ends, only the selected tab is in the tab order.
export default function ChecklistStepList({
  idPrefix,
  steps,
  completedCodes,
  selected,
  orientation,
  pendingFlagged,
  pendingLabel,
  onSelect,
}: Props) {
  const tabs = useRef(new Map<number, HTMLButtonElement>())
  const motion = useRef<Animation | null>(null)
  const surfaceMotion = useRef<ReturnType<typeof checklistSurface>>(null)

  const cancelMotion = useCallback(() => {
    motion.current?.cancel()
    motion.current = null
    surfaceMotion.current?.animation.cancel()
    surfaceMotion.current?.surface.remove()
    surfaceMotion.current = null
  }, [])
  useLayoutEffect(() => cancelMotion, [selected, cancelMotion])

  const select = (numero: number, animate = false) => {
    const panel = document.getElementById(stepPanelId(idPrefix, selected))
    const current = panel ? getComputedStyle(panel) : null
    const from = { opacity: current?.opacity ?? '1' }
    const interruptedBounds = surfaceMotion.current?.surface.getBoundingClientRect()
    cancelMotion()

    if (numero === selected) return
    if (!animate || !panel?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onSelect(numero)
      return
    }

    const previousTab = tabs.current.get(selected)
    if (previousTab) surfaceMotion.current = checklistSurface(panel, previousTab, false, interruptedBounds)
    const exit = panel.animate([from, { opacity: 0 }], { duration: 260, easing: 'ease', fill: 'forwards' })
    motion.current = exit
    exit.onfinish = () => {
      // Commit only the latest requested tab, then reveal its real content without scaling text.
      if (motion.current !== exit) return
      flushSync(() => onSelect(numero))
      exit.cancel()
      const next = document.getElementById(stepPanelId(idPrefix, numero))
      const nextTab = tabs.current.get(numero)
      if (next && nextTab) surfaceMotion.current = checklistSurface(next, nextTab, true)
      const surface = surfaceMotion.current
      motion.current = next?.animate([
        { opacity: 0, transform: 'translateX(-8px)', clipPath: 'inset(0 100% 0 0)' },
        { opacity: 1, transform: 'none', clipPath: 'inset(0 0% 0 0)' },
      ], { duration: 550, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'backwards' }) ?? null
      if (surface) {
        surface.animation.onfinish = () => {
          if (surfaceMotion.current !== surface) return
          const transform = getComputedStyle(surface.surface).transform
          surface.animation.cancel()
          surface.animation = surface.surface.animate([
            { transform, opacity: 1 },
            { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0 },
          ], {
            duration: 350, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards',
          })
          surface.animation.onfinish = () => {
            surface.surface.remove()
            if (surfaceMotion.current === surface) surfaceMotion.current = null
          }
        }
      }
    }
  }

  const move = (numero: number) => {
    select(numero)
    // The page must not jump when the focus moves.
    tabs.current.get(numero)?.focus({ preventScroll: true })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Tab can move focus into the panel before its pointer animation has finished.
    cancelMotion()
    const index = steps.findIndex((step) => step.numero === selected)
    const keys = KEYS[orientation]
    let target: number | undefined
    if (event.key === keys.next) target = (index + 1) % steps.length
    else if (event.key === keys.previous) target = (index - 1 + steps.length) % steps.length
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = steps.length - 1
    if (target === undefined) return
    event.preventDefault()
    move(steps[target].numero)
  }

  return (
    <div role="tablist" aria-orientation={orientation} className={styles.list} onKeyDown={handleKeyDown}>
      {steps.map((step) => {
        const isSelected = step.numero === selected
        const done = step.items.filter((item) => completedCodes.has(item.codigo)).length
        const flagged = pendingFlagged.get(step.numero) ?? 0
        return (
          <button
            key={step.numero}
            ref={(element) => {
              if (element) tabs.current.set(step.numero, element)
              else tabs.current.delete(step.numero)
            }}
            type="button"
            role="tab"
            id={stepTabId(idPrefix, step.numero)}
            aria-selected={isSelected}
            aria-controls={stepPanelId(idPrefix, step.numero)}
            tabIndex={isSelected ? 0 : -1}
            className={`${styles.tab} ${isSelected ? styles.selected : ''}`}
            onClick={(event) => select(step.numero, event.detail > 0)}
          >
            <span className={styles.title}>
              {step.numero}. {step.titulo}
            </span>
            {flagged > 0 ? (
              <>
                <span aria-hidden="true" className={styles.marker} />
                <span className={styles.visuallyHidden}>{pendingLabel(flagged)}</span>
              </>
            ) : null}
            <span className={styles.progress}>
              {done} de {step.items.length}
            </span>
          </button>
        )
      })}
    </div>
  )
}
