import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../../lib/http'
import { fetchDiagnosis, saveDiagnosis } from './api'
import type { DiagnosisAnswers } from './types'

const answers: DiagnosisAnswers = {
  presupuesto: 'mas_40m',
  uso_principal: 'ciudad',
  pasajeros: '3_4',
  kilometros_mensuales: 'no_sabe',
  transmision: 'indiferente',
  prioridad: 'seguridad',
  carrocerias: [3, 4],
}

describe('diagnosis api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('fetchDiagnosis GETs /api/diagnostico and returns the answers and the catalog', async () => {
    const response = { diagnostico: null, carrocerias: [{ id: 1, nombre: 'Sedán' }] }
    vi.mocked(apiFetch).mockResolvedValue(response)

    await expect(fetchDiagnosis()).resolves.toEqual(response)
    expect(apiFetch).toHaveBeenCalledWith('/api/diagnostico')
  })

  // TC-12, TC-14
  it('saveDiagnosis PUTs /api/diagnostico with the answers and unwraps the saved ones', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ diagnostico: answers })

    await expect(saveDiagnosis(answers)).resolves.toEqual(answers)
    expect(apiFetch).toHaveBeenCalledWith('/api/diagnostico', { method: 'PUT', body: answers })
  })
})
