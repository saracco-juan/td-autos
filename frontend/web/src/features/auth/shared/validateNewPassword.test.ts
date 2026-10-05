import { describe, expect, it } from 'vitest'
import { validateNewPassword } from './validateNewPassword'

describe('validateNewPassword', () => {
  it('returns no errors for a strong password that matches its confirmation', () => {
    expect(validateNewPassword('Abcdef12', 'Abcdef12')).toEqual({})
  })

  it('lists every unmet password rule under password', () => {
    expect(validateNewPassword('abc', 'abc')).toEqual({
      password: [
        'La contraseña debe tener al menos 8 caracteres.',
        'La contraseña debe incluir al menos una letra mayúscula.',
        'La contraseña debe incluir al menos un número.',
      ],
    })
  })

  it('flags a confirmation that does not match', () => {
    expect(validateNewPassword('Abcdef12', 'Abcdef13')).toEqual({
      passwordConfirmation: ['Las contraseñas no coinciden.'],
    })
  })

  it('reports both problems at once', () => {
    const errors = validateNewPassword('abc', 'abd')

    expect(errors.password).toHaveLength(3)
    expect(errors.passwordConfirmation).toEqual(['Las contraseñas no coinciden.'])
  })
})
