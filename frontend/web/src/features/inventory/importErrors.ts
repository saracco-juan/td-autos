import { HttpError, NetworkError } from '../../lib/http'

export type ImportFailure = {
  message: string
  // One line per message of each wrong row; empty for a file-level or generic failure.
  rows: string[]
}

type RowError = { fila: number; patente: string | null; mensajes: string[] }
type ImportErrorBody = { message?: unknown; errores?: unknown; errors?: { archivo?: unknown } }

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'
const GENERIC_ERROR = 'No pudimos procesar el archivo. Probá de nuevo.'

const isText = (value: unknown): value is string => typeof value === 'string' && value !== ''

function rowLines(errores: unknown): string[] {
  if (!Array.isArray(errores)) return []
  return (errores as RowError[]).flatMap(({ fila, patente, mensajes }) =>
    mensajes.map((mensaje) => `Fila ${fila}${patente ? ` · ${patente}` : ''}: ${mensaje}`),
  )
}

// Turns a failed import request into what the page shows: the row errors of a 422, the file-level message, or a generic one.
export function importFailureFrom(error: unknown): ImportFailure {
  if (error instanceof NetworkError) return { message: NETWORK_ERROR, rows: [] }
  if (error instanceof HttpError && error.status === 422 && typeof error.body === 'object' && error.body !== null) {
    const body = error.body as ImportErrorBody
    const rows = rowLines(body.errores)
    if (rows.length > 0 && isText(body.message)) return { message: body.message, rows }
    const fileErrors = body.errors?.archivo
    if (Array.isArray(fileErrors) && isText(fileErrors[0])) return { message: fileErrors[0], rows: [] }
  }
  return { message: GENERIC_ERROR, rows: [] }
}
