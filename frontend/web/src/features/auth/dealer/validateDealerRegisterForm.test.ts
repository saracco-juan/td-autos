import { describe, expect, it } from 'vitest'
import { validateDealerRegisterForm, type DealerRegisterFormValues } from './validateDealerRegisterForm'

const valid: DealerRegisterFormValues = {
  dealerName: 'Autos del Sur',
  email: 'marta@autosdelsur.com',
  name: 'Marta',
  lastName: 'Gómez',
  dni: '30111222',
  contactPhone: '1144445555',
  publicPhone: '1143210000',
  address: 'Av. Mitre 1234',
  city: 'Avellaneda',
  province: 'Buenos Aires',
  password: 'Abcdef12',
  passwordConfirmation: 'Abcdef12',
}

describe('validateDealerRegisterForm', () => {
  it('returns no errors for valid values', () => {
    expect(validateDealerRegisterForm(valid)).toEqual({})
  })

  // TC-80: every RF15 field is required.
  it.each([
    ['dealerName', 'El nombre de la concesionaria es obligatorio.'],
    ['name', 'El nombre es obligatorio.'],
    ['lastName', 'El apellido es obligatorio.'],
    ['dni', 'El DNI es obligatorio.'],
    ['contactPhone', 'El teléfono del responsable es obligatorio.'],
    ['publicPhone', 'El teléfono de la concesionaria es obligatorio.'],
    ['address', 'La dirección es obligatoria.'],
    ['city', 'La localidad es obligatoria.'],
    ['province', 'La provincia es obligatoria.'],
  ] as const)('TC-80: requires %s, ignoring surrounding spaces', (field, message) => {
    expect(validateDealerRegisterForm({ ...valid, [field]: '   ' })).toEqual({ [field]: [message] })
  })

  it('requires a valid email', () => {
    expect(validateDealerRegisterForm({ ...valid, email: '' })).toEqual({ email: ['El email es obligatorio.'] })
    expect(validateDealerRegisterForm({ ...valid, email: 'no-es-email' })).toEqual({
      email: ['Ingresá un email válido.'],
    })
  })

  it('lists every unmet password requirement together', () => {
    const errors = validateDealerRegisterForm({ ...valid, password: 'abc', passwordConfirmation: 'abc' })

    expect(errors.password).toEqual([
      'La contraseña debe tener al menos 8 caracteres.',
      'La contraseña debe incluir al menos una letra mayúscula.',
      'La contraseña debe incluir al menos un número.',
    ])
  })

  it('flags a confirmation mismatch', () => {
    expect(validateDealerRegisterForm({ ...valid, passwordConfirmation: 'Abcdef13' })).toEqual({
      passwordConfirmation: ['Las contraseñas no coinciden.'],
    })
  })

  it('reports every empty field at once', () => {
    const empty = Object.fromEntries(Object.keys(valid).map((field) => [field, ''])) as DealerRegisterFormValues

    expect(Object.keys(validateDealerRegisterForm(empty)).sort()).toEqual(
      Object.keys(valid)
        .filter((field) => field !== 'passwordConfirmation')
        .sort(),
    )
  })
})
