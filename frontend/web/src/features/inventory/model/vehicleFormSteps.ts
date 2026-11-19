import { MATCHING_FIELDS, type MatchingField } from './matchingFields'
import type { VehicleErrorKey, VehicleErrors } from './vehicleFields'

export const VEHICLE_FORM_STEPS: { title: string; description: string; fields: VehicleErrorKey[] }[] = [
  {
    title: 'Identidad',
    description: 'Identificá el vehículo y vinculalo con el catálogo.',
    fields: ['patente', 'marca', 'modelo', 'version', 'acara_version_id', 'anio'],
  },
  {
    title: 'Publicación',
    description: 'Completá el precio, el kilometraje y los datos para publicar.',
    fields: ['kilometraje', 'precio', 'ubicacion', 'descripcion', 'moneda'],
  },
  {
    title: 'Ficha técnica',
    description: 'Indicá las características y el consumo del vehículo.',
    fields: ['transmision', 'combustible', 'carroceria_id', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta'],
  },
  {
    title: 'Equipamiento',
    description: 'Elegí sí o no para cada dato de equipamiento.',
    fields: MATCHING_FIELDS.filter((field): field is MatchingField => !['moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta'].includes(field)),
  },
  {
    title: 'Fotos',
    description: 'Agregá al menos siete fotos. La primera será la portada.',
    fields: ['fotos'],
  },
]

export function errorsForVehicleStep(errors: VehicleErrors, step: number): VehicleErrors {
  const fields = VEHICLE_FORM_STEPS[step]?.fields ?? []
  return Object.fromEntries(fields.flatMap((field) => errors[field] ? [[field, errors[field]]] : []))
}

export function vehicleStepForError(field: VehicleErrorKey): number {
  const step = VEHICLE_FORM_STEPS.findIndex(({ fields }) => fields.includes(field))
  return step < 0 ? 0 : step
}
