import { PASSWORD_RULES } from './passwordRules'
import type { FieldErrors } from './types'

// Deliberately permissive: the server remains the authority on email validity.
// One "@" with text on both sides, no whitespace, and a dot inside the domain.
// Checked without a regex so the cost stays linear in the input length.
function looksLikeEmail(email: string): boolean {
  if (/\s/.test(email)) return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return local !== '' && domain.slice(1, -1).includes('.')
}

// Returns the error messages for an email field, or undefined when the value is acceptable.
export function validateEmail(value: string): string[] | undefined {
  const email = value.trim()
  if (email === '') return ['El email es obligatorio.']
  if (!looksLikeEmail(email)) return ['Ingresá un email válido.']
  return undefined
}

// Client checks for a password being chosen: strength rules plus the confirmation match.
export function validateNewPassword(password: string, passwordConfirmation: string): FieldErrors {
  const errors: FieldErrors = {}

  const passwordErrors = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message)
  if (passwordErrors.length > 0) errors.password = passwordErrors

  if (password !== passwordConfirmation) errors.passwordConfirmation = ['Las contraseñas no coinciden.']

  return errors
}

export type LoginFormValues = { email: string; password: string }

// Only presence is checked for the password: strength rules apply when it is created, not when it is used.
export function validateLoginForm(values: LoginFormValues): FieldErrors {
  const errors: FieldErrors = {}

  const emailErrors = validateEmail(values.email)
  if (emailErrors) errors.email = emailErrors
  if (values.password === '') errors.password = ['La contraseña es obligatoria.']

  return errors
}

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
