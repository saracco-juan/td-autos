// "2026-10-23" or "2026-10-20T12:00:00Z" -> "23/10/2026". Read from the text so the time zone never shifts the day.
export function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
