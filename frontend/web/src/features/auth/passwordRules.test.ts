import { describe, expect, it } from 'vitest'
import { PASSWORD_RULES, unmetPasswordRules } from './passwordRules'

describe('unmetPasswordRules', () => {
  it('fails min_length at 7 characters and passes at 8', () => {
    expect(unmetPasswordRules('Abcdef1')).toEqual(['min_length'])
    expect(unmetPasswordRules('Abcdefg1')).toEqual([])
  })

  it('reports each composition rule individually', () => {
    expect(unmetPasswordRules('abcdefg1')).toEqual(['uppercase'])
    expect(unmetPasswordRules('ABCDEFG1')).toEqual(['lowercase'])
    expect(unmetPasswordRules('Abcdefgh')).toEqual(['number'])
  })

  it('counts accented letters by Unicode category', () => {
    expect(unmetPasswordRules('Ñandú123')).toEqual([])
    expect(unmetPasswordRules('ÑANDÚ123')).toEqual(['lowercase'])
    expect(unmetPasswordRules('ñandú123')).toEqual(['uppercase'])
  })

  it('counts length in code points, not UTF-16 units', () => {
    expect(unmetPasswordRules('Ñandú12')).toEqual(['min_length'])
    // 8 code points where the emoji takes two UTF-16 units: still valid.
    expect(unmetPasswordRules('Abcde1😀')).toEqual(['min_length'])
    expect(unmetPasswordRules('Abcdef1😀')).toEqual([])
  })

  it('reports every unmet requirement together, in rule order', () => {
    expect(unmetPasswordRules('abc')).toEqual(['min_length', 'uppercase', 'number'])
    expect(unmetPasswordRules('')).toEqual(['min_length', 'uppercase', 'lowercase', 'number'])
  })
})

describe('PASSWORD_RULES', () => {
  it('exposes the same ids and Spanish messages as the backend rule', () => {
    expect(PASSWORD_RULES.map(({ id, message }) => [id, message])).toEqual([
      ['min_length', 'La contraseña debe tener al menos 8 caracteres.'],
      ['uppercase', 'La contraseña debe incluir al menos una letra mayúscula.'],
      ['lowercase', 'La contraseña debe incluir al menos una letra minúscula.'],
      ['number', 'La contraseña debe incluir al menos un número.'],
    ])
  })
})
