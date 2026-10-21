import { describe, expect, it } from 'vitest'
import { summarizeChecklist } from '../progress'
import { ALL_CODES, MANDATORY_CODES, STAGES } from './fixtures'
import { toChecklistSteps } from './steps'
import { summaryMessage, summaryPendingItems } from './summaryMessage'

const steps = toChecklistSteps(STAGES)
const allExcept = (...pending: string[]) => ALL_CODES.filter((code) => !pending.includes(code))
const messageFor = (completed: string[]) => summaryMessage(summarizeChecklist(steps, completed))

describe('summaryMessage', () => {
  it('complete: success tone, counting the steps', () => {
    expect(messageFor(ALL_CODES)).toEqual({
      tone: 'success',
      text: 'Trámite completo: completaste los 15 pasos.',
    })
  })

  it('no mandatory pending: plural', () => {
    expect(messageFor(MANDATORY_CODES)).toEqual({
      tone: 'warning',
      text: 'Trámite incompleto: te quedan 7 pasos sin completar.',
    })
  })

  it('no mandatory pending: singular', () => {
    expect(messageFor(allExcept('despues_seguro')).text).toBe('Trámite incompleto: te queda 1 paso sin completar.')
  })

  it('mandatory and optional pending: counts both, plural', () => {
    expect(messageFor(allExcept('documentacion_dni', 'documentacion_cedula', 'despues_seguro')).text).toBe(
      'Trámite incompleto: te quedan 3 pasos sin completar, 2 de ellos obligatorios.',
    )
  })

  it('mandatory and optional pending: one mandatory, singular', () => {
    expect(messageFor(allExcept('documentacion_dni', 'despues_seguro')).text).toBe(
      'Trámite incompleto: te quedan 2 pasos sin completar, 1 de ellos obligatorio.',
    )
  })

  it('every pending step is mandatory, several: still counts them as "de ellos"', () => {
    expect(messageFor(allExcept('documentacion_dni', 'documentacion_cedula')).text).toBe(
      'Trámite incompleto: te quedan 2 pasos sin completar, 2 de ellos obligatorios.',
    )
  })

  it('the only pending step is mandatory', () => {
    expect(messageFor(allExcept('documentacion_dni')).text).toBe(
      'Trámite incompleto: te queda 1 paso sin completar, y es obligatorio.',
    )
  })
})

describe('summaryPendingItems', () => {
  const itemsFor = (completed: string[]) => summaryPendingItems(summarizeChecklist(steps, completed))

  it('lists only the mandatory items while any is pending', () => {
    const { mandatory, items } = itemsFor(allExcept('documentacion_dni', 'despues_seguro'))

    expect(mandatory).toBe(true)
    expect(items.map((item) => item.codigo)).toEqual(['documentacion_dni'])
  })

  it('lists every pending item, in catalog order, once no mandatory one is pending', () => {
    const { mandatory, items } = itemsFor(MANDATORY_CODES)

    expect(mandatory).toBe(false)
    expect(items).toHaveLength(7)
    expect(items[0].codigo).toBe('antes_informe_dominio')
  })

  it('is empty when everything is ticked', () => {
    expect(itemsFor(ALL_CODES)).toEqual({ mandatory: false, items: [] })
  })
})
