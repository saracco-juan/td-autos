import { EQUIPMENT_FIELDS, type EquipmentField } from '@shared/vehicles/equipment'

export type MatchingFacts = Record<EquipmentField, boolean | null> & {
  moneda: 'ARS' | 'USD'
  plazas: number | null
  motor: string | null
  turbo: boolean | null
  potencia: number | null
  potencia_unidad: 'CV' | 'HP' | 'kW' | null
  consumo_urbano: number | null
  consumo_ruta: number | null
}
export type MatchingField = keyof MatchingFacts
export const MATCHING_FIELDS: MatchingField[] = [
  'moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta',
  ...EQUIPMENT_FIELDS.map(([key]) => key),
]
export const YES_NO = [{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }]

// Unknown stays unselected; false is an explicit answer, never the default.
export function matchingValues(facts: Partial<MatchingFacts> = {}): Record<MatchingField, string> {
  return Object.fromEntries(MATCHING_FIELDS.map((key) => {
    const value = facts[key]
    return [key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value ?? '')]
  })) as Record<MatchingField, string>
}
