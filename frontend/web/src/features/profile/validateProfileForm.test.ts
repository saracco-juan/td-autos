import { describe, expect, it } from 'vitest'
import { validateProfileForm } from './validateProfileForm'

const valid = { name: 'Ana', apellido: 'Pérez' }

describe('validateProfileForm', () => {
  it('returns no errors for a filled form', () => {
    expect(validateProfileForm(valid)).toEqual({})
  })

  // TC-11
  it('requires the name', () => {
    expect(validateProfileForm({ ...valid, name: '' }).name).toEqual(['El nombre es obligatorio.'])
  })

  // TC-11
  it('requires the apellido', () => {
    expect(validateProfileForm({ ...valid, apellido: '' }).apellido).toEqual(['El apellido es obligatorio.'])
  })

  // TC-11
  it('reports both required fields at once', () => {
    expect(validateProfileForm({ name: '', apellido: '' })).toEqual({
      name: ['El nombre es obligatorio.'],
      apellido: ['El apellido es obligatorio.'],
    })
  })

  it('treats whitespace-only values as missing', () => {
    expect(validateProfileForm({ name: '   ', apellido: ' \t ' })).toEqual({
      name: ['El nombre es obligatorio.'],
      apellido: ['El apellido es obligatorio.'],
    })
  })

  it('accepts a name of 255 characters and rejects 256', () => {
    expect(validateProfileForm({ ...valid, name: 'a'.repeat(255) })).toEqual({})
    expect(validateProfileForm({ ...valid, name: 'a'.repeat(256) }).name).toEqual([
      'El nombre no puede superar los 255 caracteres.',
    ])
  })

  it('accepts an apellido of 100 characters and rejects 101', () => {
    expect(validateProfileForm({ ...valid, apellido: 'a'.repeat(100) })).toEqual({})
    expect(validateProfileForm({ ...valid, apellido: 'a'.repeat(101) }).apellido).toEqual([
      'El apellido no puede superar los 100 caracteres.',
    ])
  })
})
