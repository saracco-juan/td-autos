import { describe, expect, it } from 'vitest'
import { validateRegisterForm, type RegisterFormValues } from './validateRegisterForm'

const valid: RegisterFormValues = {
  name: 'Ana',
  email: 'ana@example.com',
  password: 'Abcdef12',
  passwordConfirmation: 'Abcdef12',
}

describe('validateRegisterForm', () => {
  it('returns no errors for valid values', () => {
    expect(validateRegisterForm(valid)).toEqual({})
  })

  it('requires Nombre completo', () => {
    expect(validateRegisterForm({ ...valid, name: '   ' })).toEqual({ name: ['El nombre es obligatorio.'] })
  })

  it('requires a valid email', () => {
    expect(validateRegisterForm({ ...valid, email: '' })).toEqual({ email: ['El email es obligatorio.'] })
    expect(validateRegisterForm({ ...valid, email: 'no-es-email' })).toEqual({
      email: ['Ingresá un email válido.'],
    })
  })

  it('lists every unmet password requirement together', () => {
    const errors = validateRegisterForm({ ...valid, password: 'abc', passwordConfirmation: 'abc' })

    expect(errors.password).toEqual([
      'La contraseña debe tener al menos 8 caracteres.',
      'La contraseña debe incluir al menos una letra mayúscula.',
      'La contraseña debe incluir al menos un número.',
    ])
  })

  it('flags a confirmation mismatch', () => {
    expect(validateRegisterForm({ ...valid, passwordConfirmation: 'Abcdef13' })).toEqual({
      passwordConfirmation: ['Las contraseñas no coinciden.'],
    })
  })
})
