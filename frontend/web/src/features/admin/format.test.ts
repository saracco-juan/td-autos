import { describe, expect, it } from 'vitest'
import { dealerLocation, dealerState, receiptTarget } from './format'
import { dealerRow } from './fixtures'

describe('admin format', () => {
  it.each([
    ['pendiente', 'Pendiente de aprobación', 'pending'],
    ['activa', 'Activa', 'active'],
    ['inactiva', 'Inactiva', 'inactive'],
  ])('dealerState maps %s to the Figma label %s', (estado, label, tone) => {
    expect(dealerState(estado)).toEqual({ label, tone })
  })

  it('dealerState shows an unknown or missing state as is, without a tone', () => {
    expect(dealerState('suspendida')).toEqual({ label: 'suspendida', tone: 'unknown' })
    expect(dealerState(null)).toEqual({ label: 'Sin estado', tone: 'unknown' })
  })

  it('dealerLocation joins locality and province, once when they are the same, and skips the missing one', () => {
    expect(dealerLocation({ localidad: 'Rosario', provincia: 'Santa Fe' })).toBe('Rosario, Santa Fe')
    expect(dealerLocation({ localidad: 'Córdoba', provincia: 'Córdoba' })).toBe('Córdoba')
    expect(dealerLocation({ localidad: 'CABA', provincia: null })).toBe('CABA')
    expect(dealerLocation({ localidad: null, provincia: null })).toBe('')
  })

  it('receiptTarget prefers the pending receipt, then the latest one, else none', () => {
    expect(receiptTarget(dealerRow({ comprobante_pendiente_id: 31, ultimo_comprobante_id: 40 }))).toBe(31)
    expect(receiptTarget(dealerRow({ comprobante_pendiente_id: null, ultimo_comprobante_id: 27 }))).toBe(27)
    expect(receiptTarget(dealerRow({ comprobante_pendiente_id: null, ultimo_comprobante_id: null }))).toBeNull()
  })
})
