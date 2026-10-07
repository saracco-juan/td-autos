import { apiFetch } from '../../lib/http'
import type { User } from '../auth/types'
import type { ProfileValues } from './types'

export function updateProfile(values: ProfileValues): Promise<User> {
  return apiFetch<User>('/api/user', { method: 'PUT', body: values })
}
