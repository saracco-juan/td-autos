import type { FieldErrors } from '../types'
import { validateEmail } from '../shared/validateEmail'
import { validateNewPassword } from '../shared/validateNewPassword'

export type RegisterFormValues = {
  name: string
  email: string
  password: string
  passwordConfirmation: string
}

export function validateRegisterForm(values: RegisterFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (values.name.trim() === '') errors.name = ['El nombre es obligatorio.']

  const emailErrors = validateEmail(values.email)
  if (emailErrors) errors.email = emailErrors

  return { ...errors, ...validateNewPassword(values.password, values.passwordConfirmation) }
}
