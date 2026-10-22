import type { FieldErrors } from '../types'
import { validateEmail } from '../shared/validateEmail'

export type LoginFormValues = {
  email: string
  password: string
}

// Only presence is checked for the password: strength rules apply when it is created, not when it is used.
export function validateLoginForm(values: LoginFormValues): FieldErrors {
  const errors: FieldErrors = {}

  const emailErrors = validateEmail(values.email)
  if (emailErrors) errors.email = emailErrors

  if (values.password === '') errors.password = ['La contraseña es obligatoria.']

  return errors
}
