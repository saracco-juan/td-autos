import { API_URL } from '../../lib/config'
import { apiFetch } from '../../lib/http'
import type { LoginCredentials, RegisterPayload, ResetPasswordPayload, User } from './types'

export const GOOGLE_REDIRECT_URL = `${API_URL}/auth/google/redirect`

export function registerUser(payload: RegisterPayload): Promise<User> {
  return apiFetch<User>('/register', { method: 'POST', body: payload })
}

export function fetchCurrentUser(): Promise<User> {
  return apiFetch<User>('/api/user')
}

export function loginUser(credentials: LoginCredentials): Promise<void> {
  return apiFetch<void>('/login', { method: 'POST', body: credentials })
}

export function logoutUser(): Promise<void> {
  return apiFetch<void>('/logout', { method: 'POST' })
}

type StatusResponse = { status: string }

export async function requestPasswordReset(email: string): Promise<string> {
  const { status } = await apiFetch<StatusResponse>('/forgot-password', { method: 'POST', body: { email } })
  return status
}

export async function resetPassword({ passwordConfirmation, ...rest }: ResetPasswordPayload): Promise<string> {
  const { status } = await apiFetch<StatusResponse>('/reset-password', {
    method: 'POST',
    body: { ...rest, password_confirmation: passwordConfirmation },
  })
  return status
}
