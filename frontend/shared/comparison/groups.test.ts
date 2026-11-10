import { expect, it } from 'vitest'
import { entry } from '../../web/src/test/comparison'
import { comparisonGroups } from './groups'

it('leaves recommendation-derived comparison values unavailable without a recommendation', () => {
  const groups = comparisonGroups({ ...entry(), recommendation: null })
  const publication = groups.find(({ title }) => title === 'Publicación')!
  const diagnosis = groups.find(({ title }) => title === 'Ventajas según tu diagnóstico')!

  expect(publication.rows.find(({ label }) => label === 'Coincidencia')?.value).toBe('No disponible')
  expect(diagnosis.rows.map(({ value }) => value)).toEqual(Array(5).fill('No disponible'))
})

it('preserves recommendation-derived values for existing recommendation comparisons', () => {
  const groups = comparisonGroups(entry())
  const publication = groups.find(({ title }) => title === 'Publicación')!
  const diagnosis = groups.find(({ title }) => title === 'Ventajas según tu diagnóstico')!

  expect(publication.rows.find(({ label }) => label === 'Coincidencia')?.value).toBe('90%')
  expect(diagnosis.rows.map(({ value }) => value)).toEqual([
    '80/100', '100/100', 'No disponible', '60/100', 'Sin advertencias de compatibilidad.',
  ])
})
