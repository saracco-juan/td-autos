import { apiFetch } from '../../lib/http'
import type { TransferProgress, TransferResponse } from './types'

export function fetchTransfer(): Promise<TransferResponse> {
  return apiFetch<TransferResponse>('/api/transferencia')
}

export function setItemCompleted(code: string, completed: boolean): Promise<TransferProgress> {
  // Saved in the background with no loader: keepalive lets the write finish if the user reloads or leaves.
  return apiFetch<TransferProgress>(`/api/transferencia/items/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: { completado: completed },
    keepalive: true,
  })
}

export function finishTransfer(): Promise<TransferProgress> {
  return apiFetch<TransferProgress>('/api/transferencia/finalizar', { method: 'POST' })
}
