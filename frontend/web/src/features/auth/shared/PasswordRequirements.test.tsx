import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PASSWORD_RULES } from '../passwordRules'
import PasswordRequirements from './PasswordRequirements'

describe('PasswordRequirements', () => {
  it('lists every rule as pending for an empty password', () => {
    render(<PasswordRequirements id="reqs" password="" />)

    const list = screen.getByRole('list', { name: 'Requisitos de la contraseña' })
    expect(list).toHaveAttribute('id', 'reqs')
    expect(screen.getAllByRole('listitem')).toHaveLength(PASSWORD_RULES.length)
    expect(screen.getAllByText('(pendiente)')).toHaveLength(PASSWORD_RULES.length)
  })

  it('marks every rule as met for a strong password', () => {
    render(<PasswordRequirements id="reqs" password="Abcdef12" />)

    expect(screen.getAllByText('(cumplido)')).toHaveLength(PASSWORD_RULES.length)
  })
})
