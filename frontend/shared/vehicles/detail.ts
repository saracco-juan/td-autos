import type { InspectionVehicle } from '../checklist/inspection/types'
import { EQUIPMENT_EXPLANATIONS, EQUIPMENT_GROUPS, type EquipmentFacts } from './equipment'

export type DetailVehicle = InspectionVehicle & {
  kilometraje: number | null
  precio: number | null
  moneda: 'ARS' | 'USD' | null
  ubicacion: string | null
  transmision: 'manual' | 'automatica' | null
  combustible: 'nafta' | 'diesel' | 'gnc' | 'hibrido' | 'electrico' | null
  carroceria: string | null
  descripcion: string | null
  motor: string | null
  potencia: number | null
  potencia_unidad: 'CV' | 'HP' | 'kW' | null
  plazas: number | null
  turbo: boolean | null
  consumo_urbano: number | null
  consumo_ruta: number | null
  fotos: { id: number; url: string; orden: number }[]
}

export const UNKNOWN_FACT = 'No disponible'
export type SpecificationRow = { label: string; value: string; explanation?: string }

export function equipmentValue(value: boolean | null | undefined): string {
  return value == null ? UNKNOWN_FACT : value ? 'Sí' : 'No'
}

function text(value: string | number | null): string {
  return value == null || String(value).trim() === '' ? UNKNOWN_FACT : String(value).trim()
}

function consumption(value: number | null, fuel: DetailVehicle['combustible']): string {
  if (value === null) return UNKNOWN_FACT
  const unit = fuel === 'nafta' || fuel === 'diesel' || fuel === 'hibrido'
    ? 'L/100 km' : '(unidad no informada)'
  return `${value.toLocaleString('es-AR')} ${unit}`
}

// HU09 / RF08: describe supplied facts, not inferred equipment or promised running costs.
export function specificationGroups(vehicle: DetailVehicle): { title: string; rows: SpecificationRow[] }[] {
  const fuels = { nafta: 'Nafta', diesel: 'Diésel', gnc: 'Gas natural comprimido (GNC)',
    hibrido: 'Híbrido', electrico: 'Eléctrico' }
  return [
    { title: 'Información general', rows: [
      { label: 'Año', value: text(vehicle.anio) },
      { label: 'Kilometraje', value: vehicle.kilometraje === null ? UNKNOWN_FACT
        : `${vehicle.kilometraje.toLocaleString('es-AR')} km` },
      { label: 'Carrocería', value: text(vehicle.carroceria) },
      { label: 'Ubicación', value: text(vehicle.ubicacion) },
      { label: 'Plazas', value: text(vehicle.plazas), explanation: 'Cantidad de personas que pueden viajar sentadas.' },
      { label: 'Transmisión', value: vehicle.transmision === null ? UNKNOWN_FACT
        : vehicle.transmision === 'automatica' ? 'Automática' : 'Manual',
      explanation: 'Indica si los cambios de marcha se realizan automáticamente o los hacés vos.' },
      { label: 'Combustible', value: vehicle.combustible === null ? UNKNOWN_FACT : fuels[vehicle.combustible] },
    ] },
    { title: 'Motor y consumo', rows: [
      { label: 'Motor', value: text(vehicle.motor), explanation: 'Descripción del motor informada por la concesionaria.' },
      { label: 'Potencia', value: vehicle.potencia === null ? UNKNOWN_FACT
        : `${vehicle.potencia.toLocaleString('es-AR')} ${vehicle.potencia_unidad ?? '(unidad no informada)'}`,
      explanation: 'Expresa la capacidad de trabajo del motor; no indica el consumo de combustible.' },
      { label: 'Turbo', value: equipmentValue(vehicle.turbo),
        explanation: 'Sistema que aporta más aire al motor para mejorar su respuesta.' },
      { label: 'Consumo en ciudad', value: consumption(vehicle.consumo_urbano, vehicle.combustible),
        explanation: 'En motores a nafta o diésel, indica los litros necesarios para recorrer 100 km en ciudad.' },
      { label: 'Consumo en ruta', value: consumption(vehicle.consumo_ruta, vehicle.combustible),
        explanation: 'Referencia declarada para circular en ruta; el consumo real depende del uso.' },
    ] },
  ]
}

export type SpecificationSection = { title: string; rows: SpecificationRow[] }

// The four buyer sections in order: general info, engine, safety, comfort. Equipment the dealer did not report reads "No disponible".
export function detailSections(vehicle: DetailVehicle & EquipmentFacts): SpecificationSection[] {
  return [
    ...specificationGroups(vehicle),
    ...Object.entries(EQUIPMENT_GROUPS).map(([title, fields]) => ({
      title,
      rows: fields.map(([key, label]) => ({ label, value: equipmentValue(vehicle[key]),
        explanation: EQUIPMENT_EXPLANATIONS[key] })),
    })),
  ]
}
