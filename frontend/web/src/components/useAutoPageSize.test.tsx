import { act, render, renderHook, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useAutoPageSize, { fitCount } from './useAutoPageSize'

describe('fitCount', () => {
  it('fits as many rows as the free height holds, counting the gaps between them', () => {
    // 3 rows of 50 with 10 between them need 170; a fourth would need 230.
    expect(fitCount({ available: 200, overhead: 0, itemHeight: 50, gap: 10, columns: 1 })).toBe(3)
  })

  it('subtracts what is not a row (table header, padding)', () => {
    expect(fitCount({ available: 200, overhead: 40, itemHeight: 50, gap: 0, columns: 1 })).toBe(3)
  })

  it('multiplies the rows by the columns of a grid', () => {
    expect(fitCount({ available: 440, overhead: 0, itemHeight: 200, gap: 20, columns: 3 })).toBe(6)
  })

  it('never goes below one row, or one full row of a grid', () => {
    expect(fitCount({ available: 10, overhead: 0, itemHeight: 50, gap: 0, columns: 1 })).toBe(1)
    expect(fitCount({ available: 10, overhead: 0, itemHeight: 50, gap: 0, columns: 4 })).toBe(4)
  })
})

function List({ count, enabled = true }: { count: number; enabled?: boolean }) {
  const ref = useRef<HTMLUListElement>(null)
  const size = useAutoPageSize(ref, { itemSelector: 'li', fallback: 12, enabled })
  return (
    <>
      <p>size {size}</p>
      <ul ref={ref}>
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>row</li>
        ))}
      </ul>
    </>
  )
}

describe('useAutoPageSize', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('answers the fallback when the browser gives no layout (jsdom)', () => {
    const ref = { current: null }
    const { result } = renderHook(() => useAutoPageSize(ref, { itemSelector: 'li', fallback: 12 }))

    expect(result.current).toBe(12)
  })

  it('keeps the fallback while the rows have no height', () => {
    render(<List count={5} />)

    expect(screen.getByText('size 12')).toBeInTheDocument()
  })

  it('measures the rows once they have a height and again when the window is resized', () => {
    vi.useFakeTimers()
    let height = 100
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.tagName === 'LI') return { height: 50, top: 0, bottom: 50 } as DOMRect
      if (this.tagName === 'UL') return { height: 250, top: 100, bottom: 350 } as DOMRect
      return { height: 0, top: 0, bottom: 0 } as DOMRect
    })
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => height + 0 })
    // Free height = innerHeight - list top (100) - reserve (56): 600 - 100 - 56 = 444 -> 8 rows of 50 (overhead 0).
    height = 600

    render(<List count={5} />)
    expect(screen.getByText('size 8')).toBeInTheDocument()

    height = 400
    act(() => {
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(300)
    })
    // 400 - 100 - 56 = 244 -> 4 rows.
    expect(screen.getByText('size 4')).toBeInTheDocument()
  })
})
