import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { listing } from './fixtures'
import VehicleCard from './VehicleCard'
import type { Listing } from './types'

function renderCard(overrides: Partial<Listing> = {}) {
  render(
    <ul>
      <VehicleCard listing={listing(overrides)} />
    </ul>,
  )
}

describe('VehicleCard', () => {
  // TC-18
  it('shows the title, the formatted line and the source tag', () => {
    renderCard()

    expect(screen.getByRole('listitem', { name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
    expect(screen.getByText('$ 28.900.000 · 62.000 km · CABA')).toBeInTheDocument()
    expect(screen.getByText('Portal externo')).toBeInTheDocument()
  })

  it('uses the original title when the brand or the model are missing', () => {
    renderCard({ marca: null, modelo: null, version: null, anio: null })

    expect(screen.getByRole('listitem', { name: 'Toyota Corolla XEI 2.0 CVT 2021' })).toBeInTheDocument()
  })

  it('omits the line parts that are missing', () => {
    renderCard({ precio: null, kilometraje: null })

    expect(screen.getByText('CABA')).toBeInTheDocument()
    expect(screen.queryByText(/null|undefined/)).not.toBeInTheDocument()
  })

  it('renders no line at all when price, kilometres and location are all missing', () => {
    renderCard({ precio: null, kilometraje: null, ubicacion: null })

    expect(screen.queryByText(/\$|km/)).not.toBeInTheDocument()
  })

  it('shows the listing image when there is one', () => {
    renderCard()

    expect(screen.getByRole('img', { name: 'Foto de Toyota Corolla XEI 2021' })).toHaveAttribute(
      'src',
      'https://example.test/listings/1',
    )
    expect(screen.queryByText('Sin imagen')).not.toBeInTheDocument()
  })

  it('shows a neutral placeholder block when there is no image', () => {
    renderCard({ imagen_url: null })

    expect(screen.getByText('Sin imagen')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('S1: leaves out match, compare and sheet, which belong to later stories', () => {
    renderCard()

    expect(screen.queryByText(/coincidencia/i)).not.toBeInTheDocument()
    expect(screen.queryByText('COMPARAR')).not.toBeInTheDocument()
    expect(screen.queryByText('VER FICHA')).not.toBeInTheDocument()
  })
})
