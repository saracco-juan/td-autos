const validId = (id: number) => Number.isSafeInteger(id) && id > 0

/** HU08 selections are listing IDs, not cached facts or calculator results. */
export function readSelection(raw: string | null): number[] {
  if (!raw) return []
  const parts = raw.split(',')
  if (parts.length > 2 || parts.some((part) => !/^[1-9]\d*$/.test(part))) return []
  const ids = parts.map(Number)
  return ids.every(validId) && new Set(ids).size === ids.length ? ids : []
}

export function canCompare(ids: readonly number[]): boolean {
  return ids.length === 2 && ids.every(validId) && ids[0] !== ids[1]
}

/** Reject a third without modifying the current pair; selecting again removes it. */
export function toggleSelection(ids: readonly number[], id: number): { ids: number[]; rejected: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((selected) => selected !== id), rejected: false }
  if (!validId(id) || ids.length >= 2) return { ids: [...ids], rejected: true }
  return { ids: [...ids, id], rejected: false }
}
