import { expect, it } from 'vitest'
import { entry } from '../../web/src/test/comparison'
import { comparisonGroups } from './groups'

it('hides resale refresh notices while preserving other comparison warnings and scores', () => {
  const original = entry()
  const recommendation = { ...original.recommendation!, warnings: ['resale_stale' as const] }
  const stale = comparisonGroups({ ...original, recommendation })
  expect(stale).toEqual(comparisonGroups(original))
  const mixed = comparisonGroups({ ...original, recommendation: {
    ...recommendation, warnings: ['resale_stale', 'budget_exceeded', 'body_mismatch', 'resale_unavailable'],
  } })
  const diagnosis = mixed.find(({ title }) => title === 'Ventajas según tu diagnóstico')!
  expect(diagnosis.rows.find(({ label }) => label === 'Advertencias')?.value).toBe(
    'Supera tu presupuesto. No coincide con tu carrocería. Reventa no disponible: compatibilidad parcial.',
  )
  expect(recommendation.warnings).toEqual(['resale_stale'])
})

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
