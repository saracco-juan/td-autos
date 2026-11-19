import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useState } from 'react'

import { AuthContext, type AuthContextValue } from '../../../features/auth/AuthContext'
import type { User } from '../../../features/auth/types'
import ProfileScreen from '../../../features/profile/ProfileScreen'
import type { ProfileValues } from '../../../features/profile/types'
import { HttpError, NetworkError } from '../../../lib/http'

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn() }) }))
jest.mock('../../../features/profile/PurchaseProgress', () => () => null)

const COMPLETE: User = {
  id: 1,
  name: 'Martín',
  apellido: 'Gómez',
  email: 'martin@example.com',
  rol: 'comprador',
  perfil_completo: true,
}
const INCOMPLETE: User = { ...COMPLETE, name: '', apellido: null, perfil_completo: false }

type Overrides = {
  user?: User
  logout?: () => Promise<void>
  // Defaults to a server that stores the values and reports the profile as complete.
  save?: (values: ProfileValues) => Promise<User>
}

// Stands in for AuthProvider: keeps the session user in state so a save re-renders the screen like the real app.
function renderScreen({ user = COMPLETE, logout = () => Promise.resolve(), save }: Overrides = {}) {
  const storeOnServer = (values: ProfileValues) => Promise.resolve({ ...user, ...values, perfil_completo: true })
  const updateProfile = jest.fn(save ?? storeOnServer)

  function Harness() {
    const [current, setCurrent] = useState(user)
    const value = {
      status: 'authenticated',
      user: current,
      logout,
      updateProfile: async (values: ProfileValues) => {
        const saved = await updateProfile(values)
        setCurrent(saved)
        return saved
      },
    } as unknown as AuthContextValue
    return (
      <AuthContext value={value}>
        <ProfileScreen />
      </AuthContext>
    )
  }

  return { updateProfile, rendered: render(<Harness />) }
}

const INCOMPLETE_NOTICE = 'Tu perfil está incompleto. Completá los datos obligatorios.'
const SUCCESS = 'Los cambios se guardaron.'

describe('ProfileScreen', () => {
  it('saves a buyer with only a full name without showing an incomplete-profile notice', async () => {
    const { updateProfile, rendered } = renderScreen({ user: { ...COMPLETE, apellido: null } })
    await rendered
    expect(screen.queryByText(INCOMPLETE_NOTICE)).not.toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))
    expect(screen.getByLabelText('Nombre completo')).toHaveDisplayValue('Martín')
    expect(screen.queryByLabelText('Apellido')).not.toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))
    expect(await screen.findByText(SUCCESS)).toBeOnTheScreen()
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Martín', apellido: '' })
  })

  it('shows the header, the personal data form and the account card', async () => {
    await renderScreen().rendered
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))

    expect(screen.getByText('Perfil')).toBeOnTheScreen()
    expect(screen.getByText('Datos personales')).toBeOnTheScreen()
    expect(screen.getByLabelText('Nombre completo')).toHaveDisplayValue('Martín Gómez')
    expect(screen.queryByLabelText('Apellido')).not.toBeOnTheScreen()
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('martin@example.com')
    expect(screen.getByLabelText('Email')).toHaveProp('editable', false)
    expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeOnTheScreen()
    expect(screen.queryByText(INCOMPLETE_NOTICE)).not.toBeOnTheScreen()
    expect(screen.queryByText('CAMBIAR CONTRASEÑA')).not.toBeOnTheScreen()
    expect(screen.queryByText('NOTIFICACIONES')).not.toBeOnTheScreen()
  })

  it('TC-09: completes an incomplete profile, then hides the notice and confirms the save', async () => {
    const { updateProfile, rendered } = renderScreen({ user: INCOMPLETE })
    await rendered
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))
    expect(screen.getByText(INCOMPLETE_NOTICE)).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Martín Gómez')
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText(SUCCESS)).toBeOnTheScreen()
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Martín Gómez', apellido: '' })
    expect(screen.queryByText(INCOMPLETE_NOTICE)).not.toBeOnTheScreen()
  })

  it('TC-10: saves edited values, trimmed, and keeps showing them', async () => {
    const { updateProfile, rendered } = renderScreen()
    await rendered
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))

    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), '  Martina Pérez ')
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText(SUCCESS)).toBeOnTheScreen()
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Martina Pérez', apellido: '' })
    expect(screen.getByLabelText('Nombre completo')).toHaveDisplayValue('Martina Pérez')
  })

  it('TC-11: does not send a blank required field and flags it', async () => {
    const { updateProfile, rendered } = renderScreen()
    await rendered
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))

    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), '   ')
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText('El nombre es obligatorio.')).toBeOnTheScreen()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.queryByText(SUCCESS)).not.toBeOnTheScreen()
  })

  it('clears a field error as soon as that field is edited', async () => {
    await renderScreen().rendered
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), '')
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))
    await screen.findByText('El nombre es obligatorio.')

    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'G')

    expect(screen.queryByText('El nombre es obligatorio.')).not.toBeOnTheScreen()
  })

  it('shows the field errors the server returns (422)', async () => {
    const body = { errors: { name: ['El nombre no puede superar los 255 caracteres.'] } }
    const { rendered } = renderScreen({ save: () => Promise.reject(new HttpError(422, body)) })
    await rendered
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))

    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText('El nombre no puede superar los 255 caracteres.')).toBeOnTheScreen()
    expect(screen.queryByText('No se pudieron guardar los cambios. Intentá nuevamente.')).not.toBeOnTheScreen()
  })

  it.each([
    ['the server fails', new HttpError(500, {})],
    ['the API cannot be reached', new NetworkError(new Error('down'))],
  ])('shows a generic error when %s', async (_case, error) => {
    const { rendered } = renderScreen({ save: () => Promise.reject(error) })
    await rendered
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))

    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText('No se pudieron guardar los cambios. Intentá nuevamente.')).toBeOnTheScreen()
    expect(screen.queryByText(SUCCESS)).not.toBeOnTheScreen()
  })

  it('shows the busy label while saving', async () => {
    let finish: (user: User) => void = () => undefined
    const { rendered } = renderScreen({ save: () => new Promise<User>((resolve) => (finish = resolve)) })
    await rendered
    await fireEvent.press(screen.getByRole('button', { name: 'Editar datos' }))

    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText('GUARDANDO…')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeDisabled()
    finish(COMPLETE)
    expect(await screen.findByText(SUCCESS)).toBeOnTheScreen()
  })

  it('TC-83: logs out when the button is pressed', async () => {
    const logout = jest.fn(() => Promise.resolve())
    await renderScreen({ logout }).rendered

    await fireEvent.press(screen.getByRole('button', { name: 'CERRAR SESIÓN' }))

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  })

  it('shows the busy label while logging out', async () => {
    let finish: () => void = () => undefined
    await renderScreen({ logout: () => new Promise<void>((resolve) => (finish = resolve)) }).rendered

    await fireEvent.press(screen.getByRole('button', { name: 'CERRAR SESIÓN' }))

    expect(await screen.findByText('Cerrando sesión…')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'CERRAR SESIÓN' })).toBeDisabled()
    finish()
  })

  it('shows an error alert and stays put when logout fails', async () => {
    await renderScreen({ logout: () => Promise.reject(new Error('boom')) }).rendered

    await fireEvent.press(screen.getByRole('button', { name: 'CERRAR SESIÓN' }))

    expect(await screen.findByText('No se pudo cerrar la sesión. Intentá nuevamente.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'CERRAR SESIÓN' })).toBeOnTheScreen()
  })
})
