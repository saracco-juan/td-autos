import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ListFooter from './ListFooter'

describe('ListFooter', () => {
  it('puts the actions first and the pager last, in one group each', () => {
    render(
      <ListFooter actions={<button type="button">CARGAR</button>}>
        <nav aria-label="Paginación">pager</nav>
      </ListFooter>,
    )

    const actions = screen.getByRole('button', { name: 'CARGAR' })
    const pager = screen.getByRole('navigation', { name: 'Paginación' })
    expect(actions.compareDocumentPosition(pager) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(actions.parentElement?.nextElementSibling).toBe(pager.parentElement)
  })

  it('renders without actions', () => {
    render(
      <ListFooter>
        <nav aria-label="Paginación">pager</nav>
      </ListFooter>,
    )

    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument()
  })
})
