import { describe, expect, it } from 'vitest'
import { toChecklistSteps } from './checklistSteps'
import { MANDATORY_CODES, STAGES } from './fixtures'

describe('toChecklistSteps', () => {
  it('maps the obligatorio flag of every item to the neutral flagged flag, keeping the rest', () => {
    const steps = toChecklistSteps(STAGES)

    expect(steps).toHaveLength(4)
    expect(steps[0].items[0]).toEqual({
      codigo: 'antes_informe_dominio',
      texto: 'Pedí el informe de dominio del auto',
      flagged: false,
    })
    expect(steps[1].ayuda).toBe('Juntá estos papeles antes de ir al registro.')
    expect(steps[2].ayuda).toBeNull()
    const flagged = steps.flatMap((step) => step.items).filter((item) => item.flagged)
    expect(flagged.map((item) => item.codigo)).toEqual(MANDATORY_CODES)
  })

  it('returns an empty list for no stages', () => {
    expect(toChecklistSteps([])).toEqual([])
  })
})
