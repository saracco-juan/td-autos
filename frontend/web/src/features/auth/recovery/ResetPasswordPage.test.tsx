import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../lib/http'
import { resetPassword } from '../api'
import { useAuth } from '../session/useAuth'
import ResetPasswordPage from './ResetPasswordPage'

vi.mock('../api', () => ({ resetPassword: vi.fn() }))
vi.mock('../session/useAuth', () => ({ useAuth: vi.fn() }))

const refresh = vi.fn()

const SUCCESS = 'Tu contraseña fue actualizada. Ingresá con tu nueva contraseña.'
const EXPIRED = 'El enlace para restablecer tu contraseña expiró. Solicitá uno nuevo.'
const INVALID = 'El enlace para restablecer tu contraseña no es válido. Solicitá uno nuevo.'
const GENERIC_ERROR = 'No se pudo actualizar la contraseña. Intentá nuevamente.'
const STRONG = 'Abcdef12'

function LoginProbe() {
  const { state } = useLocation()
  return <p>{`Pantalla de ingreso: ${(state as { notice?: string } | null)?.notice ?? 'sin aviso'}`}</p>
}

function renderPage(path = '/restablecer/abc123?email=ana%2Btest%40example.com') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/restablecer/:token" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/recuperar" element={<p>Pantalla de recuperación</p>} />
        <Route path="/" element={<p>Pantalla principal</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

type User = ReturnType<typeof userEvent.setup>

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'GUARDAR CONTRASEÑA' }))

