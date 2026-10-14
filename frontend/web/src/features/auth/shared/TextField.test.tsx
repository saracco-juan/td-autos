import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TextField from './TextField'

describe('TextField', () => {
  it('renders a labelled input with its name, type, value and autocomplete hint', () => {
    render(<TextField id="register-email" name="email" label="Email" type="email" autoComplete="email" value="ana@example.com" onChange={vi.fn()} />)

    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('id', 'register-email')
    expect(input).toHaveAttribute('name', 'email')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('autocomplete', 'email')
    expect(input).toHaveValue('ana@example.com')
  })

  it('defaults to a text input and reports the typed value', async () => {
    const onChange = vi.fn()
    render(<TextField id="register-name" name="name" label="Nombre completo" autoComplete="name" value="" onChange={onChange} />)

    const input = screen.getByLabelText('Nombre completo')
    expect(input).toHaveAttribute('type', 'text')
    await userEvent.setup().type(input, 'A')
    expect(onChange).toHaveBeenCalledWith('A')
  })

  it('renders a password input with the visibility toggle', () => {
    render(<TextField id="register-password" name="password" label="Contraseña" type="password" autoComplete="new-password" value="" onChange={vi.fn()} />)

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument()
  })

  it('shows the errors of the field', () => {
    render(<TextField id="register-email" name="email" label="Email" autoComplete="email" value="" errors={['El email es obligatorio.']} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('El email es obligatorio.')
  })
})
