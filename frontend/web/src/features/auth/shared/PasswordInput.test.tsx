import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PasswordInput from './PasswordInput'

describe('PasswordInput', () => {
  it('hides the value by default and toggles its visibility', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Contraseña" defaultValue="secreto" />)

    const input = screen.getByLabelText('Contraseña')
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('forwards the input props', () => {
    render(<PasswordInput aria-label="Contraseña" id="login-password" autoComplete="current-password" />)

    const input = screen.getByLabelText('Contraseña')
    expect(input).toHaveAttribute('id', 'login-password')
    expect(input).toHaveAttribute('autocomplete', 'current-password')
  })
})
