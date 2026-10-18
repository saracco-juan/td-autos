import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import DealerOverview from './DealerOverview'
import { dealerDetail } from './fixtures'

const receipts = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    tipo: 'alta' as const,
    estado: 'aprobado' as const,
    periodo_desde: '2026-01-01',
    periodo_hasta: '2026-01-31',
    enviado_en: null,
    motivo_rechazo: null,
    fecha_revision: null,
  }))

const renderOverview = (count: number) =>
  render(
    <MemoryRouter>
      <DealerOverview dealer={dealerDetail({ comprobantes: receipts(count) })} />
    </MemoryRouter>,
  )

describe('DealerOverview receipts history', () => {
  it('shows no pager while the receipts fit in one page', () => {
    renderOverview(3)

    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })

  it('pages a long history, with the pager under the list', async () => {
    renderOverview(7)
    const list = screen.getByRole('region', { name: 'Comprobantes de la concesionaria' })

    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Página 2' }))

    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })
})
