import { describe, expect, it } from 'vitest'
import { validateLoginForm } from './validateLoginForm'

describe('validateLoginForm', () => {
  it('returns no errors for a filled, well-formed form', () => {
    expect(validateLoginForm({ email: 'ana@example.com', password: 'x' })).toEqual({})
  })

  it('requires the email and checks its format', () => {
    expect(validateLoginForm({ email: '', password: 'x' }).email).toEqual(['El email es obligatorio.'])
    expect(validateLoginForm({ email: 'nope', password: 'x' }).email).toEqual(['Ingresá un email válido.'])
  })

  it('requires the password but does not apply the strength rules', () => {
    expect(validateLoginForm({ email: 'ana@example.com', password: '' }).password).toEqual([
      'La contraseña es obligatoria.',
    ])
    expect(validateLoginForm({ email: 'ana@example.com', password: 'abc' }).password).toBeUndefined()
  })
})
