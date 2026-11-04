import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import Button from '../../components/Buttons/Button'
import ButtonLink from '../../components/Buttons/ButtonLink'
import ButtonAnchor from '../../components/Buttons/ButtonAnchor'

describe('shared action controls', () => {
  it('preserves native form submission and custom classes', () => {
    const submit = vi.fn((event) => event.preventDefault())
    const ref = createRef<HTMLButtonElement>()
    render(<form onSubmit={submit}><Button ref={ref} variant="primary" className="screen-action">Guardar</Button></form>)
    const button = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(button)
    expect(submit).toHaveBeenCalledOnce()
    expect(ref.current).toBe(button)
    expect(button).toHaveClass('screen-action')
  })

  it('preserves disabled and busy semantics without invoking the handler', () => {
    const click = vi.fn()
    render(<Button type="button" variant="success" disabled aria-busy="true" onClick={click}>Contactar</Button>)
    const button = screen.getByRole('button', { name: 'Contactar' })
    fireEvent.click(button)
    expect(click).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('preserves router navigation context on links', () => {
    function Location() {
      const location = useLocation()
      return <output>{location.pathname}:{location.state?.source}</output>
    }
    render(<MemoryRouter><ButtonLink to="/comparar" state={{ source: 'favorites' }}>Comparar</ButtonLink><Location /></MemoryRouter>)
    fireEvent.click(screen.getByRole('link', { name: 'Comparar' }))
    expect(screen.getByRole('status')).toHaveTextContent('/comparar:favorites')
  })

  it('keeps external links as anchors with their target and security attributes', () => {
    render(<ButtonAnchor href="https://example.com" target="_blank" rel="noopener noreferrer">Portal</ButtonAnchor>)
    expect(screen.getByRole('link', { name: 'Portal' })).toHaveAttribute('href', 'https://example.com')
    expect(screen.getByRole('link', { name: 'Portal' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'Portal' })).toHaveAttribute('target', '_blank')
  })
})
