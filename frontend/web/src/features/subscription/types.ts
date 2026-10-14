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

export type Suscripcion = {
  estado_alta: EstadoAlta
  tipo_pago: TipoPago
  // null when the transfer data are not configured: the dealer cannot send a receipt.
  transferencia: DatosTransferencia | null
  comprobante_pendiente: ComprobantePendiente | null
}
