import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/session/hooks/useAuth'
import HomePage from './HomePage'

vi.mock('../auth/session/hooks/useAuth', () => ({ useAuth: vi.fn() }))

function renderHome(authenticated = false) {
  vi.mocked(useAuth).mockReturnValue({
    user: authenticated ? { id: 7, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', perfil_completo: true, tiene_diagnostico: true } : null,
    status: authenticated ? 'authenticated' : 'guest',
    login: vi.fn(), refresh: vi.fn(), logout: vi.fn(),
  })
  render(<MemoryRouter><HomePage /></MemoryRouter>)
}

describe('HomePage', () => {
  it('explains the product and offers buyer registration without personal data', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'Tu próximo auto. Tu próxima historia.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Encontrar mi auto' })).toHaveAttribute('href', '/registro')
    expect(screen.getByRole('heading', { name: 'El auto correcto empieza por vos.' })).toBeInTheDocument()
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument()
  })
  it('explains the buyer journey in order without product screenshots or an image caption', () => {
    renderHome()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.closest('section')?.id)).toEqual([
      'diagnostico', 'busqueda', 'comparacion', 'costos', 'checklists', 'concesionarias',
    ])
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/images/home-vehicles-headlights.webp')
    expect(screen.queryByText(/Imagen conceptual generada/)).not.toBeInTheDocument()
  })
  it('provides the existing dealer login and registration destinations', () => {
    renderHome()
    expect(screen.getByRole('link', { name: 'Registrar mi concesionaria' })).toHaveAttribute('href', '/registro/concesionaria')
    expect(screen.getByRole('link', { name: 'Ingresar como concesionaria' })).toHaveAttribute('href', '/login')
  })
  it('lets an existing buyer continue to recommendations', () => {
    renderHome(true)
    expect(screen.getByRole('link', { name: 'Ver mis recomendados' })).toHaveAttribute('href', '/recomendaciones')
  })
})
