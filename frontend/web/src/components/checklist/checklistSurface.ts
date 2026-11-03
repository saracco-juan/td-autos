import styles from './ChecklistStepList.module.css'

// Only this empty surface scales. The real heading and controls keep their dimensions.
export function checklistSurface(panel: HTMLElement, tab: HTMLElement, expanding: boolean, interruptedBounds?: DOMRect) {
  const host = panel.closest<HTMLElement>('[data-checklist-columns]')
  if (!host) return null
  const bounds = host.getBoundingClientRect()
  const target = panel.getBoundingClientRect()
  const origin = tab.getBoundingClientRect()
  if (!target.width || !target.height) return null

  const surface = document.createElement('div')
  surface.className = styles.motionSurface
  surface.setAttribute('aria-hidden', 'true')
  Object.assign(surface.style, {
    left: `${target.left - bounds.left}px`,
    top: `${target.top - bounds.top}px`,
    width: `${target.width}px`,
    height: `${target.height}px`,
  })
  host.append(surface)

  const atTab = {
    transform: `translate(${origin.left - target.left}px, ${origin.top - target.top}px) scale(${origin.width / target.width}, ${origin.height / target.height})`,
    opacity: expanding ? 1 : 0,
  }
  const atPanel = {
    transform: interruptedBounds
      ? `translate(${interruptedBounds.left - target.left}px, ${interruptedBounds.top - target.top}px) scale(${interruptedBounds.width / target.width}, ${interruptedBounds.height / target.height})`
      : 'translate(0px, 0px) scale(1, 1)',
    opacity: 1,
  }
  const animation = surface.animate(expanding ? [atTab, atPanel] : [atPanel, atTab], {
    duration: expanding ? 320 : 160,
    easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
    fill: 'forwards',
  })
  return { surface, animation }
}
