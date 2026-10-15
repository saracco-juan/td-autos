// Response of GET /api/concesionaria/suscripcion and of the receipt upload (201).
export type EstadoAlta = 'pendiente' | 'activa'

export type TipoPago = 'alta' | 'renovacion'

export type DatosTransferencia = {
  titular: string
  cuit: string
  banco: string
  cbu: string
  alias: string
  // Decimal string as the backend config holds it, e.g. "25000".
  monto_mensual: string
}

export type ComprobantePendiente = {
  id: number
  nombre_archivo: string
  // ISO 8601, UTC.
  enviado_en: string
  tipo: TipoPago
  periodo_desde: string
  periodo_hasta: string
}

export type EstadoComprobante = 'pendiente de revisión' | 'aprobado' | 'rechazado'

// Outcome of the latest receipt in any state, so the dealer learns about a rejection and its reason.
export type UltimoComprobante = {
  id: number
  estado: EstadoComprobante
  motivo_rechazo: string | null
  // ISO 8601, UTC; null while the receipt is in review.
  fecha_revision: string | null
}

export type Suscripcion = {
  estado_alta: EstadoAlta
  tipo_pago: TipoPago
  // null when the transfer data are not configured: the dealer cannot send a receipt.
  transferencia: DatosTransferencia | null
  comprobante_pendiente: ComprobantePendiente | null
  ultimo_comprobante: UltimoComprobante | null
}
