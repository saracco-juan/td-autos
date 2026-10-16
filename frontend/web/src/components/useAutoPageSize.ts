import { useEffect, useState, type RefObject } from 'react'

type Options = {
  /** Selector of one row or card inside the list element. */
  itemSelector: string
  /** Page size while the browser gives no layout (first render, tests). */
  fallback?: number
  /** Upper bound, for a server that caps its page size. */
  max?: number
  /** Element whose height the rows may fill. Defaults to the closest `[data-scroll-region]` (a ScrollArea), then the parent. */
  containerRef?: RefObject<HTMLElement | null>
  /** False while the list is not on screen; turning it true measures it. */
  enabled?: boolean
  /**
   * Fixed height of one row. Use it when the rows stretch to fill the box (a table at height 100%):
   * measuring a stretched row would shrink the page, which stretches the rows more.
   */
  itemHeight?: number
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

// Reads the layout: height of one item, columns of a grid, and the height the container gives the list.
// The container height comes only from the flex layout of the screen, never from the page size, so measuring cannot oscillate.
// Null when there is nothing to measure yet.
function available(container: HTMLElement): number {
  const style = getComputedStyle(container)
  return container.clientHeight - pixels(style.paddingTop) - pixels(style.paddingBottom) - SAFETY
}

// Fixed row height: only the box and the table header are measured, so the result never depends on how the rows render.
function measureFixed(list: HTMLElement, itemHeight: number, container: HTMLElement | null): number | null {
  if (!container || !container.clientHeight) return null
  const header = list instanceof HTMLTableElement && list.tHead ? list.tHead.getBoundingClientRect().height : 0
  return fitCount({ available: available(container), overhead: header, itemHeight, gap: 0, columns: 1 })
}

function measure(list: HTMLElement, itemSelector: string, container: HTMLElement | null): number | null {
  const items = Array.from(list.querySelectorAll<HTMLElement>(itemSelector))
  const heights = items.map((item) => item.getBoundingClientRect().height)
  const listRect = list.getBoundingClientRect()
  // The tallest item sets the size, so a page of the tallest rows still fits.
  const itemHeight = Math.max(0, ...heights)
  if (!itemHeight || !listRect.height || !container) return null
  const containerHeight = container.clientHeight
  if (!containerHeight) return null

  const style = getComputedStyle(list)
  const gap = pixels(style.rowGap)
  const columns = style.display === 'grid' ? Math.max(1, style.gridTemplateColumns.split(' ').filter(Boolean).length) : 1
  // What the list holds besides its rows (a table header): its height minus the rows and the gaps now on screen.
  const rowHeights = heights.filter((_, index) => index % columns === 0)
  const rowsTotal = rowHeights.reduce((sum, height) => sum + height, 0)
  const overhead = Math.max(0, listRect.height - rowsTotal - Math.max(rowHeights.length - 1, 0) * gap)

  return fitCount({ available: available(container), overhead, itemHeight, gap, columns })
}

// How many rows or cards fit in the height of the list's container, like MUI DataGrid's autoPageSize: lists are paginated, not scrolled.
// Pass the element that holds the items (the <ul>, or the <table>). Remeasures when the container or the window resizes, debounced.
export default function useAutoPageSize(
  ref: RefObject<HTMLElement | null>,
  { itemSelector, fallback = 10, max, containerRef, enabled = true, itemHeight }: Options,
): number {
  const [size, setSize] = useState(fallback)

  useEffect(() => {
    const list = ref.current
    if (!enabled || !list) return

    const container = () =>
      containerRef?.current ?? list.closest<HTMLElement>('[data-scroll-region]') ?? list.parentElement

    const update = () => {
      const next = itemHeight
        ? measureFixed(list, itemHeight, container())
        : measure(list, itemSelector, container())
      if (next !== null) setSize(max ? Math.min(next, max) : next)
    }
    update()

    let timer: ReturnType<typeof setTimeout> | undefined
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(update, DEBOUNCE_MS)
    }
    window.addEventListener('resize', later)
    const box = container()
    const observer = typeof ResizeObserver === 'undefined' || !box ? null : new ResizeObserver(later)
    if (observer && box) observer.observe(box)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', later)
      observer?.disconnect()
    }
  }, [ref, containerRef, itemSelector, max, enabled, itemHeight])

  return size
}
