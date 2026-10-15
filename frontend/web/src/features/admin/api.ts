import { apiFetch, apiFetchBlob } from '../../lib/http'
import type { AdminReceipt, DealerDetail, DealerDirectory, DealerFormValues } from './types'

export function fetchDealerDirectory(): Promise<DealerDirectory> {
  return apiFetch<DealerDirectory>('/api/admin/concesionarias')
}

export function fetchReceipt(id: number): Promise<AdminReceipt> {
  return apiFetch<AdminReceipt>(`/api/admin/comprobantes/${id}`)
}

// The file sits on a private disk: only this authenticated route serves it.
export function fetchReceiptFile(id: number): Promise<Blob> {
  return apiFetchBlob(`/api/admin/comprobantes/${id}/archivo`)
}

// Both decisions answer the receipt as it is after the decision (same shape as fetchReceipt).
export function approveReceipt(id: number): Promise<AdminReceipt> {
  return apiFetch<AdminReceipt>(`/api/admin/comprobantes/${id}/aprobar`, { method: 'POST' })
}

export function rejectReceipt(id: number, motivo: string): Promise<AdminReceipt> {
  return apiFetch<AdminReceipt>(`/api/admin/comprobantes/${id}/rechazar`, { method: 'POST', body: { motivo_rechazo: motivo } })
}

export function fetchDealer(id: number): Promise<DealerDetail> {
  return apiFetch<DealerDetail>(`/api/admin/concesionarias/${id}`)
}

// Answers the dealer as it is after saving (same shape as fetchDealer).
export function updateDealer(id: number, values: DealerFormValues): Promise<DealerDetail> {
  return apiFetch<DealerDetail>(`/api/admin/concesionarias/${id}`, { method: 'PUT', body: values })
}
