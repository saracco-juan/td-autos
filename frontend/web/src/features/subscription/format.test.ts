import { describe, expect, it } from 'vitest'
import { formatMonthlyAmount, formatSentDate } from './format'

describe('formatSentDate', () => {
  it('formats the instant as dd/mm/aaaa in the local time zone', () => {
    // Built from local parts so the expectation does not depend on the machine time zone.
    expect(formatSentDate(new Date(2026, 9, 4, 12).toISOString())).toBe('04/10/2026')
    expect(formatSentDate(new Date(2026, 0, 31, 0, 30).toISOString())).toBe('31/01/2026')
  })
})

describe('formatMonthlyAmount', () => {
  it.each([
    ['25000', '$ 25.000'],
    ['25000.00', '$ 25.000'],
    ['1250000', '$ 1.250.000'],
  ])('formats %s as %s', (amount, expected) => {
    expect(formatMonthlyAmount(amount)).toBe(expected)
  })

  it('keeps a value that is not a number as it came', () => {
    expect(formatMonthlyAmount('a convenir')).toBe('a convenir')
  })
})
