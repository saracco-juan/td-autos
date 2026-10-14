import { apiFetch } from '../../lib/http'
import type { DealerDirectory } from './types'

export function fetchDealerDirectory(): Promise<DealerDirectory> {
  return apiFetch<DealerDirectory>('/api/admin/concesionarias')
}
