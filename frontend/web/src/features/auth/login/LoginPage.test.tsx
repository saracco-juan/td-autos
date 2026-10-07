import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../../../lib/config'
import { HttpError } from '../../../lib/http'
import { useAuth } from '../session/useAuth'
import LoginPage from './LoginPage'

vi.mock('../session/useAuth', () => ({ useAuth: vi.fn() }))

const login = vi.fn()
const refresh = vi.fn()

const INVALID_CREDENTIALS = 'Usuario incorrecto, por favor intente nuevamente'
const GENERIC_ERROR = 'No se pudo iniciar sesión. Intentá nuevamente.'

function renderPage(entry: string | { pathname: string; state?: unknown } = '/login') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Pantalla principal</p>} />
        <Route path="/registro" element={<p>Pantalla de registro</p>} />
        <Route path="/recuperar" element={<p>Pantalla de recuperación</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

type User = ReturnType<typeof userEvent.setup>

async function fillForm(user: User, email = 'ana@example.com', password = 'Abcdef12') {
  if (email) await user.type(screen.getByLabelText('Email'), email)
  if (password) await user.type(screen.getByLabelText('Contraseña'), password)
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'INGRESAR' }))

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset().mockResolvedValue(undefined)
    refresh.mockReset().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({ user: null, status: 'guest', login, refresh, logout: vi.fn() })
  })

  describe('layout', () => {
    it('renders the title, subtitle, fields and links, without remember-me or dealer link', () => {
      renderPage()

      expect(screen.getByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
      expect(screen.getByText('Accedé para guardar tus favoritos.')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
      expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
      expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/registro')
      expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute('href', '/recuperar')
      expect(screen.queryByText(/recordar/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/concesionaria/i)).not.toBeInTheDocument()
    })

    it('toggles the visibility of the password', async () => {
      const user = userEvent.setup()
      renderPage()
      const input = screen.getByLabelText('Contraseña')
      const field = input.closest('div')!.parentElement!

      expect(input).toHaveAttribute('type', 'password')
      await user.click(within(field).getByRole('button', { name: 'Mostrar contraseña' }))
      expect(input).toHaveAttribute('type', 'text')
    })
  })

  describe('submission', () => {
    it('TC-05: logs in with the typed credentials and navigates to /', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(login).toHaveBeenCalledTimes(1)
      expect(login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'Abcdef12' })
    })

    it('trims the email before sending it', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, '  ana@example.com ')
      await submit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'Abcdef12' })
    })

    it('refreshes the session and navigates to / when the server says one already exists (409)', async () => {
      login.mockRejectedValue(new HttpError(409, { message: 'Ya existe una sesión iniciada.' }))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(refresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('client validation', () => {
    it('blocks submit without email and password', async () => {
      const user = userEvent.setup()
      renderPage()

      await submit(user)

      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('El email es obligatorio.')
      expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('La contraseña es obligatoria.')
      expect(login).not.toHaveBeenCalled()
    })

    it('flags an invalid email format', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, 'no-es-email')
      await submit(user)

      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Ingresá un email válido.')
      expect(login).not.toHaveBeenCalled()
    })

    it('clears a field error as soon as the user edits that field', async () => {
      const user = userEvent.setup()
      renderPage()

      await submit(user)
      await user.type(screen.getByLabelText('Email'), 'a')

      expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
    })
  })

  describe('pending state', () => {
    it('disables the button and shows INGRESANDO… while the request is in flight', async () => {
      let resolve!: () => void
      login.mockReturnValue(new Promise<void>((r) => (resolve = r)))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      const button = screen.getByRole('button', { name: 'INGRESANDO…' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      resolve()
      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
    })
  })

  describe('server errors', () => {
    it('TC-06: shows the exact credentials message in the alert and marks no field invalid', async () => {
      login.mockRejectedValue(new HttpError(422, { errors: { email: [INVALID_CREDENTIALS] } }))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_CREDENTIALS)
      expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
      expect(screen.getByLabelText('Contraseña')).not.toHaveAttribute('aria-invalid')
      expect(screen.getByLabelText('Email')).not.toHaveAccessibleDescription(INVALID_CREDENTIALS)
      expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
    })

    it('falls back to the generic message on a 422 without an email error', async () => {
      login.mockRejectedValue(new HttpError(422, { errors: {} }))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR)
    })

    it.each([
      ['a 500 response', new HttpError(500, { message: 'Server Error' })],
      ['a network failure', new TypeError('Failed to fetch')],
    ])('shows a generic error on %s and keeps the form usable', async (_label, error) => {
      login.mockRejectedValueOnce(error)
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR)
      expect(screen.getByRole('button', { name: 'INGRESAR' })).toBeEnabled()

      await submit(user)
      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(login).toHaveBeenCalledTimes(2)
    })

    it('clears the previous error when submitting again', async () => {
      login.mockRejectedValueOnce(new HttpError(422, { errors: { email: [INVALID_CREDENTIALS] } }))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await submit(user)
      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
    })
  })

  describe('notice', () => {
    it('shows a notice passed through navigation state as a status message, not an alert', () => {
      renderPage({ pathname: '/login', state: { notice: 'Tu contraseña se actualizó. Ingresá con la nueva.' } })

      expect(screen.getByRole('status')).toHaveTextContent('Tu contraseña se actualizó. Ingresá con la nueva.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows no status message without a notice', () => {
      renderPage()

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('ignores a state without a text notice', () => {
      renderPage({ pathname: '/login', state: { notice: 42 } })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('Google', () => {
    it('the Google link points to the backend redirect route tagged with the login origin, below the "o" divider', () => {
      renderPage()

      expect(screen.getByText('o')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'CONTINUAR CON GOOGLE' })).toHaveAttribute(
        'href',
        `${API_URL}/auth/google/redirect?from=login`,
      )
    })

    it('TC-73: shows the message of a Google error code from the query string', () => {
      renderPage('/login?error=google_failed')

      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se pudo completar el ingreso con Google. Intentá nuevamente.',
      )
    })

    it('ignores unknown error codes', () => {
      renderPage('/login?error=something_else')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('links', () => {
    it('navigates to the register screen from "Crear cuenta"', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('link', { name: 'Crear cuenta' }))
      expect(await screen.findByText('Pantalla de registro')).toBeInTheDocument()
    })

    it('navigates to the recovery screen from "¿Olvidaste tu contraseña?"', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }))
      expect(await screen.findByText('Pantalla de recuperación')).toBeInTheDocument()
    })
  })
})
