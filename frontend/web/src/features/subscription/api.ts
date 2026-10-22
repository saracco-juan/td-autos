import { apiFetch } from '../../lib/http'
import type { Suscripcion } from './types'

export function fetchSubscription(): Promise<Suscripcion> {
  return apiFetch<Suscripcion>('/api/concesionaria/suscripcion')
}

// The answer (201) is the same summary the GET returns, now with the pending receipt.
export function sendReceipt(file: File): Promise<Suscripcion> {
  const data = new FormData()
  data.append('comprobante', file)
  return apiFetch<Suscripcion>('/api/concesionaria/suscripcion/comprobantes', { method: 'POST', body: data })
}
