import { describe, expect, it } from 'vitest'
import { isActiveDealer, isAdmin, isBuyer, isDealer } from './roles'
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

  it('isBuyer is true only for the buyer role, never for another, a missing one or a guest', () => {
    expect(isBuyer(buyer)).toBe(true)
    expect(isBuyer(dealer('activa'))).toBe(false)
    expect(isBuyer({ ...buyer, rol: 'admin' })).toBe(false)
    expect(isBuyer({ ...buyer, rol: undefined as unknown as string })).toBe(false)
    expect(isBuyer(null)).toBe(false)
  })

  it('isActiveDealer is true only for a dealer whose state is activa', () => {
    expect(isActiveDealer(dealer('activa'))).toBe(true)
    expect(isActiveDealer(dealer('pendiente'))).toBe(false)
    expect(isActiveDealer(dealer(null))).toBe(false)
    expect(isActiveDealer({ ...buyer, rol: 'concesionaria' })).toBe(false)
    expect(isActiveDealer({ ...buyer, rol: 'concesionaria', concesionaria: null })).toBe(false)
    expect(isActiveDealer({ ...dealer('activa'), rol: 'comprador' })).toBe(false)
    expect(isActiveDealer(null)).toBe(false)
  })

  it('isAdmin is true only for the administrador role, never for another, a missing one or a guest', () => {
    expect(isAdmin({ ...buyer, rol: 'administrador' })).toBe(true)
    expect(isAdmin(buyer)).toBe(false)
    expect(isAdmin(dealer('activa'))).toBe(false)
    expect(isAdmin({ ...buyer, rol: 'admin' })).toBe(false)
    expect(isAdmin({ ...buyer, rol: undefined as unknown as string })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})
