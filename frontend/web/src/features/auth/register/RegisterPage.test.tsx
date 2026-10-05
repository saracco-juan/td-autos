import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../../../lib/config'
import { HttpError } from '../../../lib/http'
import { registerUser } from '../api'
import { useAuth } from '../session/useAuth'
import RegisterPage from './RegisterPage'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  registerUser: vi.fn(),
}))

vi.mock('../session/useAuth', () => ({ useAuth: vi.fn() }))

const refresh = vi.fn()

const createdUser = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }

function renderPage(entry = '/registro') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/" element={<p>Pantalla principal</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

type Fields = Partial<{
  name: string
  email: string
  password: string
  confirmation: string
}>

type User = ReturnType<typeof userEvent.setup>

async function fillForm(user: User, fields: Fields) {
  if (fields.name) await user.type(screen.getByLabelText('Nombre completo'), fields.name)
  if (fields.email) await user.type(screen.getByLabelText('Email'), fields.email)
  if (fields.password) await user.type(screen.getByLabelText('Contraseña'), fields.password)
  if (fields.confirmation) await user.type(screen.getByLabelText('Confirmar contraseña'), fields.confirmation)
}

const validFields: Fields = {
  name: 'Ana',
  email: 'ana@example.com',
  password: 'Abcdef12',
  confirmation: 'Abcdef12',
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'CREAR CUENTA' }))

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.mocked(registerUser).mockReset()
    vi.mocked(registerUser).mockResolvedValue(createdUser)
    refresh.mockReset().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({ user: null, status: 'guest', login: vi.fn(), refresh, logout: vi.fn() })
  })

  describe('layout', () => {
    it('renders the wordmark, title, subtitle and login link', () => {
      renderPage()

      expect(screen.getByText('TD AUTOS')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Registrá tu cuenta' })).toBeInTheDocument()
      expect(screen.getByText('Por favor, introducí tus datos para registrarte.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login')
      expect(screen.queryByLabelText('Apellido')).not.toBeInTheDocument()
    })

    it('sets browser autocomplete hints on every field', () => {
      renderPage()

      expect(screen.getByLabelText('Nombre completo')).toHaveAttribute('autocomplete', 'name')
      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
      expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'new-password')
      expect(screen.getByLabelText('Confirmar contraseña')).toHaveAttribute('autocomplete', 'new-password')
    })

    it.each(['Contraseña', 'Confirmar contraseña'])('toggles the visibility of %s', async (label) => {
      const user = userEvent.setup()
      renderPage()
      const input = screen.getByLabelText(label)
      const field = input.closest('div')!.parentElement!

      expect(input).toHaveAttribute('type', 'password')
      await user.click(within(field).getByRole('button', { name: 'Mostrar contraseña' }))
      expect(input).toHaveAttribute('type', 'text')
      await user.click(within(field).getByRole('button', { name: 'Ocultar contraseña' }))
      expect(input).toHaveAttribute('type', 'password')
    })
  })

  describe('submission', () => {
    it('TC-01: submits a valid form and navigates to /', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, validFields)
      await submit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(registerUser).toHaveBeenCalledTimes(1)
      expect(registerUser).toHaveBeenCalledWith({
        name: 'Ana',
        apellido: null,
        email: 'ana@example.com',
        password: 'Abcdef12',
        password_confirmation: 'Abcdef12',
      })
    })

    it('refreshes the session before navigating, so the route guards see the new user', async () => {
      let resolveRefresh!: () => void
      refresh.mockReturnValue(new Promise<void>((r) => (resolveRefresh = r)))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, validFields)
      await submit(user)

      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
      resolveRefresh()
      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
    })

    it('trims the email and never sends an apellido', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { ...validFields, email: '  ana@example.com ' })
      await submit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(registerUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@example.com', apellido: null }),
      )
    })

    it('navigates to / when the server says a session already exists (409)', async () => {
      vi.mocked(registerUser).mockRejectedValue(new HttpError(409, { message: 'Ya existe una sesión iniciada.' }))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, validFields)
      await submit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(refresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('client validation', () => {
    it('TC-04: lists every unmet password requirement and blocks submit', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { ...validFields, password: 'abc', confirmation: 'abc' })
      await submit(user)

      expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument()
      expect(screen.getByText('La contraseña debe incluir al menos una letra mayúscula.')).toBeInTheDocument()
      expect(screen.getByText('La contraseña debe incluir al menos un número.')).toBeInTheDocument()
      expect(screen.queryByText('La contraseña debe incluir al menos una letra minúscula.')).not.toBeInTheDocument()
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('FE-1: checks off each requirement live as the user types', async () => {
      const user = userEvent.setup()
      renderPage()
      const password = screen.getByLabelText('Contraseña')
      const checklist = screen.getByRole('list', { name: 'Requisitos de la contraseña' })
      const metState = () =>
        within(checklist)
          .getAllByRole('listitem')
          .map((item) => item.getAttribute('data-met'))

      for (const label of ['Al menos 8 caracteres', 'Una letra mayúscula', 'Una letra minúscula', 'Un número']) {
        expect(within(checklist).getByText(label)).toBeInTheDocument()
      }
      expect(metState()).toEqual(['false', 'false', 'false', 'false'])

      await user.type(password, 'abc')
      expect(metState()).toEqual(['false', 'false', 'true', 'false'])

      await user.clear(password)
      await user.type(password, 'Abcdef12')
      expect(metState()).toEqual(['true', 'true', 'true', 'true'])
    })

    it('FE-2: blocks submit when the confirmation does not match', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { ...validFields, confirmation: 'Abcdef13' })
      await submit(user)

      expect(screen.getByLabelText('Confirmar contraseña')).toHaveAccessibleDescription(
        'Las contraseñas no coinciden.',
      )
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('FE-3: blocks submit without Nombre completo and flags an invalid email', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { ...validFields, name: '', email: 'no-es-email' })
      await submit(user)

      expect(screen.getByLabelText('Nombre completo')).toHaveAccessibleDescription('El nombre es obligatorio.')
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Ingresá un email válido.')
      expect(registerUser).not.toHaveBeenCalled()
    })
  })

  describe('pending state', () => {
    it('disables the button and shows CREANDO CUENTA… while the request is in flight', async () => {
      let resolve!: (value: typeof createdUser) => void
      vi.mocked(registerUser).mockReturnValue(new Promise((r) => (resolve = r)))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, validFields)
      await submit(user)

      expect(screen.getByRole('button', { name: 'CREANDO CUENTA…' })).toBeDisabled()
      resolve(createdUser)
      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
    })
  })

  describe('server errors', () => {
    it('TC-03: shows a 422 email-in-use error on the email field without navigating', async () => {
      vi.mocked(registerUser).mockRejectedValue(
        new HttpError(422, { errors: { email: ['El email ya está en uso.'] } }),
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, validFields)
      await submit(user)

      expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription('El email ya está en uso.')
      expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
    })

    it('shows server password errors under the password field', async () => {
      vi.mocked(registerUser).mockRejectedValue(
        new HttpError(422, { errors: { password: ['Las contraseñas no coinciden.'] } }),
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, validFields)
      await submit(user)

      expect(await screen.findByLabelText('Contraseña')).toHaveAccessibleDescription(
        'Las contraseñas no coinciden.',
      )
    })

    it.each([
      ['a 500 response', new HttpError(500, { message: 'Server Error' })],
      ['a network failure', new TypeError('Failed to fetch')],
    ])('FE-7: shows a generic error on %s and keeps the form usable', async (_label, error) => {
      vi.mocked(registerUser).mockRejectedValueOnce(error)
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, validFields)
      await submit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se pudo completar el registro. Intentá nuevamente.',
      )
      expect(screen.getByRole('button', { name: 'CREAR CUENTA' })).toBeEnabled()

      await submit(user)
      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(registerUser).toHaveBeenCalledTimes(2)
    })
  })

  describe('Google', () => {
    it('TC-02: the Google link points to the backend redirect route, tagged with the register origin', () => {
      renderPage()

      expect(screen.getByRole('link', { name: 'CONTINUAR CON GOOGLE' })).toHaveAttribute(
        'href',
        `${API_URL}/auth/google/redirect?from=registro`,
      )
    })

    it.each([
      ['google_cancelled', 'Se canceló el ingreso con Google.'],
      ['google_failed', 'No se pudo completar el ingreso con Google. Intentá nuevamente.'],
      ['email_in_use', 'El email ya está en uso.'],
    ])('FE-4: shows the banner for ?error=%s', (code, message) => {
      renderPage(`/registro?error=${code}`)

      expect(screen.getByRole('alert')).toHaveTextContent(message)
    })

    it('renders the Google link as a secondary action separated by an "o" divider', () => {
      renderPage()

      expect(screen.getByText('o')).toBeInTheDocument()
    })

    it('ignores unknown error codes', () => {
      renderPage('/registro?error=something_else')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
