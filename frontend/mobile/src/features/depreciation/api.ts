import type { DepreciationResponse } from '@shared/depreciation/types'
import type { AuthFetch } from '../../lib/http'

export function fetchDepreciation(request: AuthFetch, id: number): Promise<DepreciationResponse> {
  return request<DepreciationResponse>(`/api/vehiculos/${id}/depreciacion`)
}
