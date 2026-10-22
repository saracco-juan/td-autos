import { describe, expect, it } from 'vitest'
import { summarizeChecklist } from '../progress'
import { criticalWarning, pendingMarkerLabel, reviewedCounter } from './copy'
import { CRITICAL_CODES, STEPS } from './fixtures'
import { toChecklistSteps } from './steps'
import { summaryMessage, summaryPendingItems } from './summaryMessage'

const steps = toChecklistSteps(STEPS)
const allCodes = STEPS.flatMap((step) => step.items.map((item) => item.codigo))
const summaryOf = (codes: string[]) => summarizeChecklist(steps, codes)

describe('summaryMessage', () => {
  it('celebrates a complete inspection', () => {
    expect(summaryMessage(summaryOf(allCodes))).toEqual({
      tone: 'success',
      text: 'Inspección completa: revisaste los 10 puntos.',
    })
  })

  it('counts the pending points when none is critical', () => {
    expect(summaryMessage(summaryOf(allCodes.filter((code) => code !== 'papeles_vtv')))).toEqual({
      tone: 'warning',
      text: 'Inspección incompleta: te queda 1 punto sin revisar.',
    })
  })

  it('says every pending point is critical when that is the case', () => {
    expect(summaryMessage(summaryOf(allCodes.filter((code) => !CRITICAL_CODES.includes(code)))).text).toBe(
      'Inspección incompleta: te quedan 4 puntos críticos sin revisar.',
    )
  })

  it('says how many of the pending points are critical', () => {
    expect(summaryMessage(summaryOf([])).text).toBe(
      'Inspección incompleta: te quedan 10 puntos sin revisar, 4 de ellos críticos.',
    )
  })
})

describe('summaryPendingItems', () => {
  it('lists only the critical items while any is pending', () => {
    const pending = summaryPendingItems(summaryOf([]))

    expect(pending.critical).toBe(true)
    expect(pending.items.map((item) => item.codigo)).toEqual(CRITICAL_CODES)
  })

  it('lists every pending item when no critical one is left', () => {
    const pending = summaryPendingItems(summaryOf([...CRITICAL_CODES, 'papeles_vtv', 'exterior_luces']))

    expect(pending.critical).toBe(false)
    expect(pending.items.map((item) => item.codigo)).toEqual([
      'motor_aceite',
      'interior_testigos',
      'interior_kilometraje',
      'manejo_caja',
    ])
  })
})

describe('inspection copy', () => {
  it('words the critical warning in singular and plural', () => {
    expect(criticalWarning(1)).toBe(
      'Te queda 1 punto crítico sin revisar. Es el que más pesa a la hora de decidir: revisalo antes de terminar.',
    )
    expect(criticalWarning(3)).toBe(
      'Te quedan 3 puntos críticos sin revisar. Son los que más pesan a la hora de decidir: revisalos antes de terminar.',
    )
  })

  it('words the step marker and the counter', () => {
    expect(pendingMarkerLabel(1)).toBe('1 crítico pendiente')
    expect(pendingMarkerLabel(2)).toBe('2 críticos pendientes')
    expect(reviewedCounter(3, 10)).toBe('3 de 10 puntos revisados')
  })
})
