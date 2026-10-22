import { describe, expect, it } from 'vitest'
import { advisorUrl } from './advisor'

describe('advisorUrl', () => {
  // TC-86
  it('builds the wa.me link from the digits', () => {
    expect(advisorUrl('5491155550000')).toBe('https://wa.me/5491155550000')
  })

  it('keeps only the digits, so the number cannot change the URL', () => {
    expect(advisorUrl('+54 9 11/5555?x=1')).toBe('https://wa.me/5491155551')
  })

  it('is null when the number has no digits', () => {
    expect(advisorUrl('')).toBeNull()
    expect(advisorUrl('abc')).toBeNull()
  })
})
