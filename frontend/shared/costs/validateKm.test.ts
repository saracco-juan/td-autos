import { expect, it } from 'vitest'
import { KM_MAX_MESSAGE, KM_MIN_MESSAGE, validateKm } from './validateKm'

it.each([['0', 0], ['1500', 1500], [' 20000 ', 20000]])('accepts %s', (value, km) => {
  expect(validateKm(value)).toEqual({ km })
})

it.each(['', 'abc', '-5', '1.5', '1e3'])('rejects %s as not a whole number from 0', (value) => {
  expect(validateKm(value)).toEqual({ error: KM_MIN_MESSAGE })
})

it('rejects more than 20.000 km per month', () => {
  expect(validateKm('20001')).toEqual({ error: KM_MAX_MESSAGE })
})
