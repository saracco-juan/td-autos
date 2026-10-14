import { describe, expect, it } from 'vitest'
import { isActiveDealer, isDealer } from './roles'
import type { User } from './types'

const buyer: User = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', perfil_completo: false, tiene_diagnostico: true }

const dealer = (estado_alta: string | null): User => ({
  ...buyer,
  rol: 'concesionaria',
  concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta },
})

describe('roles', () => {
  it('isDealer tells the dealer role apart from buyers and guests', () => {
    expect(isDealer(dealer('pendiente'))).toBe(true)
    expect(isDealer(buyer)).toBe(false)
    expect(isDealer(null)).toBe(false)
  })

  it('isActiveDealer is true only for a dealer whose state is activa', () => {
    expect(isActiveDealer(dealer('activa'))).toBe(true)
    expect(isActiveDealer(dealer('pendiente'))).toBe(false)
    expect(isActiveDealer(dealer(null))).toBe(false)
    expect(isActiveDealer({ ...buyer, rol: 'concesionaria' })).toBe(false)
    expect(isActiveDealer({ ...dealer('activa'), rol: 'comprador' })).toBe(false)
    expect(isActiveDealer(null)).toBe(false)
  })
})
