import { apiFetch } from '../../lib/http'
import type { DiagnosisAnswers, DiagnosisResponse } from '@shared/diagnosis/types'

export function fetchDiagnosis(): Promise<DiagnosisResponse> {
  return apiFetch<DiagnosisResponse>('/api/diagnostico')
}

export async function saveDiagnosis(answers: DiagnosisAnswers): Promise<DiagnosisAnswers> {
  const response = await apiFetch<{ diagnostico: DiagnosisAnswers }>('/api/diagnostico', {
    method: 'PUT',
    body: answers,
  })
  return response.diagnostico
}
