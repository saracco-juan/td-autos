import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChecklistPendingCard from './ChecklistPendingCard'

const items = [
  { codigo: 'a', texto: 'El titular coincide con el vendedor', flagged: true },
  { codigo: 'b', texto: 'La VTV está vigente', flagged: false },
]

describe('ChecklistPendingCard', () => {
  it('is a region named by the given title, with one read-only row per item', () => {
    render(<ChecklistPendingCard title="Puntos pendientes" flagLabel="CRÍTICO" items={items} />)

    const card = screen.getByRole('region', { name: 'Puntos pendientes' })
    expect(within(card).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'El titular coincide con el vendedor CRÍTICO',
      'La VTV está vigente',
    ])
    expect(within(card).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('shows the given flag label on the flagged items only', () => {
    render(<ChecklistPendingCard title="Pasos obligatorios pendientes" flagLabel="OBLIGATORIO" items={items} />)

    expect(screen.getAllByText('OBLIGATORIO')).toHaveLength(1)
    expect(screen.queryByText('CRÍTICO')).not.toBeInTheDocument()
  })

  it('shows the subtitle only when one is given', () => {
    const { rerender } = render(
      <ChecklistPendingCard
        title="Puntos críticos pendientes"
        subtitle="Son los que más pesan a la hora de decidir."
        flagLabel="CRÍTICO"
        items={items}
      />,
    )
    expect(screen.getByText('Son los que más pesan a la hora de decidir.')).toBeInTheDocument()

    rerender(<ChecklistPendingCard title="Puntos pendientes" flagLabel="CRÍTICO" items={items} />)
    expect(screen.queryByText(/pesan/)).not.toBeInTheDocument()
  })
})
