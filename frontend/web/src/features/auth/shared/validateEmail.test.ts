import { describe, expect, it } from 'vitest'
import { validateEmail } from './validateEmail'

describe('validateEmail', () => {
  it('requires a value', () => {
    expect(validateEmail('')).toEqual(['El email es obligatorio.'])
    expect(validateEmail('   ')).toEqual(['El email es obligatorio.'])
  })

  it('rejects a malformed address', () => {
    expect(validateEmail('no-es-email')).toEqual(['Ingresá un email válido.'])
    expect(validateEmail('a@b')).toEqual(['Ingresá un email válido.'])
  })

  it('accepts a well-formed address, ignoring surrounding spaces', () => {
    expect(validateEmail(' ana@example.com ')).toBeUndefined()
  })
})
