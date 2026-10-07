export type User = {
  id: number
  name: string
  apellido: string | null
  email: string
  rol: string
  perfil_completo: boolean
  tiene_diagnostico: boolean
}

export type RegisterPayload = {
  name: string
  apellido: string | null
  email: string
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
