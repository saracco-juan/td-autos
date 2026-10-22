import type { AuthFetch } from '../../lib/http'
import type { DiagnosisAnswers, DiagnosisResponse } from '@shared/diagnosis/types'

// `request` is the session's authFetch (useAuth), so both calls carry the bearer token.
export function fetchDiagnosis(request: AuthFetch): Promise<DiagnosisResponse> {
  return request<DiagnosisResponse>('/api/diagnostico')
}

export async function saveDiagnosis(request: AuthFetch, answers: DiagnosisAnswers): Promise<DiagnosisAnswers> {
  const response = await request<{ diagnostico: DiagnosisAnswers }>('/api/diagnostico', {
    method: 'PUT',
    body: answers,
  })
  return response.diagnostico
}
