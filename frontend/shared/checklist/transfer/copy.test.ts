import { describe, expect, it } from 'vitest'
import { completedCounter, mandatoryWarning, pendingMarkerLabel } from './copy'

describe('transfer copy', () => {
  it('counts the completed steps', () => {
    expect(completedCounter(3, 15)).toBe('3 de 15 pasos completados')
  })

  it('words the pending marker in singular and plural', () => {
    expect(pendingMarkerLabel(1)).toBe('1 paso obligatorio pendiente')
    expect(pendingMarkerLabel(3)).toBe('3 pasos obligatorios pendientes')
  })

  it('words the mandatory warning in singular and plural', () => {
    expect(mandatoryWarning(1)).toBe(
      'Te queda 1 paso obligatorio sin completar. El registro lo exige para hacer la transferencia: completalo antes de terminar.',
    )
    expect(mandatoryWarning(2)).toBe(
      'Te quedan 2 pasos obligatorios sin completar. El registro los exige para hacer la transferencia: completalos antes de terminar.',
    )
  })
})
