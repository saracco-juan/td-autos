import type { ProfileFieldErrors, ProfileValues } from './types'

const NAME_MAX_LENGTH = 255
const APELLIDO_MAX_LENGTH = 100

// Mirrors the backend rules of PUT /api/user on the trimmed values that get sent; the server stays the authority.
export function validateProfileForm(values: ProfileValues): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}
  const name = values.name.trim()
  const apellido = values.apellido.trim()

  if (name === '') errors.name = ['El nombre es obligatorio.']
  else if (name.length > NAME_MAX_LENGTH) {
    errors.name = [`El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres.`]
  }

  if (apellido === '') errors.apellido = ['El apellido es obligatorio.']
  else if (apellido.length > APELLIDO_MAX_LENGTH) {
    errors.apellido = [`El apellido no puede superar los ${APELLIDO_MAX_LENGTH} caracteres.`]
  }

  return errors
}
