import { fetchDiagnosis, saveDiagnosis } from '../../../features/diagnosis/api'
import type { DiagnosisAnswers } from '@shared/diagnosis/types'

const answers: DiagnosisAnswers = {
  presupuesto: 'hasta_15m',
  uso_principal: 'ciudad',
  pasajeros: '1_2',
  kilometros_mensuales: 'no_sabe',
  transmision: 'indiferente',
  prioridad: 'seguridad',
  carrocerias: [1],
}

describe('diagnosis api', () => {
  it('fetches the saved diagnosis and the body-type catalog', async () => {
    const response = { diagnostico: null, carrocerias: [{ id: 1, nombre: 'Sedán' }] }
    const request = jest.fn().mockResolvedValue(response)

    await expect(fetchDiagnosis(request)).resolves.toEqual(response)
    expect(request).toHaveBeenCalledWith('/api/diagnostico')
  })

  it('saves the answers with PUT and returns the stored diagnosis', async () => {
    const request = jest.fn().mockResolvedValue({ diagnostico: answers })

    await expect(saveDiagnosis(request, answers)).resolves.toEqual(answers)
    expect(request).toHaveBeenCalledWith('/api/diagnostico', { method: 'PUT', body: answers })
  })

  it('propagates request failures', async () => {
    const request = jest.fn().mockRejectedValue(new Error('boom'))

    await expect(saveDiagnosis(request, answers)).rejects.toThrow('boom')
  })
})
