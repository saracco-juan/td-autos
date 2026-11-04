import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../../features/auth/session/hooks/useAuth'
import { registerDealer } from '../../../../features/auth/api/client'
import DealerRegisterPage from '../../../../features/auth/dealer/pages/DealerRegisterPage'

vi.mock('../../../../features/auth/session/hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../../../../features/auth/api/client', () => ({ registerDealer: vi.fn() }))

function renderWizard() {
  render(<MemoryRouter><DealerRegisterPage /></MemoryRouter>)
}

describe('Dealer registration wizard', () => {
  beforeEach(() => {
    vi.mocked(registerDealer).mockReset()
    vi.mocked(useAuth).mockReturnValue({ user: null, status: 'guest', login: vi.fn(), logout: vi.fn(), refresh: vi.fn() })
  })

  it('starts with dealership fields and labelled progress, not the whole form', () => {
    renderWizard()
    expect(screen.getByRole('link', { name: 'TD Autos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('progressbar', { name: 'Registro de concesionaria' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('progressbar', { name: 'Registro de concesionaria' })).toHaveValue(1)
    expect(screen.getByLabelText('Nombre de la concesionaria')).toBeInTheDocument()
    expect(screen.getByLabelText('Teléfono público')).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
  })

  it('validates the current step, then preserves values when returning', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('button', { name: 'SIGUIENTE' }))
    expect(screen.getByLabelText('Nombre de la concesionaria')).toBeInvalid()
    expect(screen.getByLabelText('Nombre de la concesionaria')).toHaveFocus()
    expect(registerDealer).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Nombre de la concesionaria'), 'Dealership test')
    await user.type(screen.getByLabelText('Teléfono público'), '00000000')
    await user.click(screen.getByRole('button', { name: 'SIGUIENTE' }))
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByRole('progressbar')).toHaveValue(2)
    expect(screen.getByLabelText('Dirección')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '¿Dónde está tu concesionaria?' })).toHaveFocus()
    expect(screen.queryByText('El email es obligatorio.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ANTERIOR' }))
    expect(screen.getByLabelText('Nombre de la concesionaria')).toHaveValue('Dealership test')
    expect(screen.getByLabelText('Teléfono público')).toHaveValue('00000000')
    expect(registerDealer).not.toHaveBeenCalled()
  })
})
