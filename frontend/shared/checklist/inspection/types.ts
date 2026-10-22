export type InspectionStatus = 'en_curso' | 'incompleta' | 'completa'

export type InspectionItem = {
  codigo: string
  texto: string
  critico: boolean
}

export type InspectionStep = {
  numero: number
  titulo: string
  ayuda: string | null
  items: InspectionItem[]
}

// The database allows every part of the vehicle title to be empty.
export type InspectionVehicle = {
  id: number
  marca: string | null
  modelo: string | null
  version: string | null
  anio: number | null
}

// Returned by the toggle and finish endpoints. `estado` is null while the user has no checklist row.
export type InspectionProgress = {
  estado: InspectionStatus | null
  items_completados: string[]
}

export type InspectionResponse = InspectionProgress & {
  vehiculo: InspectionVehicle
  pasos: InspectionStep[]
}
