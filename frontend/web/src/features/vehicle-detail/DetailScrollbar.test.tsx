import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import DetailScrollbar from './DetailScrollbar'

it('keeps the page track between the header and visible footer without shortening the scroll range', () => {
  const header = document.createElement('header')
  const footer = document.createElement('footer')
  document.body.append(header, footer)
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({ bottom: 60 } as DOMRect)
  vi.spyOn(footer, 'getBoundingClientRect').mockReturnValue({ top: 700 } as DOMRect)
  const height = vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(1800)
  const { unmount } = render(<DetailScrollbar label="Scroll page" />)
  const control = screen.getByRole('scrollbar')
  expect(control).toHaveStyle({ top: '60px', height: '640px' })
  expect(control).toHaveAttribute('max', String(1800 - window.innerHeight))
  unmount()
  header.remove()
  footer.remove()
  height.mockRestore()
})

it('maps both ends to the complete scroll range and follows native scrolling', () => {
  const container = document.createElement('section')
  const panel = document.createElement('div')
  panel.setAttribute('role', 'tabpanel')
  panel.id = 'specifications-test'
  Object.defineProperties(panel, { clientHeight: { value: 440 }, scrollHeight: { value: 1006 } })
  container.append(panel)
  const ref = createRef<HTMLElement>()
  ref.current = container
  const { unmount } = render(<DetailScrollbar containerRef={ref} label="Scroll specifications" />)
  const control = screen.getByRole('scrollbar')
  expect(control).toHaveAttribute('max', '566')
  expect(control).toHaveAttribute('aria-controls', panel.id)
  fireEvent.change(control, { target: { value: '566' } })
  expect(panel.scrollTop).toBe(566)
  fireEvent.change(control, { target: { value: '0' } })
  expect(panel.scrollTop).toBe(0)
  panel.scrollTop = 280
  fireEvent.scroll(panel)
  expect(control).toHaveAttribute('aria-valuenow', '280')
  fireEvent.wheel(control, { deltaY: 40 })
  expect(panel.scrollTop).toBe(320)
  unmount()
  expect(panel.className).toBe('')
  expect(panel.id).toBe('specifications-test')
})

it('hides the control when the content fits', () => {
  const container = document.createElement('section')
  const panel = document.createElement('div')
  panel.setAttribute('role', 'tabpanel')
  Object.defineProperties(panel, { clientHeight: { value: 200 }, scrollHeight: { value: 200 } })
  container.append(panel)
  const ref = createRef<HTMLElement>()
  ref.current = container
  const { unmount } = render(<DetailScrollbar containerRef={ref} label="Scroll specifications" />)
  expect(screen.getByRole('scrollbar', { hidden: true })).not.toBeVisible()
  unmount()
  expect(panel.id).toBe('')
})
