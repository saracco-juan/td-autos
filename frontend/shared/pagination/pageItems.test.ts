import { expect, it } from 'vitest'
import { buildPageItems } from './pageItems'

it.each([
  [1, 1, 1, [1]],
  [1, 2, 0, [1, 2]],
  [1, 12, 1, [1, 2, 3, 4, 5, 'end-ellipsis', 12]],
  [6, 12, 1, [1, 'start-ellipsis', 5, 6, 7, 'end-ellipsis', 12]],
  [12, 12, 0, [1, 'start-ellipsis', 10, 11, 12]],
])('page %i of %i with %i siblings', (page, last, siblings, items) => {
  expect(buildPageItems(page, last, siblings)).toEqual(items)
})
