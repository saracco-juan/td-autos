const DEFAULT_API_URL = 'http://localhost:8000'

export function resolveApiUrl(raw?: string): string {
  return (raw ?? DEFAULT_API_URL).replace(/\/+$/, '')
}

export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL)
