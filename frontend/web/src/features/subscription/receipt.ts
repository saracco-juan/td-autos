import { HttpError } from '../../lib/http'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export const RECEIPT_ACCEPT = [...ALLOWED_EXTENSIONS.map((extension) => `.${extension}`), ...ALLOWED_TYPES].join(',')

const GENERIC_ERROR = 'No pudimos enviar el comprobante. Probá de nuevo.'

// Same rules and wording as the server (StoreComprobanteRequest), so the dealer hears the same thing either way.
// The extension decides; the MIME type is checked too when the browser knows it.
export function validateReceipt(file: File | null): string | undefined {
  if (!file) return 'Adjuntá el comprobante.'
  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(extension) || (file.type !== '' && !ALLOWED_TYPES.includes(file.type))) {
    return 'El comprobante tiene que ser PDF, JPG o PNG.'
  }
  if (file.size > MAX_BYTES) return 'El comprobante no puede superar los 5 MB.'
  return undefined
}

function firstText(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && candidate !== '' ? candidate : undefined
}

// What the dealer reads when the upload fails: the server wording for 422 (file) and 409/503 (state), a generic line otherwise.
export function sendErrorMessage(error: unknown): string {
  if (!(error instanceof HttpError)) return GENERIC_ERROR
  const body = error.body as { message?: unknown; errors?: { comprobante?: unknown } } | undefined
  if (error.status === 422) return firstText(body?.errors?.comprobante) ?? GENERIC_ERROR
  if (error.status === 409 || error.status === 503) return firstText(body?.message) ?? GENERIC_ERROR
  return GENERIC_ERROR
}
