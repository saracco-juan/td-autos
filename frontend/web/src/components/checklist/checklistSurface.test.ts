import { afterEach, expect, it, vi } from 'vitest'
import { checklistSurface } from './checklistSurface'

const originalAnimate = HTMLElement.prototype.animate
afterEach(() => {
  HTMLElement.prototype.animate = originalAnimate
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

it('expands an empty surface from the clicked tab bounds without transforming panel content', () => {
  const host = document.createElement('div')
  host.setAttribute('data-checklist-columns', '')
  const tab = document.createElement('button')
  const panel = document.createElement('div')
  panel.textContent = 'Checklist content'
  host.append(tab, panel)
  document.body.append(host)
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 1000, 600))
  vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue(new DOMRect(110, 300, 300, 56))
  vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(500, 200, 600, 600))
  const animate = vi.fn<HTMLElement['animate']>(() => ({ cancel: vi.fn() }) as unknown as Animation)
  HTMLElement.prototype.animate = animate

  const opening = checklistSurface(panel, tab, true)!
  expect(opening.surface).toHaveAttribute('aria-hidden', 'true')
  expect(opening.surface).toBeEmptyDOMElement()
  expect(opening.surface.style.left).toBe('400px')
  expect(opening.surface.style.top).toBe('0px')
  expect(animate.mock.calls[0][0]).toEqual([
    { transform: 'translate(-390px, 100px) scale(0.5, 0.09333333333333334)', opacity: 1 },
    { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1 },
  ])
  expect(panel.style.transform).toBe('')
  expect(panel).toHaveTextContent('Checklist content')

  checklistSurface(panel, tab, false)
  expect(animate.mock.calls[1][0]).toEqual([
    { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1 },
    { transform: 'translate(-390px, 100px) scale(0.5, 0.09333333333333334)', opacity: 0 },
  ])
  checklistSurface(panel, tab, false, new DOMRect(300, 250, 450, 300))
  expect(animate.mock.calls[2][0]).toEqual([
    { transform: 'translate(-200px, 50px) scale(0.75, 0.5)', opacity: 1 },
    { transform: 'translate(-390px, 100px) scale(0.5, 0.09333333333333334)', opacity: 0 },
  ])
})
