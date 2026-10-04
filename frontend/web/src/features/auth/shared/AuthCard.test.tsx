import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AuthCard from './AuthCard'

describe('AuthCard', () => {
  it('renders the title, the wordmark, the subtitle and the children', () => {
    render(
      <AuthCard titleId="login-title" title="Iniciá sesión" subtitle="Accedé para guardar tus favoritos.">
        <p>Contenido</p>
      </AuthCard>,
    )

    expect(screen.getByRole('region', { name: 'Iniciá sesión' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Iniciá sesión' })).toHaveAttribute('id', 'login-title')
    expect(screen.getByText('TD AUTOS')).toBeInTheDocument()
    expect(screen.getByText('Accedé para guardar tus favoritos.')).toBeInTheDocument()
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('omits the subtitle when none is given', () => {
    render(
      <AuthCard titleId="login-title" title="Iniciá sesión">
        <p>Contenido</p>
      </AuthCard>,
    )

    expect(screen.getByRole('heading', { name: 'Iniciá sesión' })).toBeInTheDocument()
    expect(screen.queryByText('Accedé para guardar tus favoritos.')).not.toBeInTheDocument()
  })
})
