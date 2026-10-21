export type TransferStatus = 'en_curso' | 'incompleta' | 'completa'

export type TransferItem = {
  codigo: string
  texto: string
  obligatorio: boolean
}

export type TransferStage = {
  numero: number
  titulo: string
  ayuda: string | null
  items: TransferItem[]
}

// Returned by the toggle and finish endpoints. `estado` is null while the user has no checklist row.
export type TransferProgress = {
  estado: TransferStatus | null
  items_completados: string[]
}

export type TransferResponse = TransferProgress & {
  etapas: TransferStage[]
  // Digits only (country code included), or null when no advisor is configured.
  asesor_whatsapp: string | null
}
