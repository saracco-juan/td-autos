import type { FieldErrors } from '../types'
import { PASSWORD_RULES } from '../passwordRules'

export type RegisterFormValues = {
  name: string
  apellido: string
  email: string
  password: string
  passwordConfirmation: string
}

// Deliberately permissive: the server remains the authority on email validity.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRegisterForm(values: RegisterFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (values.name.trim() === '') errors.name = ['El nombre es obligatorio.']

  const email = values.email.trim()
  if (email === '') errors.email = ['El email es obligatorio.']
  else if (!EMAIL_PATTERN.test(email)) errors.email = ['Ingrese un email válido.']

  const passwordErrors = PASSWORD_RULES.filter((rule) => !rule.test(values.password)).map(
    (rule) => rule.message,
  )
  if (passwordErrors.length > 0) errors.password = passwordErrors

  if (values.password !== values.passwordConfirmation) {
    errors.passwordConfirmation = ['Las contraseñas no coinciden.']
  }

  return errors
}
