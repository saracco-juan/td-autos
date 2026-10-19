import { resolveApiUrl } from './config'

describe('resolveApiUrl', () => {
  it('falls back to the local backend when the variable is not set', () => {
    expect(resolveApiUrl(undefined)).toBe('http://localhost:8000')
  })

  it('returns the configured URL', () => {
    expect(resolveApiUrl('http://192.168.0.10:8000')).toBe('http://192.168.0.10:8000')
  })

  it('strips trailing slashes', () => {
    expect(resolveApiUrl('http://192.168.0.10:8000///')).toBe('http://192.168.0.10:8000')
  })
})
