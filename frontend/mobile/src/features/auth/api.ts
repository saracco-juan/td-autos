import { apiFetch } from '../../lib/http'
import { DEVICE_NAME } from '../../lib/deviceName'
import type { LoginCredentials, RegisterPayload, TokenResponse, User } from './types'

export function loginWithPassword({ email, password }: LoginCredentials): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/api/mobile/login', {
    method: 'POST',
    body: { email, password, device_name: DEVICE_NAME },
  })
}

export function registerWithPassword({ passwordConfirmation, ...rest }: RegisterPayload): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/api/mobile/register', {
    method: 'POST',
    body: { ...rest, password_confirmation: passwordConfirmation, device_name: DEVICE_NAME },
  })
}

export function exchangeGoogleCode(code: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/api/mobile/google/exchange', {
    method: 'POST',
    body: { code, device_name: DEVICE_NAME },
  })
}

export function fetchCurrentUser(token: string): Promise<User> {
  return apiFetch<User>('/api/user', { token })
}

export function logoutRequest(token: string): Promise<void> {
  return apiFetch<void>('/api/mobile/logout', { method: 'POST', token })
}

export async function requestPasswordReset(email: string): Promise<string> {
  const { status } = await apiFetch<{ status: string }>('/api/mobile/forgot-password', {
    method: 'POST',
    body: { email },
  })
  return status
}
