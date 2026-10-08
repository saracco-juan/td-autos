import { describe, expect, it } from 'vitest'
import { VEHICLE_FALLBACK_TITLE, summarizeInspection, vehicleTitle } from './progress'
import type { InspectionStep } from './types'

// Small catalog in the real shape: two steps, three critical items (c1, c2, c4).
const steps: InspectionStep[] = [
  {
    numero: 1,
    titulo: 'Papeles',
    ayuda: null,
    items: [
      { codigo: 'a1', texto: 'A1', critico: false },
      { codigo: 'c1', texto: 'C1', critico: true },
      { codigo: 'a2', texto: 'A2', critico: false },
    ],
  },
  {
    numero: 2,
    titulo: 'Exterior',
    ayuda: 'Mirá el auto a la luz del día.',
    items: [
      { codigo: 'c2', texto: 'C2', critico: true },
      { codigo: 'a3', texto: 'A3', critico: false },
      { codigo: 'c4', texto: 'C4', critico: true },
    ],
  },
]

const codes = (items: { codigo: string }[]) => items.map((item) => item.codigo)

describe('summarizeInspection', () => {
  it('counts nothing as done when nothing is ticked', () => {
    const summary = summarizeInspection(steps, [])

    expect(summary.total).toBe(6)
    expect(summary.completed).toBe(0)
    expect(summary.complete).toBe(false)
    expect(summary.steps).toEqual([
      { numero: 1, titulo: 'Papeles', completed: 0, total: 3 },
      { numero: 2, titulo: 'Exterior', completed: 0, total: 3 },
    ])
  })

  it('lists every pending item in catalog order, with the critical ones counted apart', () => {
    const summary = summarizeInspection(steps, [])

    expect(codes(summary.pending)).toEqual(['a1', 'c1', 'a2', 'c2', 'a3', 'c4'])
    expect(summary.pendingCritical).toBe(3)
  })

  it('puts the critical pending items first and keeps the catalog order inside each group', () => {
    const summary = summarizeInspection(steps, [])

    expect(codes(summary.pendingCriticalFirst)).toEqual(['c1', 'c2', 'c4', 'a1', 'a2', 'a3'])
  })

  // TC-35
  it('reports a complete checklist when everything is ticked', () => {
    const summary = summarizeInspection(steps, ['a1', 'c1', 'a2', 'c2', 'a3', 'c4'])

    expect(summary.completed).toBe(6)
    expect(summary.complete).toBe(true)
    expect(summary.pending).toEqual([])
    expect(summary.pendingCriticalFirst).toEqual([])
    expect(summary.pendingCritical).toBe(0)
    expect(summary.steps.map((step) => step.completed)).toEqual([3, 3])
  })

  // Scenario 3: only non-critical items are pending
  it('has no critical pending item when only non-critical ones are left', () => {
    const summary = summarizeInspection(steps, ['c1', 'c2', 'c4'])

    expect(summary.completed).toBe(3)
    expect(summary.complete).toBe(false)
    expect(summary.pendingCritical).toBe(0)
    expect(codes(summary.pending)).toEqual(['a1', 'a2', 'a3'])
    expect(codes(summary.pendingCriticalFirst)).toEqual(['a1', 'a2', 'a3'])
  })

  // TC-37
  it('counts the critical pending items when only critical ones are left', () => {
    const summary = summarizeInspection(steps, ['a1', 'a2', 'a3', 'c2'])

    expect(summary.pendingCritical).toBe(2)
    expect(codes(summary.pending)).toEqual(['c1', 'c4'])
    expect(codes(summary.pendingCriticalFirst)).toEqual(['c1', 'c4'])
  })

  it('computes the progress of each step on its own', () => {
    const summary = summarizeInspection(steps, ['a1', 'c1', 'c4'])

    expect(summary.steps).toEqual([
      { numero: 1, titulo: 'Papeles', completed: 2, total: 3 },
      { numero: 2, titulo: 'Exterior', completed: 1, total: 3 },
    ])
  })

  it('ignores codes that are not in the catalog and duplicated codes', () => {
    const summary = summarizeInspection(steps, ['a1', 'a1', 'ghost'])

    expect(summary.completed).toBe(1)
    expect(summary.total).toBe(6)
    expect(summary.steps[0].completed).toBe(1)
    expect(codes(summary.pending)).toEqual(['c1', 'a2', 'c2', 'a3', 'c4'])
  })

  it('is neither complete nor pending anything when there are no steps', () => {
    const summary = summarizeInspection([], ['ghost'])

    expect(summary).toEqual({
      total: 0,
      completed: 0,
      complete: false,
      steps: [],
      pending: [],
      pendingCriticalFirst: [],
      pendingCritical: 0,
    })
  })

  it('does not mutate its inputs', () => {
    const ticked = ['c1']
    summarizeInspection(steps, ticked)

    expect(ticked).toEqual(['c1'])
    expect(codes(steps[0].items)).toEqual(['a1', 'c1', 'a2'])
  })
})

describe('vehicleTitle', () => {
  it('joins brand, model, version and year with single spaces', () => {
    expect(vehicleTitle({ marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021 })).toBe(
      'Toyota Corolla XEI 2021',
    )
  })

  it('skips the parts that are null or blank', () => {
    expect(vehicleTitle({ marca: 'Ford', modelo: 'Focus', version: null, anio: 2017 })).toBe(
      'Ford Focus 2017',
    )
    expect(vehicleTitle({ marca: 'Fiat', modelo: '  ', version: '', anio: null })).toBe('Fiat')
  })

  it('trims each part so the separators stay single spaces', () => {
    expect(vehicleTitle({ marca: ' Renault ', modelo: 'Sandero', version: null, anio: null })).toBe(
      'Renault Sandero',
    )
  })

  it('falls back to a neutral title when every part is missing', () => {
    const empty = { marca: null, modelo: null, version: null, anio: null }

    expect(vehicleTitle(empty)).toBe('Vehículo')
    expect(VEHICLE_FALLBACK_TITLE).toBe('Vehículo')
  })
})
