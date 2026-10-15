import { describe, expect, it } from 'vitest'
import { dealerDetail } from './fixtures'
import { validateDealerForm } from './validateDealerForm'

const values = () => {
  const { id, estado_alta, suscripcion, comprobantes, ...form } = dealerDetail()
  void [id, estado_alta, suscripcion, comprobantes]
  return form
}

describe('validateDealerForm (TC-69, same limits and messages as the backend)', () => {
  it('accepts the data of a saved dealer', () => {
    expect(validateDealerForm(values())).toEqual({})
  })

  it.each([
    ['nombre', 'El nombre de la concesionaria es obligatorio.'],
    ['responsable_nombre', 'El nombre del responsable es obligatorio.'],
    ['responsable_apellido', 'El apellido es obligatorio.'],
    ['responsable_dni', 'El DNI es obligatorio.'],
    ['telefono_responsable', 'El teléfono del responsable es obligatorio.'],
    ['telefono_publico', 'El teléfono de la concesionaria es obligatorio.'],
    ['direccion', 'La dirección es obligatoria.'],
    ['localidad', 'La localidad es obligatoria.'],
    ['provincia', 'La provincia es obligatoria.'],
    ['email', 'El email es obligatorio.'],
  ] as const)('requires %s, also when it is only spaces', (field, message) => {
    expect(validateDealerForm({ ...values(), [field]: '' })).toEqual({ [field]: [message] })
    expect(validateDealerForm({ ...values(), [field]: '   ' })).toEqual({ [field]: [message] })
  })

  it.each([
    ['nombre', 150, 'El nombre de la concesionaria no puede superar los 150 caracteres.'],
    ['responsable_nombre', 255, 'El nombre del responsable no puede superar los 255 caracteres.'],
    ['responsable_apellido', 100, 'El apellido no puede superar los 100 caracteres.'],
    ['responsable_dni', 20, 'El DNI no puede superar los 20 caracteres.'],
    ['telefono_responsable', 30, 'El teléfono del responsable no puede superar los 30 caracteres.'],
    ['telefono_publico', 30, 'El teléfono de la concesionaria no puede superar los 30 caracteres.'],
    ['direccion', 255, 'La dirección no puede superar los 255 caracteres.'],
    ['localidad', 100, 'La localidad no puede superar los 100 caracteres.'],
    ['provincia', 100, 'La provincia no puede superar los 100 caracteres.'],
  ] as const)('limits %s to %i characters', (field, max, message) => {
    expect(validateDealerForm({ ...values(), [field]: 'a'.repeat(max) })).toEqual({})
    expect(validateDealerForm({ ...values(), [field]: 'a'.repeat(max + 1) })).toEqual({ [field]: [message] })
  })

  it('rejects an email without a valid format', () => {
    expect(validateDealerForm({ ...values(), email: 'sur-at-example' })).toEqual({ email: ['Ingresá un email válido.'] })
  })

  it('limits the email to 255 characters', () => {
    expect(validateDealerForm({ ...values(), email: `${'a'.repeat(250)}@b.co` })).toEqual({})
    expect(validateDealerForm({ ...values(), email: `${'a'.repeat(251)}@b.co` })).toEqual({
      email: ['El email no puede superar los 255 caracteres.'],
    })
  })

  it('reports every invalid field at once', () => {
    const errors = validateDealerForm({ ...values(), nombre: '', provincia: '' })
    expect(Object.keys(errors).sort()).toEqual(['nombre', 'provincia'])
  })
})
