export type User = {
  id: number
  name: string
  apellido: string | null
  email: string
  rol: string
}

export type RegisterPayload = {
  name: string
  apellido: string | null
  email: string
  password: string
  password_confirmation: string
}

export type FieldName = 'name' | 'apellido' | 'email' | 'password' | 'passwordConfirmation'

export type FieldErrors = Partial<Record<FieldName, string[]>>
