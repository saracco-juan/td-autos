import { PASSWORD_RULES } from '../passwordRules'
import type { FieldErrors } from '../types'

// Client checks for a password being chosen (register, reset): strength rules plus the confirmation match.
export function validateNewPassword(password: string, passwordConfirmation: string): FieldErrors {
  const errors: FieldErrors = {}

  const passwordErrors = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message)
  if (passwordErrors.length > 0) errors.password = passwordErrors

  if (password !== passwordConfirmation) {
    errors.passwordConfirmation = ['Las contraseñas no coinciden.']
  }

  return errors
}
