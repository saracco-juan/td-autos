import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import AuthLayout from './AuthLayout'

describe('AuthLayout', () => {
  it('renders only the routed content inside a single main landmark', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route index element={<p>Contenido</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('main')).toHaveTextContent('Contenido')
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })
})
