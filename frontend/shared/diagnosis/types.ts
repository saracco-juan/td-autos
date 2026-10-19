export type PresupuestoCode = 'hasta_15m' | '15m_25m' | '25m_40m' | 'mas_40m'
export type UsoPrincipalCode = 'ciudad' | 'ruta' | 'mixto' | 'trabajo'
export type PasajerosCode = '1_2' | '3_4' | '5_mas'
export type KilometrosMensualesCode = 'menos_500' | '500_1500' | '1500_3000' | 'mas_3000' | 'no_sabe'
export type TransmisionCode = 'manual' | 'automatica' | 'indiferente'
export type PrioridadCode = 'consumo' | 'seguridad' | 'mantenimiento' | 'reventa'

export type BodyType = {
  id: number
  nombre: string
}

// The complete payload of PUT /api/diagnostico: every question answered.
export type DiagnosisAnswers = {
  presupuesto: PresupuestoCode
  uso_principal: UsoPrincipalCode
  pasajeros: PasajerosCode
  kilometros_mensuales: KilometrosMensualesCode
  transmision: TransmisionCode
  prioridad: PrioridadCode
  carrocerias: number[]
}

export type DiagnosisField = keyof DiagnosisAnswers
export type ScalarField = Exclude<DiagnosisField, 'carrocerias'>

// In-progress answers: any scalar may be unanswered and no body type may be chosen yet.
export type DiagnosisDraft = {
  [F in ScalarField]: DiagnosisAnswers[F] | null
} & { carrocerias: number[] }

export type DiagnosisResponse = {
  diagnostico: DiagnosisAnswers | null
  carrocerias: BodyType[]
}
