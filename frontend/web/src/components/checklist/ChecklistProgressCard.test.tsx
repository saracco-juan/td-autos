import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChecklistProgressCard from './ChecklistProgressCard'

const steps = [
  { numero: 1, titulo: 'Antes de señar', completed: 1, total: 3 },
  { numero: 2, titulo: 'Documentación', completed: 5, total: 5 },
]

describe('ChecklistProgressCard', () => {
  it('is a region named by the given title', () => {
    render(<ChecklistProgressCard title="Avance por etapa" steps={steps} completed={6} total={8} />)

    expect(screen.getByRole('region', { name: 'Avance por etapa' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Avance por etapa' })).toBeInTheDocument()
  })

  it('lists one step per row with its progress and a total, as term and definition pairs', () => {
    render(<ChecklistProgressCard title="Avance por paso" steps={steps} completed={6} total={8} />)

    const card = screen.getByRole('region', { name: 'Avance por paso' })
    expect(within(card).getAllByRole('term').map((term) => term.textContent)).toEqual([
      '1. Antes de señar',
      '2. Documentación',
      'Total',
    ])
    expect(within(card).getAllByRole('definition').map((definition) => definition.textContent)).toEqual([
      '1 de 3',
      '5 de 5',
      '6 de 8',
    ])
  })
})
