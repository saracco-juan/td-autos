import { describe, expect, it } from 'vitest'
import { dealerLocation, dealerState, formatDay, receiptState, receiptTarget, validateRejectReason } from './format'
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

  it.each([
    ['pendiente de revisión', 'Pendiente de revisión'],
    ['aprobado', 'Aprobado'],
    ['rechazado', 'Rechazado'],
  ] as const)('receiptState maps %s to %s', (estado, label) => {
    expect(receiptState(estado)).toBe(label)
  })

  it('formatDay turns a yyyy-mm-dd day into dd/mm/aaaa without moving it across time zones', () => {
    expect(formatDay('2026-10-01')).toBe('01/10/2026')
    expect(formatDay('2026-12-31')).toBe('31/12/2026')
  })

  it('TC-50: validateRejectReason asks for a reason when it is empty or only spaces', () => {
    expect(validateRejectReason('')).toBe('Ingresá el motivo del rechazo.')
    expect(validateRejectReason('   \n ')).toBe('Ingresá el motivo del rechazo.')
  })

  it('validateRejectReason accepts up to 500 characters once trimmed and rejects longer reasons', () => {
    expect(validateRejectReason(`  ${'a'.repeat(500)}  `)).toBeUndefined()
    expect(validateRejectReason('a'.repeat(501))).toBe('El motivo no puede superar los 500 caracteres.')
    expect(validateRejectReason('El monto no coincide.')).toBeUndefined()
  })
})
