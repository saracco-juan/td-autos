import styles from './ChecklistStepList.module.css'

// Extend only the tab's black background; never cover or scale the content panel.
export function checklistSurface(panel: HTMLElement, tab: HTMLElement, expanding: boolean, interruptedBounds?: DOMRect) {
  const host = panel.closest<HTMLElement>('[data-checklist-columns]')
  if (!host) return null
  const bounds = host.getBoundingClientRect()
  const origin = tab.getBoundingClientRect()
  if (!origin.width || !origin.height) return null

  const surface = document.createElement('div')
  surface.className = styles.motionSurface
  surface.setAttribute('aria-hidden', 'true')
  Object.assign(surface.style, {
    left: `${origin.left - bounds.left}px`,
    top: `${origin.top - bounds.top}px`,
    width: `${origin.width}px`,
    height: `${origin.height}px`,
  })
  host.append(surface)

  const atTab = {
    transform: 'translate(0px, 0px) scale(1, 1)',
    opacity: expanding ? 1 : 0,
  }
  const extended = {
    transform: interruptedBounds
      ? `translate(${interruptedBounds.left - origin.left}px, ${interruptedBounds.top - origin.top}px) scale(${interruptedBounds.width / origin.width}, ${interruptedBounds.height / origin.height})`
      : `translate(0px, -2px) scale(${(origin.width + 24) / origin.width}, ${(origin.height + 4) / origin.height})`,
    opacity: 1,
  }
  const animation = surface.animate(expanding ? [atTab, extended] : [extended, atTab], {
    duration: expanding ? 550 : 260,
    easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
    fill: 'forwards',
  })
  return { surface, animation }
}
