import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../features/auth/session/useAuth'
import type { User } from '../features/auth/types'
import AppShell from './AppShell'

vi.mock('../features/auth/session/useAuth', () => ({ useAuth: vi.fn() }))

const ana = {
  id: 1,
  name: 'Ana',
  apellido: null,
  email: 'ana@example.com',
  rol: 'comprador',
  perfil_completo: false,
  tiene_diagnostico: true,
}

const marta = {
  id: 2,
  name: 'Marta',
  apellido: 'Gómez',
  email: 'marta@autosdelsur.com',
  rol: 'concesionaria',
  perfil_completo: true,
  tiene_diagnostico: false,
  concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta: 'pendiente' },
}

function mockAuth(status: 'authenticated' | 'guest', logout = vi.fn().mockResolvedValue(undefined), user: User = ana) {
  vi.mocked(useAuth).mockReturnValue({
    user: status === 'authenticated' ? user : null,
    status,
    login: vi.fn(),
    refresh: vi.fn(),
    logout,
  })
  return logout
}

function renderShell(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>Contenido</p>} />
          <Route path="*" element={<p>Otra pantalla</p>} />
        </Route>
        <Route path="/login" element={<p>Pantalla de ingreso</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function LandingSections() {
  const location = useLocation()
  return <>
    <output aria-label="Current address">{location.pathname}{location.hash}</output>
    {['diagnostico', 'busqueda', 'comparacion', 'costos', 'checklists', 'concesionarias'].map(id => (
      <section key={id} id={id} aria-label={id}>{id}</section>
    ))}
  </>
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  it('renders the guest nav, the routed content and the footer', () => {
    mockAuth('guest')
    renderShell()

    expect(screen.getByRole('link', { name: 'TD Autos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('main')).toHaveTextContent('Contenido')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2026 TD Autos. Todos los derechos reservados.')
  })

  describe('menu toggle (phones)', () => {
    it.each([false, true])('scrolls to a section respecting reduced motion (%s)', async (reduceMotion) => {
      mockAuth('guest')
      renderShell()
      const target = screen.getByRole('main')
      target.id = 'diagnostico'
      target.scrollIntoView = vi.fn()
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduceMotion }))
      try {
        await userEvent.setup().click(screen.getByRole('link', { name: 'Diagnóstico' }))
        expect(target.scrollIntoView).toHaveBeenCalledWith({
          block: 'start', behavior: reduceMotion ? 'instant' : 'smooth',
        })
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('smoothly returns to the top from the footer without losing the page query', async () => {
      mockAuth('authenticated')
      renderShell('/comparar?vehiculos=1,2')
      const target = screen.getByRole('main')
      target.id = 'root'
      target.scrollIntoView = vi.fn()
      const backToTop = screen.getByRole('link', { name: 'Volver arriba' })
      expect(backToTop).toHaveAttribute('href', '/comparar?vehiculos=1,2#root')
      await userEvent.setup().click(backToTop)
      expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    })

    it('follows the visible section in both directions without changing the clicked anchor', async () => {
      mockAuth('guest')
      let position = 0
      const ids = ['diagnostico', 'busqueda', 'comparacion', 'costos', 'checklists', 'concesionarias']
      const geometry = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return DOMRect.fromRect({ y: (ids.indexOf(this.id) + 1) * 1000 - position, height: 1000 })
      })
      const scrollIntoView = vi.fn()
      vi.useFakeTimers()
      try {
        render(<MemoryRouter initialEntries={['/']}><Routes><Route element={<AppShell />}>
          <Route index element={<LandingSections />} />
        </Route></Routes></MemoryRouter>)
        ids.forEach(id => { document.getElementById(id)!.scrollIntoView = scrollIntoView })
        const navigation = screen.getByRole('navigation', { name: 'Principal' })
        const selected = () => navigation.querySelector('[aria-current="location"]')
        await act(() => vi.advanceTimersByTimeAsync(20))
        expect(selected()).toBeNull()

        fireEvent.click(within(navigation).getByRole('link', { name: 'Comparación' }))
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
        position = 1000
        fireEvent.scroll(window)
        await act(() => vi.advanceTimersByTimeAsync(20))
        expect(selected()).toHaveTextContent('Comparación')
        position = 3000
        fireEvent.scroll(window)
        await act(() => vi.advanceTimersByTimeAsync(20))
        expect(selected()).toHaveTextContent('Comparación')

        position = 2000
        fireEvent.scroll(window)
        await act(() => vi.advanceTimersByTimeAsync(20))
        expect(selected()).toHaveTextContent('Búsqueda')
        expect(screen.getByLabelText('Current address')).toHaveTextContent('/#comparacion')

        fireEvent.click(within(navigation).getByRole('link', { name: 'Concesionarias' }))
        position = 3000
        fireEvent.scroll(window)
        await act(() => vi.advanceTimersByTimeAsync(20))
        expect(selected()).toHaveTextContent('Concesionarias')
        fireEvent.wheel(window)
        await act(() => vi.advanceTimersByTimeAsync(20))
        expect(selected()).toHaveTextContent('Comparación')

        // A rapid sequence settles on the actual last position, with no delayed queue.
        for (position of [3000, 4000, 5000, 6000]) fireEvent.scroll(window)
        await act(() => vi.advanceTimersByTimeAsync(20))
        expect(selected()).toHaveTextContent('Concesionarias')
        expect(screen.getByLabelText('Current address')).toHaveTextContent('/#concesionarias')
        position = 0
        fireEvent.scroll(window)
        await act(() => vi.advanceTimersByTimeAsync(20))
        expect(selected()).toBeNull()
      } finally {
        cleanup()
        vi.useRealTimers()
        geometry.mockRestore()
      }
    })

    it('lets a guest open the section navigation and follow a landing anchor', async () => {
      mockAuth('guest')
      renderShell()

      const user = userEvent.setup()
      const toggle = screen.getByRole('button', { name: 'Menú' })
      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await user.click(screen.getByRole('link', { name: 'Diagnóstico' }))
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('starts collapsed and points at the panel that holds the links and the logout', () => {
      mockAuth('authenticated')
      renderShell()

      const toggle = screen.getByRole('button', { name: 'Menú' })
      expect(toggle).toHaveAttribute('type', 'button')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
      expect(panel).not.toBeNull()
      expect(within(panel as HTMLElement).getByRole('link', { name: 'Diagnóstico' })).toBeInTheDocument()
      expect(within(panel as HTMLElement).getByRole('link', { name: 'Perfil' })).toBeInTheDocument()
      expect(within(panel as HTMLElement).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    })

    it('opens and closes the menu with the toggle', async () => {
      mockAuth('authenticated')
      renderShell()
      const user = userEvent.setup()
      const toggle = screen.getByRole('button', { name: 'Menú' })

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes the menu when a link is followed', async () => {
      mockAuth('authenticated')
      renderShell()
      const user = userEvent.setup()
      const toggle = screen.getByRole('button', { name: 'Menú' })

      await user.click(toggle)
      await user.click(screen.getByRole('link', { name: 'Recomendados' }))

      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByText('Otra pantalla')).toBeInTheDocument()
    })

    it('closes the menu with Escape', async () => {
      mockAuth('authenticated')
      renderShell()
      const user = userEvent.setup()
      const toggle = screen.getByRole('button', { name: 'Menú' })

      await user.click(toggle)
      await user.keyboard('{Escape}')

      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })
  })

  it('shows no logout button to a guest', () => {
    mockAuth('guest')
    renderShell()

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('shows no profile link to a guest', () => {
    mockAuth('guest')
    renderShell()

    expect(screen.queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument()
  })

  it('shows the logo, the diagnosis, recommendations, favorites, transfer and profile links and a logout button to an authenticated user, and nothing else in the nav', () => {
    mockAuth('authenticated')
    renderShell()

    const banner = screen.getByRole('banner')
    expect(screen.getByRole('link', { name: 'TD Autos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Diagnóstico' })).toHaveAttribute('href', '/diagnostico')
    expect(screen.getByRole('link', { name: 'Recomendados' })).toHaveAttribute('href', '/recomendaciones')
    expect(screen.getByRole('link', { name: 'Favoritos' })).toHaveAttribute('href', '/favoritos')
    expect(screen.getByRole('link', { name: 'Transferencia' })).toHaveAttribute('href', '/transferencia')
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/perfil')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('type', 'button')
    expect(banner.querySelectorAll('a')).toHaveLength(6)
    // The menu toggle (visible on phones only) and the logout.
      expect(banner.querySelectorAll('button')).toHaveLength(2)
  })

  it('orders the nav as in Figma: Diagnóstico, Recomendados, Favoritos, Transferencia, Perfil, Cerrar sesión', () => {
    mockAuth('authenticated')
    renderShell()

    const items = within(screen.getByRole('banner')).getAllByRole('link').slice(1)
    expect(items.map((item) => item.textContent)).toEqual(['Diagnóstico', 'Recomendados', 'Favoritos', 'Transferencia', 'Perfil'])
    const logout = screen.getByRole('button', { name: 'Cerrar sesión' })
    expect(items[4].compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    ['buyer', ana, ['Diagnóstico', 'Recomendados', 'Favoritos', 'Transferencia'], 'Perfil'],
    ['dealer', marta, ['Suscripción', 'Verificación', 'Métricas'], null],
    ['administrator', { ...ana, rol: 'administrador' }, ['Concesionarias'], 'Administración'],
  ])('groups the %s links in the main navigation beside the logo and keeps the account items apart', (_, user, links, accountLink) => {
    mockAuth('authenticated', undefined, user as User)
    renderShell()

    const navigation = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(links)
    expect(within(navigation).queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
    const logo = screen.getByRole('link', { name: 'TD Autos' })
    expect(logo.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    if (accountLink) {
      const account = screen.getByRole('link', { name: accountLink })
      expect(navigation).not.toContainElement(account)
      const logout = screen.getByRole('button', { name: 'Cerrar sesión' })
      expect(account.compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('offers landing sections and account entry to a guest, not private routes', () => {
    mockAuth('guest')
    renderShell()

    const navigation = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(navigation).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/#diagnostico', '/#busqueda', '/#comparacion', '/#costos', '/#checklists', '/#concesionarias',
    ])
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Registrarse' })).toHaveAttribute('href', '/registro')
    expect(screen.queryByRole('link', { name: 'Recomendados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Transferencia' })).not.toBeInTheDocument()
  })

  it('shows only the logo and the logout button to a signed-in user who is neither a buyer nor a dealer', () => {
    mockAuth('authenticated', undefined, { ...ana, rol: 'admin' })
    renderShell()

    const banner = screen.getByRole('banner')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(banner.querySelectorAll('a')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'Diagnóstico' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Verificación' })).not.toBeInTheDocument()
  })

  it('marks the link of the current page with aria-current', () => {
    mockAuth('authenticated')
    renderShell('/recomendaciones')

    expect(screen.getByRole('link', { name: 'Recomendados' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Diagnóstico' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute('aria-current')
  })

  it('marks the Transferencia link with aria-current on /transferencia', () => {
    mockAuth('authenticated')
    renderShell('/transferencia')

    expect(screen.getByRole('link', { name: 'Transferencia' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Recomendados' })).not.toHaveAttribute('aria-current')
  })

  describe('admin nav (UH19)', () => {
    const admin: User = { ...ana, rol: 'administrador' }

    it('shows Concesionarias, Administración and the logout button, and none of the buyer or dealer links', () => {
      mockAuth('authenticated', undefined, admin)
      renderShell('/admin')

      const banner = screen.getByRole('banner')
      expect(screen.getByRole('link', { name: 'Concesionarias' })).toHaveAttribute('href', '/admin/concesionarias')
      expect(screen.getByRole('link', { name: 'Administración' })).toHaveAttribute('href', '/admin')
      expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
      expect(banner.querySelectorAll('a')).toHaveLength(3)
      for (const name of ['Diagnóstico', 'Recomendados', 'Transferencia', 'Perfil', 'Suscripción', 'Verificación', 'Inventario']) {
        expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
      }
    })

    it('orders the nav as in Figma: Concesionarias, Administración, Cerrar sesión', () => {
      mockAuth('authenticated', undefined, admin)
      renderShell('/admin')

      const items = within(screen.getByRole('banner')).getAllByRole('link').slice(1)
      expect(items.map((item) => item.textContent)).toEqual(['Concesionarias', 'Administración'])
    })

    it('marks Administración on /admin and Concesionarias on the screens under /admin/concesionarias and the receipt review', () => {
      mockAuth('authenticated', undefined, admin)
      renderShell('/admin')
      expect(screen.getByRole('link', { name: 'Administración' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Concesionarias' })).not.toHaveAttribute('aria-current')
      cleanup()

      renderShell('/admin/concesionarias')
      expect(screen.getByRole('link', { name: 'Concesionarias' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Administración' })).not.toHaveAttribute('aria-current')
      cleanup()

      renderShell('/admin/comprobantes/7')
      expect(screen.getByRole('link', { name: 'Concesionarias' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Administración' })).not.toHaveAttribute('aria-current')
      cleanup()

      renderShell('/admin/concesionarias/5')
      expect(screen.getByRole('link', { name: 'Concesionarias' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Administración' })).not.toHaveAttribute('aria-current')
    })
  })

  describe('dealer nav (UH17)', () => {
    it('shows Suscripción, Verificación, the dealer name as plain text and the logout button, and none of the buyer links', () => {
      mockAuth('authenticated', undefined, marta)
      renderShell()

      const banner = screen.getByRole('banner')
      expect(screen.getByRole('link', { name: 'TD Autos' })).toHaveAttribute('href', '/')
      expect(screen.getByRole('link', { name: 'Suscripción' })).toHaveAttribute('href', '/concesionaria/suscripcion')
      expect(screen.getByRole('link', { name: 'Verificación' })).toHaveAttribute('href', '/concesionaria')
      expect(within(banner).getByText('Autos del Sur')).toBeInTheDocument()
      expect(within(banner).queryByRole('link', { name: 'Autos del Sur' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('type', 'button')
      expect(banner.querySelectorAll('a')).toHaveLength(4)
      // The menu toggle (visible on phones only) and the logout.
      expect(banner.querySelectorAll('button')).toHaveLength(2)
      for (const name of ['Diagnóstico', 'Recomendados', 'Transferencia', 'Perfil', 'Inventario']) {
        expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
      }
    })

    it('UH18: shows Suscripción to every dealer, pending or active, first and before Verificación', () => {
      const following = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
      for (const estado_alta of ['pendiente', 'activa']) {
        mockAuth('authenticated', undefined, { ...marta, concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta } })
        renderShell()

        const items = within(screen.getByRole('banner')).getAllByRole('link').slice(1)
        expect(items[0]).toHaveTextContent('Suscripción')
        expect(following(items[0], screen.getByRole('link', { name: 'Verificación' }))).toBeTruthy()
        cleanup()
      }
    })

    it('UH18: marks Suscripción with aria-current on its screen, and Verificación stays unmarked', () => {
      mockAuth('authenticated', undefined, marta)
      renderShell('/concesionaria/suscripcion')

      expect(screen.getByRole('link', { name: 'Suscripción' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Verificación' })).not.toHaveAttribute('aria-current')
    })

    it('UH21: shows the Inventario link to an active dealer, after Verificación', () => {
      mockAuth('authenticated', undefined, { ...marta, concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta: 'activa' } })
      renderShell()

      const link = screen.getByRole('link', { name: 'Inventario' })
      expect(link).toHaveAttribute('href', '/concesionaria/inventario')
      expect(screen.getByRole('link', { name: 'Verificación' }).compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('UH21: marks Inventario with aria-current on the inventory screens, and Verificación stays unmarked', () => {
      mockAuth('authenticated', undefined, { ...marta, concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta: 'activa' } })
      renderShell('/concesionaria/inventario/3/editar')

      expect(screen.getByRole('link', { name: 'Inventario' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Verificación' })).not.toHaveAttribute('aria-current')
    })

    it.each([['pendiente'], [null]])('UH21: hides the Inventario link from a dealer whose state is %s', (estado_alta) => {
      mockAuth('authenticated', undefined, { ...marta, concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta } })
      renderShell()

      expect(screen.queryByRole('link', { name: 'Inventario' })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Verificación' })).toBeInTheDocument()
    })

    it('UH21: hides the Inventario link from a dealer user without a dealer', () => {
      mockAuth('authenticated', undefined, { ...marta, concesionaria: null })
      renderShell()

      expect(screen.queryByRole('link', { name: 'Inventario' })).not.toBeInTheDocument()
    })

    it('orders the nav: Verificación, dealer name, Cerrar sesión', () => {
      mockAuth('authenticated', undefined, marta)
      renderShell()

      const following = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
      const link = screen.getByRole('link', { name: 'Verificación' })
      const name = screen.getByText('Autos del Sur')
      expect(following(link, name)).toBeTruthy()
      expect(following(name, screen.getByRole('button', { name: 'Cerrar sesión' }))).toBeTruthy()
    })

    it('marks Verificación with aria-current on /concesionaria, not on the screens under it', () => {
      mockAuth('authenticated', undefined, marta)
      renderShell('/concesionaria')

      expect(screen.getByRole('link', { name: 'Verificación' })).toHaveAttribute('aria-current', 'page')

      cleanup()
      renderShell('/concesionaria/inventario')

      expect(screen.getByRole('link', { name: 'Verificación' })).not.toHaveAttribute('aria-current')
    })

    // The API sends `concesionaria: null` for a dealer-role user without a dealer row.
    it('shows no dealer name for a dealer user without a dealer', () => {
      mockAuth('authenticated', undefined, { ...marta, concesionaria: null })
      renderShell()

      expect(screen.getByRole('link', { name: 'Verificación' })).toBeInTheDocument()
      expect(screen.queryByText('Autos del Sur')).not.toBeInTheDocument()
    })

    it('TC-83: a dealer logs out and goes to the login screen', async () => {
      const logout = mockAuth('authenticated', undefined, marta)
      renderShell()

      await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))

      expect(logout).toHaveBeenCalledTimes(1)
      expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
    })
  })

  it('TC-83: pressing Cerrar sesión logs out and goes to the login screen', async () => {
    const logout = mockAuth('authenticated')
    renderShell()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(logout).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
  })

  it('disables the button and marks it busy while the request is in flight', async () => {
    let finish!: () => void
    const logout = mockAuth(
      'authenticated',
      vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
    )
    renderShell()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    const button = screen.getByRole('button', { name: 'Cerrar sesión' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(logout).toHaveBeenCalledTimes(1)

    finish()
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
  })

  it('shows an alert, stays on the page and re-enables the button when logout fails', async () => {
    const logout = mockAuth('authenticated', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderShell()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión. Intentá nuevamente.')
    expect(screen.getByText('Contenido')).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de ingreso')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Cerrar sesión' })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy', 'true')
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('clears the alert when logging out is retried', async () => {
    const logout = mockAuth(
      'authenticated',
      vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined),
    )
    renderShell()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
    expect(logout).toHaveBeenCalledTimes(2)
  })
})
