import type { FieldErrors } from '../types'
import { PASSWORD_RULES } from '../passwordRules'
import { validateEmail } from '../shared/validateEmail'

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

  const passwordErrors = PASSWORD_RULES.filter((rule) => !rule.test(values.password)).map(
    (rule) => rule.message,
  )
  if (passwordErrors.length > 0) errors.password = passwordErrors

  if (values.password !== values.passwordConfirmation) {
    errors.passwordConfirmation = ['Las contraseñas no coinciden.']
  }

  return errors
}
