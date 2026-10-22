import { formatPrice } from '../inventory/format'

const twoDigits = (value: number) => String(value).padStart(2, '0')

// dd/mm/aaaa in the browser's time zone; the API sends the instant in UTC.
export function formatSentDate(iso: string): string {
  const date = new Date(iso)
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()}`
}

// The backend sends the amount as the decimal string it has in its config.
export function formatMonthlyAmount(amount: string): string {
  const value = Number(amount)
  return amount.trim() !== '' && Number.isFinite(value) ? formatPrice(value) : amount
}
