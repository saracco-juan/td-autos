import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Field from './Field'

describe('Field', () => {
  it('associates the label with the control through the given id', () => {
    render(<Field id="login-email" label="Email">{(control) => <input {...control} />}</Field>)

    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('id', 'login-email')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('lists the errors and links them to the control', () => {
    render(
      <Field id="login-email" label="Email" errors={['El email es obligatorio.', 'Formato inválido.']}>
        {(control) => <input {...control} />}
      </Field>,
    )

    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'login-email-error')
    const list = screen.getByRole('list')
    expect(list).toHaveAttribute('id', 'login-email-error')
    expect(list).toHaveTextContent('El email es obligatorio.')
    expect(list).toHaveTextContent('Formato inválido.')
  })

  it('renders the hint and describes the control with it when there are no errors', () => {
    render(
      <Field id="login-email" label="Email" hint={<p id="login-email-hint">Usá tu email.</p>}>
        {(control) => <input {...control} />}
      </Field>,
    )

    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'login-email-hint')
    expect(screen.getByText('Usá tu email.')).toBeInTheDocument()
  })

  it('replaces the hint with the errors when both are present', () => {
    render(
      <Field id="login-email" label="Email" errors={['Mal.']} hint={<p>Usá tu email.</p>}>
        {(control) => <input {...control} />}
      </Field>,
    )

    expect(screen.queryByText('Usá tu email.')).not.toBeInTheDocument()
    expect(screen.getByText('Mal.')).toBeInTheDocument()
  })
})
