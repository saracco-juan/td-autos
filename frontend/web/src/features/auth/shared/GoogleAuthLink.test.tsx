import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { API_URL } from '../../../lib/config'
import GoogleAuthLink from './GoogleAuthLink'

describe('GoogleAuthLink', () => {
  it('renders the "o" divider followed by the Google link to the backend redirect route', () => {
    render(<GoogleAuthLink from="registro" />)

    expect(screen.getByText('o')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CONTINUAR CON GOOGLE' })).toHaveAttribute(
      'href',
      `${API_URL}/auth/google/redirect?from=registro`,
    )
  })

  it('tags the link with the login origin', () => {
    render(<GoogleAuthLink from="login" />)

    expect(screen.getByRole('link', { name: 'CONTINUAR CON GOOGLE' })).toHaveAttribute(
      'href',
      `${API_URL}/auth/google/redirect?from=login`,
    )
  })
})
