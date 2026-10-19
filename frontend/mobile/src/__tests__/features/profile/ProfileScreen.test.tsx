import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { useAuth } from '../../../features/auth/useAuth'
import ProfileScreen from '../../../features/profile/ProfileScreen'

jest.mock('../../../features/auth/useAuth')

const useAuthMock = jest.mocked(useAuth)

function mockAuth(logout: () => Promise<void>) {
  useAuthMock.mockReturnValue({ logout } as unknown as ReturnType<typeof useAuth>)
}

describe('ProfileScreen', () => {
  it('shows the page header and the account card with only the logout action', async () => {
    mockAuth(() => Promise.resolve())

    await render(<ProfileScreen />)

    expect(screen.getByText('Perfil')).toBeOnTheScreen()
    expect(screen.getByText('PRIVACIDAD Y SESIÓN')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'CERRAR SESIÓN' })).toBeOnTheScreen()
    expect(screen.queryByText('CAMBIAR CONTRASEÑA')).not.toBeOnTheScreen()
  })

  it('TC-83: logs out when the button is pressed', async () => {
    const logout = jest.fn(() => Promise.resolve())
    mockAuth(logout)
    await render(<ProfileScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'CERRAR SESIÓN' }))

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  })

  it('shows the busy label while the request is pending', async () => {
    let finish: () => void = () => undefined
    mockAuth(() => new Promise<void>((resolve) => (finish = resolve)))
    await render(<ProfileScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'CERRAR SESIÓN' }))

    expect(await screen.findByText('CERRANDO SESIÓN…')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'CERRAR SESIÓN' })).toBeDisabled()
    finish()
  })

  it('shows an error alert and stays put when logout fails', async () => {
    mockAuth(() => Promise.reject(new Error('boom')))
    await render(<ProfileScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'CERRAR SESIÓN' }))

    expect(await screen.findByText('No se pudo cerrar la sesión. Intentá nuevamente.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'CERRAR SESIÓN' })).toBeOnTheScreen()
  })
})
