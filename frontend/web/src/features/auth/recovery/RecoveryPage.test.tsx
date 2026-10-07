import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../lib/http'
import { requestPasswordReset } from '../api'
import { useAuth } from '../session/useAuth'
import RecoveryPage from './RecoveryPage'

vi.mock('../api', () => ({ requestPasswordReset: vi.fn() }))
vi.mock('../session/useAuth', () => ({ useAuth: vi.fn() }))

const refresh = vi.fn()

const HELPER = 'Si existe una cuenta asociada, recibirás instrucciones por email.'
const GENERIC_ERROR = 'No se pudo enviar la solicitud. Intentá nuevamente.'

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/recuperar']}>
      <Routes>
        <Route path="/recuperar" element={<RecoveryPage />} />
        <Route path="/login" element={<p>Pantalla de ingreso</p>} />
        <Route path="/" element={<p>Pantalla principal</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

type User = ReturnType<typeof userEvent.setup>

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'SOLICITAR RECUPERACIÓN' }))

async function fillAndSubmit(user: User, email = 'ana@example.com') {
  await user.type(screen.getByLabelText('Email'), email)
  await submit(user)
}

describe('RecoveryPage', () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockReset().mockResolvedValue(HELPER)
    refresh.mockReset().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({ user: null, status: 'guest', login: vi.fn(), refresh, logout: vi.fn() })
  })

  describe('layout', () => {
    it('renders the title, the email field, the buttons and the helper text, with no status message', () => {
      renderPage()

      expect(screen.getByRole('heading', { name: 'Recuperá tu contraseña' })).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
      expect(screen.getByRole('button', { name: 'SOLICITAR RECUPERACIÓN' })).toBeEnabled()
      expect(screen.getByText(HELPER)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'VOLVER AL ACCESO' })).toHaveAttribute('href', '/login')
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('navigates to the login screen from VOLVER AL ACCESO', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('link', { name: 'VOLVER AL ACCESO' }))
      expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
    })
  })

  describe('submission', () => {
    it('TC-07: requests the recovery with the typed email and shows the confirmation', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByRole('status')).toHaveTextContent(HELPER)
      expect(requestPasswordReset).toHaveBeenCalledTimes(1)
      expect(requestPasswordReset).toHaveBeenCalledWith('ana@example.com')
    })

    it('trims the email before sending it', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user, '  ana@example.com ')

      expect(await screen.findByRole('status')).toBeInTheDocument()
      expect(requestPasswordReset).toHaveBeenCalledWith('ana@example.com')
    })

    it('shows the text returned by the API, not the static helper', async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue('Texto devuelto por el servidor.')
      const user = userEvent.setup()
      renderPage()
      expect(screen.getByText(HELPER)).toBeInTheDocument()

      await fillAndSubmit(user)

      expect(await screen.findByRole('status')).toHaveTextContent('Texto devuelto por el servidor.')
      expect(screen.queryByText(HELPER)).not.toBeInTheDocument()
    })

    it('does not repeat the helper next to the confirmation', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      await screen.findByRole('status')
      expect(screen.getAllByText(HELPER)).toHaveLength(1)
    })

    it('keeps the form and the back link available so the user can request again', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)
      await screen.findByRole('status')
      expect(screen.getByRole('link', { name: 'VOLVER AL ACCESO' })).toBeInTheDocument()

      await submit(user)
      expect(requestPasswordReset).toHaveBeenCalledTimes(2)
    })
  })

  describe('client validation', () => {
    it('blocks submit without email', async () => {
      const user = userEvent.setup()
      renderPage()

      await submit(user)

      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('El email es obligatorio.')
      expect(requestPasswordReset).not.toHaveBeenCalled()
    })

    it('flags a malformed email', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user, 'no-es-email')

      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Ingresá un email válido.')
      expect(requestPasswordReset).not.toHaveBeenCalled()
    })

    it('clears the field error as soon as the user edits it', async () => {
      const user = userEvent.setup()
      renderPage()

      await submit(user)
      await user.type(screen.getByLabelText('Email'), 'a')

      expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
    })
  })

  describe('pending state', () => {
    it('disables the button and shows SOLICITANDO… while the request is in flight', async () => {
      let resolve!: (status: string) => void
      vi.mocked(requestPasswordReset).mockReturnValue(new Promise<string>((r) => (resolve = r)))
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      const button = screen.getByRole('button', { name: 'SOLICITANDO…' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      resolve(HELPER)
      expect(await screen.findByRole('status')).toBeInTheDocument()
    })
  })

  describe('server errors', () => {
    it('shows the 422 email errors on the field and no confirmation', async () => {
      vi.mocked(requestPasswordReset).mockRejectedValue(
        new HttpError(422, { errors: { email: ['El campo email debe ser una dirección válida.'] } }),
      )
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByText('El campo email debe ser una dirección válida.')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('falls back to the generic alert on a 422 without an email error', async () => {
      vi.mocked(requestPasswordReset).mockRejectedValue(new HttpError(422, { errors: {} }))
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR)
    })

    it('refreshes the session and navigates to / when the server says one already exists (409)', async () => {
      vi.mocked(requestPasswordReset).mockRejectedValue(new HttpError(409, { message: 'Ya existe una sesión.' }))
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(refresh).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['a 500 response', new HttpError(500, { message: 'Server Error' })],
      ['a network failure', new TypeError('Failed to fetch')],
    ])('shows a generic alert on %s and keeps the form usable', async (_label, error) => {
      vi.mocked(requestPasswordReset).mockRejectedValueOnce(error)
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR)
      expect(screen.getByRole('button', { name: 'SOLICITAR RECUPERACIÓN' })).toBeEnabled()
      expect(screen.getByText(HELPER)).toBeInTheDocument()

      await submit(user)
      expect(await screen.findByRole('status')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
