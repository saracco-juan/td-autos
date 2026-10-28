// Buyer-facing equipment catalogue shared by web and mobile: [field, label] pairs per specification section.
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
export type EquipmentFacts = Partial<Record<EquipmentField, boolean | null>>

// RF08 glossary: explain the feature, independently of whether this vehicle has it.
export const EQUIPMENT_EXPLANATIONS: Record<string, string> = {
  control_estabilidad: 'Ayuda a mantener la trayectoria cuando las ruedas pierden adherencia.',
  frenos_abs: 'Ayuda a evitar que las ruedas se bloqueen al frenar.',
  airbags_frontales: 'Bolsas de aire que ayudan a proteger a conductor y acompañante ante ciertos impactos.',
  airbags_laterales: 'Bolsas de aire que ayudan a proteger los costados del cuerpo ante ciertos impactos.',
  airbags_cortina: 'Bolsas de aire que ayudan a proteger la zona de la cabeza ante ciertos impactos laterales.',
  isofix: 'Anclajes para sujetar sillas infantiles compatibles.',
  frenado_autonomo: 'Asistencia que puede frenar automáticamente ante un riesgo de choque.',
  asistencia_carril: 'Avisa o ayuda a corregir una salida involuntaria del carril.',
  punto_ciego: 'Advierte sobre vehículos en zonas que pueden no verse fácilmente por los espejos.',
  recordatorio_cinturon: 'Avisa cuando corresponde abrochar el cinturón de seguridad.',
  asistencia_velocidad: 'Ayuda al conductor a respetar los límites de velocidad.',
  monitoreo_conductor: 'Puede detectar señales de distracción o cansancio del conductor.',
  volante_regulable: 'Permite ajustar la posición del volante para manejar con comodidad.',
  climatizador_bizona: 'Permite regular por separado la temperatura de dos zonas.',
  butacas_calefaccionadas: 'Calientan los asientos para mejorar el confort en días fríos.',
  android_auto_apple_carplay: 'Permite usar funciones compatibles del celular en la pantalla del auto.',
  sensores_estacionamiento: 'Alertan sobre la proximidad de obstáculos al estacionar.',
  velocidad_crucero: 'Mantiene una velocidad seleccionada; no reemplaza la atención del conductor.',
  camara_retroceso: 'Muestra la zona detrás del vehículo al dar marcha atrás.',
  aire_acondicionado: 'Enfría el habitáculo; un climatizador también regula la temperatura elegida.',
}
