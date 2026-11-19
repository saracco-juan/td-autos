import { expect, it } from 'vitest'
import { fullName, profilePayload, validateProfileForm } from './form'

it('preserves both legacy fields on unchanged saves, even at their maximum lengths', () => {
  const user = { name: 'a'.repeat(255), apellido: 'b'.repeat(100) }
  expect(fullName(user)).toBe(`${user.name} ${user.apellido}`)
  const payload = profilePayload(fullName(user), user)
  expect(payload).toEqual(user)
  expect(validateProfileForm(payload)).toEqual({})
})

it('saves edited full names without splitting or duplicating surnames on subsequent edits', () => {
  const legacy = { name: 'Ana', apellido: 'Perez' }
  const payload = profilePayload('  Ana Maria Perez Diaz  ', legacy)
  expect(payload).toEqual({ name: 'Ana Maria Perez Diaz', apellido: '' })
  expect(fullName(payload)).toBe('Ana Maria Perez Diaz')
  expect(profilePayload(fullName(payload), payload)).toEqual(payload)
  expect(validateProfileForm(payload)).toEqual({})
})

it('accepts names without a separate surname and still requires a nonblank name', () => {
  expect(fullName({ name: 'Ana', apellido: null })).toBe('Ana')
  expect(fullName(null)).toBe('')
  expect(validateProfileForm({ name: 'Ana', apellido: '' })).toEqual({})
  expect(validateProfileForm({ name: ' ', apellido: '' })).toHaveProperty('name')
})
