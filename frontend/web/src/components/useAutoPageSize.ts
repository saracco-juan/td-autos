import { useEffect, useState, type RefObject } from 'react'

type Options = {
  /** Selector of one row or card inside the list element. */
  itemSelector: string
  /** Page size while the browser gives no layout (first render, tests). */
  fallback?: number
  /** Upper bound, for a server that caps its page size. */
  max?: number
  /** Pixels kept free under the list for the footer row (actions and pager) and its gap. */
  reserve?: number
  /** False while the list is not on screen; turning it true measures it. */
  enabled?: boolean
}

type Fit = { available: number; overhead: number; itemHeight: number; gap: number; columns: number }

const DEBOUNCE_MS = 150
// A subpixel of rounding must not make the last row spill over and draw a scrollbar.
const SAFETY = 2

// Rows that fit in `available` pixels: n rows take n * itemHeight + (n - 1) * gap, after the part of the list that is not a row.
export function fitCount({ available, overhead, itemHeight, gap, columns }: Fit): number {
  const rows = Math.floor((available - overhead + gap) / (itemHeight + gap))
  return Math.max(1, rows) * columns
}

function pixels(value: string): number {
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

// Reads the layout: height of one item, columns of a grid, what is left of the viewport under the list. Null when there is nothing to measure yet.
function measure(list: HTMLElement, itemSelector: string, reserve: number): number | null {
  const items = Array.from(list.querySelectorAll<HTMLElement>(itemSelector))
  const heights = items.map((item) => item.getBoundingClientRect().height)
  const listRect = list.getBoundingClientRect()
  // The tallest item sets the size, so a page of the tallest rows still fits.
  const itemHeight = Math.max(0, ...heights)
  if (!itemHeight || !listRect.height) return null

  const style = getComputedStyle(list)
  const gap = pixels(style.rowGap)
  const columns = style.display === 'grid' ? Math.max(1, style.gridTemplateColumns.split(' ').filter(Boolean).length) : 1
  // What the list holds besides its rows (a table header, padding): its height minus the rows and the gaps now on screen.
  const rowHeights = heights.filter((_, index) => index % columns === 0)
  const rowsTotal = rowHeights.reduce((sum, height) => sum + height, 0)
  const overhead = Math.max(0, listRect.height - rowsTotal - Math.max(rowHeights.length - 1, 0) * gap)

  // Free space under the list: the viewport minus the shell footer and the padding of <main>, measured from the top of the document.
  const main = list.closest('main')
  const shellFooter = main?.nextElementSibling?.getBoundingClientRect().height ?? 0
  const mainPadding = main ? pixels(getComputedStyle(main).paddingBottom) : 0
  const boxPadding = list.parentElement ? pixels(getComputedStyle(list.parentElement).paddingBottom) : 0
  const limit = window.innerHeight - shellFooter - mainPadding - reserve - boxPadding
  const available = limit - (listRect.top + window.scrollY) - SAFETY

  return fitCount({ available, overhead, itemHeight, gap, columns })
}

// How many rows or cards fit in the free height of the screen, like MUI DataGrid's autoPageSize: lists are paginated, not scrolled.
// Pass the element that holds the items (the <ul>, or the <table>). Remeasures on resize, debounced.
export default function useAutoPageSize(
  ref: RefObject<HTMLElement | null>,
  { itemSelector, fallback = 10, max, reserve = 56, enabled = true }: Options,
): number {
  const [size, setSize] = useState(fallback)

  useEffect(() => {
    const list = ref.current
    if (!enabled || !list) return

    const update = () => {
      const next = measure(list, itemSelector, reserve)
      if (next !== null) setSize(max ? Math.min(next, max) : next)
    }
    update()

    let timer: ReturnType<typeof setTimeout> | undefined
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(update, DEBOUNCE_MS)
    }
    window.addEventListener('resize', later)
    const page = list.closest('main')?.lastElementChild
    const observer = typeof ResizeObserver === 'undefined' || !page ? null : new ResizeObserver(later)
    if (observer && page) observer.observe(page)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', later)
      observer?.disconnect()
    }
  }, [ref, itemSelector, reserve, max, enabled])

  return size
}
