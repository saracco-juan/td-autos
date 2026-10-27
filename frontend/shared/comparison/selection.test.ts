import { expect, it } from 'vitest'
import { canCompare, readSelection, toggleSelection } from './selection'

it('HU08 TC-23 accepts exactly two distinct positive listing IDs in selection order', () => {
  expect(readSelection('7,3')).toEqual([7, 3])
  expect(canCompare([7, 3])).toBe(true)
  expect(toggleSelection([7], 3)).toEqual({ ids: [7, 3], rejected: false })
})

it('HU08 TC-24 rejects a third without replacing, reordering or mutating the pair', () => {
  const selected = Object.freeze([7, 3])
  expect(toggleSelection(selected, 9)).toEqual({ ids: [7, 3], rejected: true })
  expect(selected).toEqual([7, 3])
})

it('HU08 TC-25 removes either selection and permits a replacement', () => {
  expect(toggleSelection([7, 3], 7)).toEqual({ ids: [3], rejected: false })
  expect(toggleSelection([7, 3], 3)).toEqual({ ids: [7], rejected: false })
  expect(toggleSelection([3], 9)).toEqual({ ids: [3, 9], rejected: false })
})

it.each([null, '', '7', '7,7', '0,3', '-1,3', 'x,3', '7,3,9', '7.5,3', '1e2,3'])
('HU08 TC-76 never compares an incomplete or malformed URL selection: %s', (raw) => {
  expect(canCompare(readSelection(raw))).toBe(false)
})
