import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, NavLink } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import DashboardShell from '../../components/DashboardShell/DashboardShell'

describe('DashboardShell', () => {
  it('supports another role navigation and account without dealership-specific content', () => {
    render(<MemoryRouter initialEntries={['/admin']}>
      <DashboardShell account={{ name: 'Ana', email: 'ana@example.com', label: 'Cuenta administrativa' }}
        navigationLabel="Administración" menuOpen={false} menuId="admin-menu" onMenuToggle={vi.fn()}
        loggingOut={false} onLogout={vi.fn()}
        renderNavigation={(className) => <NavLink to="/admin" end className={className}>Resumen</NavLink>}>
        <h1>Administración</h1>
      </DashboardShell>
    </MemoryRouter>)

    const navigation = screen.getByRole('navigation', { name: 'Administración' })
    expect(within(navigation).getByRole('link', { name: 'Resumen' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Suscripción' })).not.toBeInTheDocument()
    const account = screen.getByRole('group', { name: 'Cuenta administrativa' })
    expect(account).toHaveTextContent('Ana')
    expect(account).toHaveTextContent('ana@example.com')
    expect(screen.getByRole('main')).toHaveTextContent('Administración')
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })
})
