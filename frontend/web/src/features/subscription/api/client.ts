import { apiFetch, apiFetchBlob } from '../../../lib/http'
import type { ReceiptHistoryEntry, Suscripcion } from '../model/types'

const RECEIPTS_PATH = '/api/concesionaria/suscripcion/comprobantes'

export function fetchReceipts(): Promise<ReceiptHistoryEntry[]> {
  return apiFetch<ReceiptHistoryEntry[]>(RECEIPTS_PATH)
}

export function fetchReceiptFile(id: number): Promise<Blob> {
  return apiFetchBlob(`${RECEIPTS_PATH}/${id}/archivo`)
}

export function fetchSubscription(): Promise<Suscripcion> {
  return apiFetch<Suscripcion>('/api/concesionaria/suscripcion')
}

// The answer (201) is the same summary the GET returns, now with the pending receipt.
export function sendReceipt(file: File): Promise<Suscripcion> {
  const data = new FormData()
  data.append('comprobante', file)
  return apiFetch<Suscripcion>(RECEIPTS_PATH, { method: 'POST', body: data })
}
