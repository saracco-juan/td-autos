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
  estado_alta: string | null
  contacto: DealerContact
}

// A row of GET /api/admin/concesionarias: dealers with a receipt to review come first.
export type AdminDealerRow = AdminDealer & {
  comprobante_pendiente_id: number | null
  // The latest receipt in any state, so an already decided one can still be opened.
  ultimo_comprobante_id: number | null
  // State of that latest receipt; null when the dealer never sent one.
  ultimo_comprobante_estado: ReceiptState | null
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

// Editable data of a dealer: the body of PUT /api/admin/concesionarias/{id} (RF32); every key is required.
export type DealerFormValues = {
  nombre: string
  responsable_nombre: string
  responsable_apellido: string
  responsable_dni: string
  telefono_responsable: string
  telefono_publico: string
  email: string
  direccion: string
  localidad: string
  provincia: string
}

export type DealerFormField = keyof DealerFormValues

export type DealerSubscription = {
  estado: string
  // yyyy-mm-dd; null while there is no validity yet.
  vigente_desde: string | null
  vigente_hasta: string | null
  // Last day of full access after expiring; set once the subscription was active.
  gracia_hasta: string | null
  // Last day the hidden vehicles are kept; only while inactive.
  retencion_hasta: string | null
}

// A receipt of the dealer's history (newest first).
export type DealerReceiptRow = {
  id: number
  tipo: 'alta' | 'renovacion'
  estado: ReceiptState
  periodo_desde: string
  periodo_hasta: string
  enviado_en: string | null
  motivo_rechazo: string | null
  fecha_revision: string | null
}

// GET /api/admin/concesionarias/{id}, and the answer of the PUT.
export type DealerDetail = DealerFormValues & {
  id: number
  estado_alta: string | null
  suscripcion: DealerSubscription | null
  comprobantes: DealerReceiptRow[]
}

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
