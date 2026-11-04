import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import AuthSwitchLink from '../../../../features/auth/shared/components/AuthSwitchLink'

function Destination() {
  const { state } = useLocation()
  return (
    <>
      <h1>Registration</h1>
      <output aria-label="Navigation intent">{state?.authFocus ?? 'none'}/{state?.authMotion ?? 'default'}</output>
    </>
  )
}

function renderSwitch(button: boolean) {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<AuthSwitchLink to="/registro" button={button}>Create account</AuthSwitchLink>} />
        <Route path="/registro" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe.each([false, true])('AuthSwitchLink (button=%s)', (button) => {
  it('requests immediate motion and title focus for keyboard activation', async () => {
    const user = userEvent.setup()
    renderSwitch(button)
    screen.getByRole('link', { name: 'Create account' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Registration' })).toBeInTheDocument()
    expect(screen.getByLabelText('Navigation intent')).toHaveTextContent('title/reduced')
  })

  it('keeps normal link navigation and motion for pointer activation', async () => {
    const user = userEvent.setup()
    renderSwitch(button)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/registro')
    await user.click(screen.getByRole('link', { name: 'Create account' }))
    expect(screen.getByRole('heading', { name: 'Registration' })).toBeInTheDocument()
    expect(screen.getByLabelText('Navigation intent')).toHaveTextContent('none/default')
  })
})
