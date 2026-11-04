import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/session/useAuth'
import type { User } from '../auth/types'
import AppShell from '../../app/AppShell'

vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))
const buyer: User = {
  id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador',
  perfil_completo: true, tiene_diagnostico: true,
}

describe('Favorites navigation', () => {
  beforeEach(() => vi.mocked(useAuth).mockReturnValue({
    user: buyer, status: 'authenticated', login: vi.fn(), refresh: vi.fn(), logout: vi.fn(),
  }))
  afterEach(cleanup)

  it('shows Favoritos as a standalone buyer destination', () => {
    render(<MemoryRouter initialEntries={['/favoritos']}><Routes>
      <Route element={<AppShell />}><Route path="/favoritos" element={<p>Saved list</p>} /></Route>
    </Routes></MemoryRouter>)

    expect(screen.getByRole('link', { name: 'Favoritos' })).toHaveAttribute('href', '/favoritos')
    expect(screen.getByRole('link', { name: 'Favoritos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('main')).toHaveTextContent('Saved list')
  })
})
