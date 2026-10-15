import { describe, expect, it } from 'vitest'
import template from '../../../public/plantilla-inventario.csv?raw'

const BOM = String.fromCharCode(0xfeff)

// The template the import page offers must stay in the format the API reads (UH-22 D1-D3).
describe('plantilla-inventario.csv', () => {
  const [header, ...rows] = template.slice(template.startsWith(BOM) ? 1 : 0).trim().split(/\r?\n/)

  it('starts with a BOM so spreadsheet apps open the accents in UTF-8', () => {
    expect(template.startsWith(BOM)).toBe(true)
  })

  it('has every column the import reads, separated by semicolons', () => {
    expect(header.split(';')).toEqual([
      'patente',
      'marca',
      'modelo',
      'version',
      'anio',
      'kilometraje',
      'precio',
      'transmision',
      'combustible',
      'carroceria',
      'ubicacion',
      'descripcion',
      'fotos',
    ])
  })

  it('has one example row with seven photo URLs', () => {
    expect(rows).toHaveLength(1)
    const cells = rows[0].split(';')
    expect(cells).toHaveLength(13)
    const photos = cells[12].split('|')
    expect(photos).toHaveLength(7)
    photos.forEach((url) => expect(url).toMatch(/^https:\/\//))
  })
})
