import { useState } from 'react'

// Client-side pages of a list: the current page is kept inside the range when the list or the page size shrinks.
export default function usePagedItems<T>(items: T[], pageSize: number) {
  const [requested, setPage] = useState(1)
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(requested, lastPage)
  const start = (page - 1) * pageSize
  return { page, lastPage, setPage, pageItems: items.slice(start, start + pageSize) }
}
