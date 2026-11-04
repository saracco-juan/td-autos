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

// Where the subscription stands by its dates: `gracia` is the three days after it expires (full access),
// `inactiva` the retention window (inventory blocked, vehicles hidden).
export type EstadoSuscripcion = 'pendiente' | 'activa' | 'gracia' | 'inactiva'

// Dates are yyyy-mm-dd; `gracia_hasta` comes with activa, gracia and inactiva, `retencion_hasta` only with inactiva.
export type VigenciaSuscripcion = {
  estado: EstadoSuscripcion
  vigente_desde: string | null
  vigente_hasta: string | null
  gracia_hasta: string | null
  retencion_hasta: string | null
}

export type Suscripcion = {
  estado_alta: EstadoAlta
  suscripcion: VigenciaSuscripcion
  tipo_pago: TipoPago
  // null when the transfer data are not configured: the dealer cannot send a receipt.
  transferencia: DatosTransferencia | null
  comprobante_pendiente: ComprobantePendiente | null
  ultimo_comprobante: UltimoComprobante | null
}
