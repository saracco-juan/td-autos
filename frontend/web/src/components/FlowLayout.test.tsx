import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FlowLayout from './FlowLayout'

describe('FlowLayout', () => {
  it('renders the body and puts the actions in a named bar after it', () => {
    render(
      <FlowLayout actions={<button type="button">CONTINUAR</button>}>
        <p>contenido</p>
      </FlowLayout>,
    )

    const bar = screen.getByRole('group', { name: 'Acciones' })
    const body = screen.getByText('contenido')
    expect(bar).toContainElement(screen.getByRole('button', { name: 'CONTINUAR' }))
    expect(body.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bar).not.toContainElement(body)
  })

  it('renders no bar when there are no actions', () => {
    render(
      <FlowLayout actions={null}>
        <p>contenido</p>
      </FlowLayout>,
    )

    expect(screen.queryByRole('group', { name: 'Acciones' })).not.toBeInTheDocument()
  })
})
