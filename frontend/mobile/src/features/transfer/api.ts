import type { AuthFetch } from '../../lib/http'
import type { TransferProgress, TransferResponse } from '@shared/checklist/transfer/types'

// `request` is the session's authFetch (useAuth), so every call carries the bearer token.
export function fetchTransfer(request: AuthFetch): Promise<TransferResponse> {
  return request<TransferResponse>('/api/transferencia')
}

export function setItemCompleted(request: AuthFetch, code: string, completed: boolean): Promise<TransferProgress> {
  return request<TransferProgress>(`/api/transferencia/items/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: { completado: completed },
  })
}

export function finishTransfer(request: AuthFetch): Promise<TransferProgress> {
  return request<TransferProgress>('/api/transferencia/finalizar', { method: 'POST' })
}
