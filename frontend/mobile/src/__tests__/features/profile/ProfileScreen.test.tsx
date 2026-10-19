import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useState } from 'react'

import { AuthContext, type AuthContextValue } from '../../../features/auth/AuthContext'
import type { User } from '../../../features/auth/types'
import ProfileScreen from '../../../features/profile/ProfileScreen'
import type { ProfileValues } from '../../../features/profile/types'
import { HttpError, NetworkError } from '../../../lib/http'

const COMPLETE: User = {
  id: 1,
  name: 'Martín',
  apellido: 'Gómez',
  email: 'martin@example.com',
  rol: 'comprador',
  perfil_completo: true,
}
const INCOMPLETE: User = { ...COMPLETE, apellido: null, perfil_completo: false }

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
  it('shows the header, the personal data form and the account card', async () => {
    await renderScreen().rendered

    expect(screen.getByText('Perfil')).toBeOnTheScreen()
    expect(screen.getByText('Datos personales')).toBeOnTheScreen()
    expect(screen.getByText('DATOS PERSONALES')).toBeOnTheScreen()
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Martín')
    expect(screen.getByLabelText('Apellido')).toHaveDisplayValue('Gómez')
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('martin@example.com')
    expect(screen.getByLabelText('Email')).toHaveProp('editable', false)
    expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeOnTheScreen()
    expect(screen.getByText('PRIVACIDAD Y SESIÓN')).toBeOnTheScreen()
    expect(screen.queryByText(INCOMPLETE_NOTICE)).not.toBeOnTheScreen()
    expect(screen.queryByText('CAMBIAR CONTRASEÑA')).not.toBeOnTheScreen()
    expect(screen.queryByText('NOTIFICACIONES')).not.toBeOnTheScreen()
  })

  it('TC-09: completes an incomplete profile, then hides the notice and confirms the save', async () => {
    const { updateProfile, rendered } = renderScreen({ user: INCOMPLETE })
    await rendered
    expect(screen.getByText(INCOMPLETE_NOTICE)).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText('Apellido'), 'Gómez')
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText(SUCCESS)).toBeOnTheScreen()
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Martín', apellido: 'Gómez' })
    expect(screen.queryByText(INCOMPLETE_NOTICE)).not.toBeOnTheScreen()
  })

  it('TC-10: saves edited values, trimmed, and keeps showing them', async () => {
    const { updateProfile, rendered } = renderScreen()
    await rendered

    await fireEvent.changeText(screen.getByLabelText('Nombre'), '  Martina ')
    await fireEvent.changeText(screen.getByLabelText('Apellido'), 'Pérez')
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText(SUCCESS)).toBeOnTheScreen()
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Martina', apellido: 'Pérez' })
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Martina')
    expect(screen.getByLabelText('Apellido')).toHaveDisplayValue('Pérez')
  })

  it('TC-11: does not send a blank required field and flags it', async () => {
    const { updateProfile, rendered } = renderScreen()
    await rendered

    await fireEvent.changeText(screen.getByLabelText('Apellido'), '   ')
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText('El apellido es obligatorio.')).toBeOnTheScreen()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.queryByText(SUCCESS)).not.toBeOnTheScreen()
  })

  it('clears a field error as soon as that field is edited', async () => {
    await renderScreen().rendered
    await fireEvent.changeText(screen.getByLabelText('Apellido'), '')
    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))
    await screen.findByText('El apellido es obligatorio.')

    await fireEvent.changeText(screen.getByLabelText('Apellido'), 'G')

    expect(screen.queryByText('El apellido es obligatorio.')).not.toBeOnTheScreen()
  })

  it('shows the field errors the server returns (422)', async () => {
    const body = { errors: { apellido: ['El apellido no puede superar los 100 caracteres.'] } }
    const { rendered } = renderScreen({ save: () => Promise.reject(new HttpError(422, body)) })
    await rendered

    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText('El apellido no puede superar los 100 caracteres.')).toBeOnTheScreen()
    expect(screen.queryByText('No se pudieron guardar los cambios. Intentá nuevamente.')).not.toBeOnTheScreen()
  })

  it.each([
    ['the server fails', new HttpError(500, {})],
    ['the API cannot be reached', new NetworkError(new Error('down'))],
  ])('shows a generic error when %s', async (_case, error) => {
    const { rendered } = renderScreen({ save: () => Promise.reject(error) })
    await rendered

    await fireEvent.press(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText('No se pudieron guardar los cambios. Intentá nuevamente.')).toBeOnTheScreen()
    expect(screen.queryByText(SUCCESS)).not.toBeOnTheScreen()
  })

  it('shows the busy label while saving', async () => {
    let finish: (user: User) => void = () => undefined
    const { rendered } = renderScreen({ save: () => new Promise<User>((resolve) => (finish = resolve)) })
    await rendered

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

    expect(await screen.findByText('CERRANDO SESIÓN…')).toBeOnTheScreen()
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
