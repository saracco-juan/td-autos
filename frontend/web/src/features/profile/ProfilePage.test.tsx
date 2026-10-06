import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../lib/http'
import { useAuth } from '../auth/session/useAuth'
import type { User } from '../auth/types'
import { updateProfile } from './api'
import ProfilePage from './ProfilePage'

vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('./api', () => ({ updateProfile: vi.fn() }))

const refresh = vi.fn()

const NOTICE = 'Tu perfil está incompleto. Completá los datos obligatorios.'
const SUCCESS = 'Los cambios se guardaron.'
const GENERIC_ERROR = 'No se pudieron guardar los cambios. Intentá nuevamente.'

const incompleteUser: User = {
  id: 1,
  name: 'Ana',
  apellido: null,
  email: 'ana@example.com',
  rol: 'comprador',
  perfil_completo: false,
}
const completeUser: User = { ...incompleteUser, name: 'Ana', apellido: 'Pérez', perfil_completo: true }

function renderPage(user: User = completeUser) {
  vi.mocked(useAuth).mockReturnValue({ user, status: 'authenticated', login: vi.fn(), refresh, logout: vi.fn() })
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  )
}

type UserEventInstance = ReturnType<typeof userEvent.setup>

async function replaceText(user: UserEventInstance, label: string, text: string) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  if (text) await user.type(input, text)
}

const save = (user: UserEventInstance) => user.click(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

describe('ProfilePage', () => {
  beforeEach(() => {
    refresh.mockReset().mockResolvedValue(undefined)
    vi.mocked(updateProfile).mockReset().mockResolvedValue(completeUser)
  })

  describe('layout', () => {
    it('renders the header, the section title and the prefilled fields', () => {
      renderPage()

      expect(screen.getByText('PERFIL')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
      expect(screen.getByText('Datos personales')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'DATOS PERSONALES' })).toBeInTheDocument()
      expect(screen.getByLabelText('Nombre')).toHaveValue('Ana')
      expect(screen.getByLabelText('Apellido')).toHaveValue('Pérez')
      expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    })

    it('does not render the notifications, history and privacy cards', () => {
      renderPage()

      expect(screen.queryByText('NOTIFICACIONES')).not.toBeInTheDocument()
      expect(screen.queryByText('HISTORIAL')).not.toBeInTheDocument()
      expect(screen.queryByText(/privacidad/i)).not.toBeInTheDocument()
    })

    it('shows the email as read-only, still focusable', () => {
      renderPage()

      const email = screen.getByLabelText('Email')
      expect(email).toHaveAttribute('readonly')
      expect(email).not.toBeDisabled()
    })

    it('shows the incomplete-profile notice only while the profile is incomplete', () => {
      renderPage(incompleteUser)

      expect(screen.getByText(NOTICE)).toBeInTheDocument()
    })

    it('shows no notice when the profile is complete', () => {
      renderPage()

      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument()
    })
  })

  describe('saving', () => {
    it('TC-09: completes a missing apellido, saves it and refreshes the session', async () => {
      const user = userEvent.setup()
      renderPage(incompleteUser)

      expect(screen.getByLabelText('Apellido')).toHaveValue('')
      await user.type(screen.getByLabelText('Apellido'), 'Pérez')
      await save(user)

      expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS)
      expect(updateProfile).toHaveBeenCalledTimes(1)
      expect(updateProfile).toHaveBeenCalledWith({ name: 'Ana', apellido: 'Pérez' })
      expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('TC-10: saves the modified data without sending the email', async () => {
      const user = userEvent.setup()
      renderPage()

      await replaceText(user, 'Nombre', 'Anabel')
      await replaceText(user, 'Apellido', 'Gómez')
      await save(user)

      expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS)
      expect(updateProfile).toHaveBeenCalledWith({ name: 'Anabel', apellido: 'Gómez' })
      expect(vi.mocked(updateProfile).mock.calls[0][0]).not.toHaveProperty('email')
      expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('trims the values before sending them', async () => {
      const user = userEvent.setup()
      renderPage()

      await replaceText(user, 'Nombre', '  Anabel ')
      await save(user)

      await screen.findByRole('status')
      expect(updateProfile).toHaveBeenCalledWith({ name: 'Anabel', apellido: 'Pérez' })
    })

    it('clears the success message when a field is edited afterwards', async () => {
      const user = userEvent.setup()
      renderPage()

      await save(user)
      expect(await screen.findByRole('status')).toBeInTheDocument()
      await user.type(screen.getByLabelText('Nombre'), 'a')

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows no success message before saving', () => {
      renderPage()

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('client validation', () => {
    it.each([
      ['Nombre', 'El nombre es obligatorio.'],
      ['Apellido', 'El apellido es obligatorio.'],
    ])('TC-11: blocks saving with an empty %s and shows the message on that field', async (label, message) => {
      const user = userEvent.setup()
      renderPage()

      await replaceText(user, label, '')
      await save(user)

      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message)
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
      expect(updateProfile).not.toHaveBeenCalled()
      expect(refresh).not.toHaveBeenCalled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('clears a field error as soon as the user edits that field', async () => {
      const user = userEvent.setup()
      renderPage()

      await replaceText(user, 'Nombre', '')
      await save(user)
      await user.type(screen.getByLabelText('Nombre'), 'A')

      expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid')
    })
  })

  describe('pending state', () => {
    it('disables the button and marks it busy while the request is in flight', async () => {
      let resolve!: (value: User) => void
      vi.mocked(updateProfile).mockReturnValue(new Promise<User>((r) => (resolve = r)))
      const user = userEvent.setup()
      renderPage()

      await save(user)

      const button = screen.getByRole('button', { name: 'GUARDANDO…' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      resolve(completeUser)
      expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS)
      expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeEnabled()
    })
  })

  describe('server errors', () => {
    it('maps 422 errors onto their fields and shows no form-level alert', async () => {
      vi.mocked(updateProfile).mockRejectedValue(
        new HttpError(422, {
          errors: {
            name: ['El nombre no puede superar los 255 caracteres.'],
            apellido: ['El apellido no puede superar los 100 caracteres.'],
          },
        }),
      )
      const user = userEvent.setup()
      renderPage()

      await save(user)

      expect(await screen.findByLabelText('Nombre')).toHaveAccessibleDescription(
        'El nombre no puede superar los 255 caracteres.',
      )
      expect(screen.getByLabelText('Apellido')).toHaveAccessibleDescription(
        'El apellido no puede superar los 100 caracteres.',
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(refresh).not.toHaveBeenCalled()
    })

    it('falls back to the generic alert on a 422 without field errors', async () => {
      vi.mocked(updateProfile).mockRejectedValue(new HttpError(422, { errors: { name: [] } }))
      const user = userEvent.setup()
      renderPage()

      await save(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR)
      expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid')
    })

    it.each([
      ['a 500 response', new HttpError(500, { message: 'Server Error' })],
      ['a 401 response', new HttpError(401, undefined)],
      ['a network failure', new TypeError('Failed to fetch')],
    ])('shows the generic alert on %s and keeps the form usable', async (_label, error) => {
      vi.mocked(updateProfile).mockRejectedValueOnce(error)
      const user = userEvent.setup()
      renderPage()

      await save(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(refresh).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeEnabled()

      await save(user)
      expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
