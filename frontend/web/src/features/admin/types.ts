// Shapes of the administration API (/api/admin, RF19, CU-17).

export type DealerContact = {
  email: string | null
  telefono: string | null
}

export type AdminDealer = {
  id: number
  nombre: string
  localidad: string | null
  provincia: string | null
  // 'pendiente' | 'activa' today; HU20 adds 'inactiva'.
  estado_alta: string | null
  contacto: DealerContact
}

// A row of GET /api/admin/concesionarias: dealers with a receipt to review come first.
export type AdminDealerRow = AdminDealer & {
  comprobante_pendiente_id: number | null
  // The latest receipt in any state, so an already decided one can still be opened.
  ultimo_comprobante_id: number | null
}

export type DealerCounts = {
  activas: number
  pendientes: number
  inactivas: number
}

export type DealerDirectory = {
  conteos: DealerCounts
  concesionarias: AdminDealerRow[]
}

export type ReceiptState = 'pendiente de revisión' | 'aprobado' | 'rechazado'

// GET /api/admin/comprobantes/{id}, and the answer of aprobar / rechazar.
export type AdminReceipt = {
  id: number
  estado: ReceiptState
  tipo: 'alta' | 'renovacion'
  // yyyy-mm-dd.
  periodo_desde: string
  periodo_hasta: string
  // ISO 8601, UTC; null when the receipt has no payment date.
  enviado_en: string | null
  nombre_archivo: string
  archivo_url: string
  motivo_rechazo: string | null
  fecha_revision: string | null
  concesionaria: AdminDealer
}
