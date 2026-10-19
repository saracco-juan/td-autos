import { validateProfileForm } from '../../../features/profile/validation'

describe('validateProfileForm', () => {
  it('accepts a filled nombre and apellido', () => {
    expect(validateProfileForm({ name: 'Martín', apellido: 'Gómez' })).toEqual({})
  })

  it('TC-11: flags blank required fields, ignoring surrounding spaces', () => {
    expect(validateProfileForm({ name: '   ', apellido: '' })).toEqual({
      name: ['El nombre es obligatorio.'],
      apellido: ['El apellido es obligatorio.'],
    })
  })

  it('enforces the backend maximum lengths', () => {
    expect(validateProfileForm({ name: 'a'.repeat(255), apellido: 'b'.repeat(100) })).toEqual({})
    expect(validateProfileForm({ name: 'a'.repeat(256), apellido: 'b'.repeat(101) })).toEqual({
      name: ['El nombre no puede superar los 255 caracteres.'],
      apellido: ['El apellido no puede superar los 100 caracteres.'],
    })
  })

  it('measures the length after trimming, as the value that gets sent', () => {
    expect(validateProfileForm({ name: ` ${'a'.repeat(255)} `, apellido: 'Gómez' })).toEqual({})
  })
})
