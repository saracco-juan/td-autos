// The dealer a `concesionaria` user is responsible for.
export type DealerSummary = {
  id: number
  nombre: string
  estado_alta: string | null
}

export type User = {
  id: number
  name: string
  apellido: string | null
  email: string
  rol: string
  perfil_completo: boolean
  tiene_diagnostico: boolean
  // Present only for users with the dealer role.
  concesionaria?: DealerSummary
}

export type RegisterPayload = {
  name: string
  apellido: string | null
  email: string
  password: string
  password_confirmation: string
}

// Dealer self-registration (RF15): the dealer plus the account of its responsible person.
export type DealerRegisterPayload = {
  nombre_concesionaria: string
  name: string
  apellido: string
  responsable_dni: string
  telefono_publico: string
  telefono_responsable: string
  email: string
  direccion: string
  localidad: string
  provincia: string
  password: string
  password_confirmation: string
}

export type LoginCredentials = {
  email: string
  password: string
}

export type ResetPasswordPayload = {
  token: string
  email: string
  password: string
  passwordConfirmation: string
}

export type FieldName = 'name' | 'email' | 'password' | 'passwordConfirmation'

export type FieldErrors = Partial<Record<FieldName, string[]>>
