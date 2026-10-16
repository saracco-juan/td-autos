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

  it('sizes the page from the height of the scroll region, not from the window', () => {
    vi.useFakeTimers()
    let regionHeight = 500
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.scrollRegion !== undefined ? regionHeight : 0
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.tagName === 'LI') return { height: 235, top: 0, bottom: 235 } as DOMRect
      if (this.tagName === 'UL') return { height: 235, top: 0, bottom: 235 } as DOMRect
      return { height: 0, top: 0, bottom: 0 } as DOMRect
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          rowGap: '20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          paddingTop: '0px',
          paddingBottom: '0px',
        }) as unknown as CSSStyleDeclaration,
    )

    function Grid() {
      const ref = useRef<HTMLUListElement>(null)
      const size = useAutoPageSize(ref, { itemSelector: 'li', fallback: 12 })
      return (
        <div data-scroll-region="">
          <p>size {size}</p>
          <ul ref={ref}>
            <li>a</li>
          </ul>
        </div>
      )
    }
    render(<Grid />)

    // floor((500 - 0 + 20) / (235 + 20)) = 2 rows x 4 columns.
    expect(screen.getByText('size 8')).toBeInTheDocument()

    regionHeight = 800
    act(() => {
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(300)
    })
    // floor(820 / 255) = 3 rows.
    expect(screen.getByText('size 12')).toBeInTheDocument()
  })

  it('uses a fixed row height when given, so rows stretched to fill the box do not change the count', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.scrollRegion !== undefined ? 436 : 0
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      // Rows render stretched (109 px) and the header is 40 px.
      if (this.tagName === 'TR' && this.parentElement?.tagName === 'TBODY') return { height: 109, top: 0, bottom: 109 } as DOMRect
      if (this.tagName === 'THEAD') return { height: 40, top: 0, bottom: 40 } as DOMRect
      if (this.tagName === 'TABLE') return { height: 436, top: 0, bottom: 436 } as DOMRect
      return { height: 0, top: 0, bottom: 0 } as DOMRect
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({ rowGap: 'normal', display: 'table', gridTemplateColumns: 'none', paddingTop: '0px', paddingBottom: '0px' }) as unknown as CSSStyleDeclaration,
    )

    function Table() {
      const ref = useRef<HTMLTableElement>(null)
      const size = useAutoPageSize(ref, { itemSelector: 'tbody tr', fallback: 10, itemHeight: 56 })
      return (
        <div data-scroll-region="">
          <p>size {size}</p>
          <table ref={ref}>
            <thead>
              <tr>
                <th>h</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>a</td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    }
    render(<Table />)

    // (436 - 2 safety - 40 header) / 56 = 7 rows, whatever height the rows render at.
    expect(screen.getByText('size 7')).toBeInTheDocument()
  })

  it('subtracts the padding of the region and uses an explicit container when given', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.id === 'box' ? 140 : 0
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.tagName === 'LI') return { height: 50, top: 0, bottom: 50 } as DOMRect
      if (this.tagName === 'UL') return { height: 50, top: 0, bottom: 50 } as DOMRect
      return { height: 0, top: 0, bottom: 0 } as DOMRect
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({ rowGap: '0px', display: 'block', gridTemplateColumns: 'none', paddingTop: '10px', paddingBottom: '10px' }) as unknown as CSSStyleDeclaration,
    )

    function Boxed() {
      const ref = useRef<HTMLUListElement>(null)
      const box = useRef<HTMLDivElement>(null)
      const size = useAutoPageSize(ref, { itemSelector: 'li', fallback: 12, containerRef: box })
      return (
        <div id="box" ref={box}>
          <p>size {size}</p>
          <ul ref={ref}>
            <li>a</li>
          </ul>
        </div>
      )
    }
    render(<Boxed />)

    // (140 - 20) / 50 = 2 rows.
    expect(screen.getByText('size 2')).toBeInTheDocument()
  })
})
