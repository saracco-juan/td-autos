import { describe, expect, it } from 'vitest'
import { firstPendingStep, longestStepSize, pendingFlaggedByStep, summarizeChecklist } from './progress'
import type { ChecklistStep } from './types'

// Small catalog in the neutral shape: two steps, three flagged items (c1, c2, c4).
const steps: ChecklistStep[] = [
  {
    numero: 1,
    titulo: 'Papeles',
    ayuda: null,
    items: [
      { codigo: 'a1', texto: 'A1', flagged: false },
      { codigo: 'c1', texto: 'C1', flagged: true },
      { codigo: 'a2', texto: 'A2', flagged: false },
    ],
  },
  {
    numero: 2,
    titulo: 'Exterior',
    ayuda: 'Mirá el auto a la luz del día.',
    items: [
      { codigo: 'c2', texto: 'C2', flagged: true },
      { codigo: 'a3', texto: 'A3', flagged: false },
      { codigo: 'c4', texto: 'C4', flagged: true },
    ],
  },
]

const codes = (items: { codigo: string }[]) => items.map((item) => item.codigo)

describe('summarizeChecklist', () => {
  it('counts nothing as done when nothing is ticked', () => {
    const summary = summarizeChecklist(steps, [])

    expect(summary.total).toBe(6)
    expect(summary.completed).toBe(0)
    expect(summary.complete).toBe(false)
    expect(summary.steps).toEqual([
      { numero: 1, titulo: 'Papeles', completed: 0, total: 3 },
      { numero: 2, titulo: 'Exterior', completed: 0, total: 3 },
    ])
  })

  it('lists every pending item in catalog order, with the flagged ones counted apart', () => {
    const summary = summarizeChecklist(steps, [])

    expect(codes(summary.pending)).toEqual(['a1', 'c1', 'a2', 'c2', 'a3', 'c4'])
    expect(summary.pendingFlagged).toBe(3)
  })

  it('puts the flagged pending items first and keeps the catalog order inside each group', () => {
    const summary = summarizeChecklist(steps, [])

    expect(codes(summary.pendingFlaggedFirst)).toEqual(['c1', 'c2', 'c4', 'a1', 'a2', 'a3'])
  })

  it('reports a complete checklist when everything is ticked', () => {
    const summary = summarizeChecklist(steps, ['a1', 'c1', 'a2', 'c2', 'a3', 'c4'])

    expect(summary.completed).toBe(6)
    expect(summary.complete).toBe(true)
    expect(summary.pending).toEqual([])
    expect(summary.pendingFlaggedFirst).toEqual([])
    expect(summary.pendingFlagged).toBe(0)
    expect(summary.steps.map((step) => step.completed)).toEqual([3, 3])
  })

  it('has no flagged pending item when only unflagged ones are left', () => {
    const summary = summarizeChecklist(steps, ['c1', 'c2', 'c4'])

    expect(summary.completed).toBe(3)
    expect(summary.complete).toBe(false)
    expect(summary.pendingFlagged).toBe(0)
    expect(codes(summary.pending)).toEqual(['a1', 'a2', 'a3'])
    expect(codes(summary.pendingFlaggedFirst)).toEqual(['a1', 'a2', 'a3'])
  })

  it('counts the flagged pending items when only flagged ones are left', () => {
    const summary = summarizeChecklist(steps, ['a1', 'a2', 'a3', 'c2'])

    expect(summary.pendingFlagged).toBe(2)
    expect(codes(summary.pending)).toEqual(['c1', 'c4'])
    expect(codes(summary.pendingFlaggedFirst)).toEqual(['c1', 'c4'])
  })

  it('computes the progress of each step on its own', () => {
    const summary = summarizeChecklist(steps, ['a1', 'c1', 'c4'])

    expect(summary.steps).toEqual([
      { numero: 1, titulo: 'Papeles', completed: 2, total: 3 },
      { numero: 2, titulo: 'Exterior', completed: 1, total: 3 },
    ])
  })

  it('ignores codes that are not in the catalog and duplicated codes', () => {
    const summary = summarizeChecklist(steps, ['a1', 'a1', 'ghost'])

    expect(summary.completed).toBe(1)
    expect(summary.total).toBe(6)
    expect(summary.steps[0].completed).toBe(1)
    expect(codes(summary.pending)).toEqual(['c1', 'a2', 'c2', 'a3', 'c4'])
  })

  it('is neither complete nor pending anything when there are no steps', () => {
    const summary = summarizeChecklist([], ['ghost'])

    expect(summary).toEqual({
      total: 0,
      completed: 0,
      complete: false,
      steps: [],
      pending: [],
      pendingFlaggedFirst: [],
      pendingFlagged: 0,
    })
  })

  it('does not mutate its inputs', () => {
    const ticked = ['c1']
    summarizeChecklist(steps, ticked)

    expect(ticked).toEqual(['c1'])
    expect(codes(steps[0].items)).toEqual(['a1', 'c1', 'a2'])
  })
})

describe('pendingFlaggedByStep', () => {
  it('counts the flagged items still pending per step, leaving out the steps with none', () => {
    expect(pendingFlaggedByStep(steps, new Set(['c1']))).toEqual(
      new Map([[2, 2]]),
    )
    expect(pendingFlaggedByStep(steps, new Set())).toEqual(
      new Map([
        [1, 1],
        [2, 2],
      ]),
    )
  })

  it('is empty when every flagged item is ticked or the list is empty', () => {
    expect(pendingFlaggedByStep(steps, new Set(['c1', 'c2', 'c4'])).size).toBe(0)
    expect(pendingFlaggedByStep([], new Set()).size).toBe(0)
  })
})

describe('longestStepSize', () => {
  it('returns the item count of the longest step', () => {
    expect(longestStepSize([{ ...steps[0], items: steps[0].items.slice(0, 1) }, steps[1]])).toBe(3)
  })

  it('is 1 when there are no steps, so a sizing variable is never 0', () => {
    expect(longestStepSize([])).toBe(1)
  })
})

describe('firstPendingStep', () => {
  it('is the first step with an unticked item', () => {
    expect(firstPendingStep(steps, ['a1', 'c1', 'a2', 'c2'])).toBe(2)
  })

  it('is step 1 when nothing is ticked', () => {
    expect(firstPendingStep(steps, [])).toBe(1)
  })

  it('is step 1 when everything is ticked', () => {
    expect(firstPendingStep(steps, ['a1', 'c1', 'a2', 'c2', 'a3', 'c4'])).toBe(1)
  })

  it('is step 1 for an empty catalog', () => {
    expect(firstPendingStep([], [])).toBe(1)
  })
})
