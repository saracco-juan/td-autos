import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/session/useAuth'
import HomePage from './HomePage'

vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))

function renderHome(authenticated = false) {
  vi.mocked(useAuth).mockReturnValue({
    user: authenticated ? { id: 7, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', perfil_completo: true, tiene_diagnostico: true } : null,
    status: authenticated ? 'authenticated' : 'guest',
    login: vi.fn(), refresh: vi.fn(), logout: vi.fn(),
  })
  render(<MemoryRouter><HomePage /></MemoryRouter>)
}

describe('HomePage', () => {
  it('reveals content once and cancels movement when reduced motion is enabled', () => {
    let notify: IntersectionObserverCallback = () => {}
    let onPreferenceChange = () => {}
    const unobserve = vi.fn()
    const disconnect = vi.fn()
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ cancel, onfinish: null }))
    const preference = {
      matches: false,
      addEventListener: vi.fn((_: string, listener: () => void) => { onPreferenceChange = listener }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('matchMedia', () => preference)
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback }
      observe = vi.fn()
      unobserve = unobserve
      disconnect = disconnect
    })
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
    try {
      renderHome()
      const title = screen.getByRole('heading', { name: 'El auto correcto empieza por vos.' })
      const target = title.firstElementChild as Element
      notify([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      expect(unobserve).toHaveBeenCalledWith(target)
      expect(animate).toHaveBeenCalledOnce()
      preference.matches = true
      onPreferenceChange()
      expect(cancel).toHaveBeenCalledOnce()
      notify([{ target: title.lastElementChild as Element, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      expect(animate).toHaveBeenCalledOnce()
      expect(title).toBeVisible()
      cleanup()
      expect(disconnect).toHaveBeenCalledOnce()
      expect(preference.removeEventListener).toHaveBeenCalledWith('change', onPreferenceChange)
    } finally {
      cleanup()
      Reflect.deleteProperty(Element.prototype, 'animate')
      vi.unstubAllGlobals()
    }
  })
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
