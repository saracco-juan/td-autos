import { apiFetch } from '../../../lib/http'
import type { DealerProfile, DealerProfileValues } from '../model/profile'

const endpoint = '/api/concesionaria/perfil'

export const fetchDealerProfile = () => apiFetch<DealerProfile>(endpoint)
export const updateDealerProfile = (values: DealerProfileValues) =>
  apiFetch<DealerProfile>(endpoint, { method: 'PUT', body: values })
