import { describe, expect, it } from 'vitest'
import { detailSections, equipmentValue, specificationGroups, type DetailVehicle } from './detail'
import { EQUIPMENT_GROUPS } from './equipment'
import { vehicle } from './fixtures'

describe('HU09 / RF08 comprehensible technical facts', () => {
  it('TC-26 shows complete facts with units and nontechnical explanations', () => {
    const groups = specificationGroups(vehicle)
    const rows = groups.flatMap((group) => group.rows)
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Kilometraje', value: '62.000 km' }),
      expect.objectContaining({ label: 'Transmisión', value: 'Automática' }),
      expect.objectContaining({ label: 'Motor', value: '2.0' }),
      expect.objectContaining({ label: 'Potencia', value: '170 CV' }),
      expect.objectContaining({ label: 'Consumo en ciudad', value: '8,5 L/100 km' }),
      expect.objectContaining({ label: 'Turbo', value: 'No' }),
    ]))
    expect(rows.find((row) => row.label === 'Potencia')?.explanation).toMatch(/no indica el consumo/)
    expect(rows.find((row) => row.label === 'Consumo en ciudad')?.explanation).toMatch(/100 km/)
  })

  it('TC-27 never fabricates values or treats missing data as zero', () => {
    const incomplete = Object.fromEntries(Object.keys(vehicle).map((key) => [key, null]))
    const rows = specificationGroups(incomplete as unknown as DetailVehicle).flatMap((group) => group.rows)
    expect(rows.every((row) => row.value === 'No disponible')).toBe(true)
    expect(equipmentValue(null)).toBe('No disponible')
    expect(equipmentValue(undefined)).toBe('No disponible')
    expect(equipmentValue(false)).toBe('No')
    expect(equipmentValue(true)).toBe('Sí')
  })

  it('retains explicit zero values and avoids assigning liters to GNC or electric consumption', () => {
    const rows = specificationGroups({ ...vehicle, kilometraje: 0, consumo_urbano: 0 }).flatMap((group) => group.rows)
    expect(rows.find((row) => row.label === 'Kilometraje')?.value).toBe('0 km')
    expect(rows.find((row) => row.label === 'Consumo en ciudad')?.value).toBe('0 L/100 km')
    for (const combustible of ['gnc', 'electrico'] as const) {
      const alternative = specificationGroups({ ...vehicle, combustible }).flatMap((group) => group.rows)
      expect(alternative.find((row) => row.label === 'Consumo en ciudad')?.value).toBe('8,5 (unidad no informada)')
    }
  })
})

describe('HU09 four specification sections', () => {
  it('orders general info, engine, safety and comfort', () => {
    expect(detailSections(vehicle).map((section) => section.title))
      .toEqual(['Información general', 'Motor y consumo', 'Seguridad', 'Confort'])
  })

  it('lists every equipment feature with its glossary explanation', () => {
    const [, , safety, comfort] = detailSections({ ...vehicle, frenos_abs: true, isofix: false })
    expect(safety.rows).toHaveLength(EQUIPMENT_GROUPS.Seguridad.length)
    expect(comfort.rows).toHaveLength(EQUIPMENT_GROUPS.Confort.length)
    expect(safety.rows.find((row) => row.label === 'Frenos ABS')).toEqual(expect.objectContaining({
      value: 'Sí', explanation: expect.stringMatching(/bloqueen/) }))
    expect(safety.rows.find((row) => row.label === 'Anclajes ISOFIX')?.value).toBe('No')
    expect(safety.rows.every((row) => row.explanation)).toBe(true)
  })

  it('reports unreported equipment as unavailable instead of No', () => {
    const rows = detailSections(vehicle).slice(2).flatMap((section) => section.rows)
    expect(rows.every((row) => row.value === 'No disponible')).toBe(true)
  })
})
