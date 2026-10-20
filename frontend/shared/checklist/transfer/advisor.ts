// The advisor's WhatsApp chat. The API sends digits only; anything else is dropped here as a safeguard so
// the number can never alter the URL. Null when no digit is left.
export function advisorUrl(number: string): string | null {
  const digits = number.replace(/\D/g, '')
  return digits === '' ? null : `https://wa.me/${digits}`
}
