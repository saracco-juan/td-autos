export const EQUIPMENT_GROUPS = {
  Seguridad: [
    ['control_estabilidad', 'Control de estabilidad'],
    ['frenos_abs', 'Frenos ABS'],
    ['airbags_frontales', 'Airbags para conductor y acompañante'],
    ['airbags_laterales', 'Airbags laterales'],
    ['airbags_cortina', 'Airbags de cortina'],
    ['isofix', 'Anclajes ISOFIX'],
    ['frenado_autonomo', 'Frenado autónomo de emergencia'],
    ['asistencia_carril', 'Alerta o asistencia de carril'],
    ['punto_ciego', 'Alerta de punto ciego'],
    ['recordatorio_cinturon', 'Recordatorio de cinturón'],
    ['asistencia_velocidad', 'Asistencia de velocidad (extra)'],
    ['monitoreo_conductor', 'Monitoreo del conductor (extra)'],
  ],
  Confort: [
    ['volante_regulable', 'Volante regulable en altura y profundidad'],
    ['climatizador_bizona', 'Climatizador bizona'],
    ['butacas_calefaccionadas', 'Butacas calefaccionadas'],
    ['android_auto_apple_carplay', 'Android Auto o Apple CarPlay'],
    ['sensores_estacionamiento', 'Sensores de estacionamiento'],
    ['velocidad_crucero', 'Velocidad crucero'],
    ['camara_retroceso', 'Cámara de retroceso'],
    ['aire_acondicionado', 'Aire acondicionado o climatizador'],
  ],
} as const

export const EQUIPMENT_FIELDS = Object.values(EQUIPMENT_GROUPS).flat()
export type EquipmentField = (typeof EQUIPMENT_FIELDS)[number][0]
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
