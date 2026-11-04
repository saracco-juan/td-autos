// Deliberately permissive: the server remains the authority on email validity.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Returns the error messages for an email field, or undefined when the value is acceptable.
export function validateEmail(value: string): string[] | undefined {
  const email = value.trim()
  if (email === '') return ['El email es obligatorio.']
  if (!EMAIL_PATTERN.test(email)) return ['Ingresá un email válido.']
  return undefined
}