async function fillAndSubmit(user: User, password = STRONG, confirmation = password) {
  await user.type(screen.getByLabelText('Nueva contraseña'), password)
  await user.type(screen.getByLabelText('Confirmar contraseña'), confirmation)
  await submit(user)
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(resetPassword).mockReset().mockResolvedValue(SUCCESS)
    refresh.mockReset().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({ user: null, status: 'guest', login: vi.fn(), refresh, logout: vi.fn() })
  })

  describe('layout', () => {
    it('renders the title, both password fields, the checklist and the buttons, with no email field or alert', () => {
      renderPage()

      expect(screen.getByRole('heading', { name: 'Definí tu nueva contraseña' })).toBeInTheDocument()
      expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('autocomplete', 'new-password')
      expect(screen.getByLabelText('Confirmar contraseña')).toHaveAttribute('autocomplete', 'new-password')
      expect(screen.getByRole('list', { name: 'Requisitos de la contraseña' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'GUARDAR CONTRASEÑA' })).toBeEnabled()
      expect(screen.getByRole('link', { name: 'VOLVER AL ACCESO' })).toHaveAttribute('href', '/login')
      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('updates the live checklist as the user types', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('Nueva contraseña'), STRONG)

      for (const item of screen.getAllByRole('listitem')) expect(item).toHaveAttribute('data-met', 'true')
    })

    it('navigates to the login screen from VOLVER AL ACCESO', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('link', { name: 'VOLVER AL ACCESO' }))
      expect(await screen.findByText(/Pantalla de ingreso/)).toBeInTheDocument()
    })
  })

  describe('submission', () => {
    it('sends the token, the decoded email, the password and its confirmation', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      await screen.findByText(/Pantalla de ingreso/)
      expect(resetPassword).toHaveBeenCalledTimes(1)
      expect(resetPassword).toHaveBeenCalledWith({
        token: 'abc123',
        email: 'ana+test@example.com',
        password: STRONG,
        passwordConfirmation: STRONG,
      })
    })

    it('goes to the login screen with the status text returned by the API as notice', async () => {
      vi.mocked(resetPassword).mockResolvedValue('Texto devuelto por el servidor.')
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByText('Pantalla de ingreso: Texto devuelto por el servidor.')).toBeInTheDocument()
    })
  })

  describe('client validation', () => {
    it('blocks a weak password and does not call the API', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user, 'abc')

      expect(screen.getByLabelText('Nueva contraseña')).toHaveAccessibleDescription(
        expect.stringContaining('La contraseña debe tener al menos 8 caracteres.'),
      )
      expect(resetPassword).not.toHaveBeenCalled()
    })

    it('blocks a confirmation that does not match and does not call the API', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user, STRONG, 'Abcdef13')

      expect(screen.getByLabelText('Confirmar contraseña')).toHaveAccessibleDescription('Las contraseñas no coinciden.')
      expect(resetPassword).not.toHaveBeenCalled()
    })

    it('clears a field error as soon as the user edits that field', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user, STRONG, 'Abcdef13')
      await user.type(screen.getByLabelText('Confirmar contraseña'), 'x')

      expect(screen.getByLabelText('Confirmar contraseña')).not.toHaveAttribute('aria-invalid')
    })
  })

  describe('pending state', () => {
    it('disables the button and shows GUARDANDO… while the request is in flight', async () => {
      let resolve!: (status: string) => void
      vi.mocked(resetPassword).mockReturnValue(new Promise<string>((r) => (resolve = r)))
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      const button = screen.getByRole('button', { name: 'GUARDANDO…' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      resolve(SUCCESS)
      expect(await screen.findByText(/Pantalla de ingreso/)).toBeInTheDocument()
    })
  })

  describe('link failures', () => {
    it('TC-08: an expired link shows the expiry message, offers SOLICITAR NUEVO ENLACE and no longer shows the form', async () => {
      vi.mocked(resetPassword).mockRejectedValue(
        new HttpError(422, { code: 'token_expired', message: EXPIRED, errors: { token: [EXPIRED] } }),
      )
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(EXPIRED)
      expect(screen.getByRole('link', { name: 'SOLICITAR NUEVO ENLACE' })).toHaveAttribute('href', '/recuperar')
      expect(screen.getByRole('link', { name: 'VOLVER AL ACCESO' })).toHaveAttribute('href', '/login')
      expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Confirmar contraseña')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'GUARDAR CONTRASEÑA' })).not.toBeInTheDocument()
      expect(resetPassword).toHaveBeenCalledTimes(1)
    })

    it('opens the recovery request from SOLICITAR NUEVO ENLACE', async () => {
      vi.mocked(resetPassword).mockRejectedValue(new HttpError(422, { code: 'token_expired', message: EXPIRED }))
      const user = userEvent.setup()
      renderPage()
      await fillAndSubmit(user)

      await user.click(await screen.findByRole('link', { name: 'SOLICITAR NUEVO ENLACE' }))

      expect(await screen.findByText('Pantalla de recuperación')).toBeInTheDocument()
    })

    it('shows the server message of an invalid link instead of the form', async () => {
      vi.mocked(resetPassword).mockRejectedValue(new HttpError(422, { code: 'token_invalid', message: INVALID }))
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(INVALID)
      expect(screen.getByRole('link', { name: 'SOLICITAR NUEVO ENLACE' })).toHaveAttribute('href', '/recuperar')
      expect(screen.queryByRole('button', { name: 'GUARDAR CONTRASEÑA' })).not.toBeInTheDocument()
    })

    it.each([
      ['the email parameter', '/restablecer/abc123'],
      ['an empty email parameter', '/restablecer/abc123?email='],
    ])('treats a link missing %s as invalid without calling the API', (_label, path) => {
      renderPage(path)

      expect(screen.getByRole('alert')).toHaveTextContent(INVALID)
      expect(screen.getByRole('link', { name: 'SOLICITAR NUEVO ENLACE' })).toHaveAttribute('href', '/recuperar')
      expect(screen.queryByRole('button', { name: 'GUARDAR CONTRASEÑA' })).not.toBeInTheDocument()
      expect(resetPassword).not.toHaveBeenCalled()
    })

    it('treats a 422 email problem as a malformed link', async () => {
      vi.mocked(resetPassword).mockRejectedValue(
        new HttpError(422, { errors: { email: ['El campo email debe ser una dirección válida.'] } }),
      )
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(INVALID)
      expect(screen.queryByRole('button', { name: 'GUARDAR CONTRASEÑA' })).not.toBeInTheDocument()
    })
  })

  describe('server errors', () => {
    it('shows the 422 password errors on the field and keeps the form usable', async () => {
      vi.mocked(resetPassword).mockRejectedValue(
        new HttpError(422, { errors: { password: ['La contraseña debe incluir al menos un número.'] } }),
      )
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByText('La contraseña debe incluir al menos un número.')).toBeInTheDocument()
      expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('button', { name: 'GUARDAR CONTRASEÑA' })).toBeEnabled()
    })

    it('refreshes the session and navigates to / when the server says one already exists (409)', async () => {
      vi.mocked(resetPassword).mockRejectedValue(new HttpError(409, { message: 'Ya existe una sesión.' }))
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('falls back to the generic alert on a 422 without a known problem', async () => {
      vi.mocked(resetPassword).mockRejectedValue(new HttpError(422, { errors: {} }))
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR)
      expect(screen.getByRole('button', { name: 'GUARDAR CONTRASEÑA' })).toBeEnabled()
    })

    it.each([
      ['a 500 response', new HttpError(500, { message: 'Server Error' })],
      ['a network failure', new TypeError('Failed to fetch')],
    ])('shows a generic alert on %s and keeps the form usable', async (_label, error) => {
      vi.mocked(resetPassword).mockRejectedValueOnce(error)
      const user = userEvent.setup()
      renderPage()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR)
      expect(screen.getByRole('button', { name: 'GUARDAR CONTRASEÑA' })).toBeEnabled()

      await submit(user)
      expect(await screen.findByText(/Pantalla de ingreso/)).toBeInTheDocument()
    })
  })
})
