import { describe, expect, it } from 'vitest'
import { toChecklistSteps } from './steps'
import { STEPS } from './fixtures'

describe('toChecklistSteps', () => {
  it('maps the critico flag of every item to the neutral flagged flag, keeping the rest', () => {
    const steps = toChecklistSteps(STEPS)

    expect(steps).toHaveLength(5)
    expect(steps[0]).toEqual({
      numero: 1,
      titulo: 'Papeles del auto',
      ayuda: 'Pedile al vendedor la cédula y el título del auto.',
      items: [
        { codigo: 'papeles_titular', texto: 'El titular coincide con el vendedor', flagged: true },
        { codigo: 'papeles_vtv', texto: 'La VTV está vigente', flagged: false },
      ],
    })
    expect(steps[3].ayuda).toBeNull()
  })

  it('returns an empty list for no steps', () => {
    expect(toChecklistSteps([])).toEqual([])
  })
})
