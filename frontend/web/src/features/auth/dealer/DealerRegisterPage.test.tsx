import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../lib/http'
import { registerDealer } from '../api'
import { useAuth } from '../session/useAuth'
import DealerRegisterPage from './DealerRegisterPage'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  registerDealer: vi.fn(),
}))

vi.mock('../session/useAuth', () => ({ useAuth: vi.fn() }))

const refresh = vi.fn()

const createdUser = {
  id: 2,
  name: 'Marta',
  apellido: 'Gómez',
  email: 'marta@autosdelsur.com',
  rol: 'concesionaria',
  perfil_completo: true,
  tiene_diagnostico: false,
  concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta: 'pendiente' },
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/registro/concesionaria']}>
      <Routes>
        <Route path="/registro/concesionaria" element={<DealerRegisterPage />} />
        <Route path="/concesionaria" element={<p>Estado de la concesionaria</p>} />
        <Route path="/" element={<p>Pantalla principal</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Labels in the Figma order (38:779): left column, then right column, row by row.
const validFields = {
  'Nombre de la concesionaria': 'Autos del Sur',
  Email: 'marta@autosdelsur.com',
  'Nombre del responsable': 'Marta',
  'Apellido del responsable': 'Gómez',
  'DNI del responsable': '30111222',
  'Teléfono del responsable': '1144445555',
  'Teléfono público': '1143210000',
  Dirección: 'Av. Mitre 1234',
  Localidad: 'Avellaneda',
  Provincia: 'Buenos Aires',
  Contraseña: 'Abcdef12',
  'Confirmar contraseña': 'Abcdef12',
}

type Label = keyof typeof validFields
type User = ReturnType<typeof userEvent.setup>

// Pastes each value in one input event: typing ~130 keystrokes pushed these tests past the 5 s timeout under
// full-suite load. Per-keystroke behavior is covered by the live checklist and error-clearing tests.
async function fillForm(user: User, overrides: Partial<Record<Label, string>> = {}) {
  for (const [label, value] of Object.entries({ ...validFields, ...overrides })) {
    if (!value) continue
    await user.click(screen.getByLabelText(label))
    await user.paste(value)
  }
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'CREAR CUENTA' }))

describe('DealerRegisterPage', () => {
  beforeEach(() => {
    vi.mocked(registerDealer).mockReset()
    vi.mocked(registerDealer).mockResolvedValue(createdUser)
    refresh.mockReset().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({ user: null, status: 'guest', login: vi.fn(), refresh, logout: vi.fn() })
  })

  describe('layout', () => {
    it('renders the wordmark, title, subtitle and login link, without Google', () => {
      renderPage()

      expect(screen.getByText('TD AUTOS')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Registrá tu concesionaria' })).toBeInTheDocument()
      expect(screen.getByText('Completá los datos para solicitar la adhesión a la plataforma.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login')
      expect(screen.queryByRole('link', { name: 'CONTINUAR CON GOOGLE' })).not.toBeInTheDocument()
    })

    it('uses the wide card', () => {
      renderPage()

      expect(screen.getByRole('region', { name: 'Registrá tu concesionaria' }).className).toMatch(/wide/)
    })

    it('lists the twelve fields in the Figma order', () => {
      renderPage()

      const labels = [...document.querySelectorAll('label')].map((label) => label.textContent)
      expect(labels).toEqual(Object.keys(validFields))
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

    it('checks off each password requirement live as the user types', async () => {
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
      expect(password).toHaveAttribute('aria-describedby', checklist.id)
      expect(metState()).toEqual(['false', 'false', 'false', 'false'])

      await user.type(password, 'abc')
      expect(metState()).toEqual(['false', 'false', 'true', 'false'])

      await user.clear(password)
      await user.type(password, 'Abcdef12')
      expect(metState()).toEqual(['true', 'true', 'true', 'true'])
    })
  })

  describe('submission', () => {
    it('TC-44: submits a valid form with the API payload, then goes to /concesionaria', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByText('Estado de la concesionaria')).toBeInTheDocument()
      expect(registerDealer).toHaveBeenCalledTimes(1)
      expect(registerDealer).toHaveBeenCalledWith({
        nombre_concesionaria: 'Autos del Sur',
        name: 'Marta',
        apellido: 'Gómez',
        responsable_dni: '30111222',
        telefono_publico: '1143210000',
        telefono_responsable: '1144445555',
        email: 'marta@autosdelsur.com',
        direccion: 'Av. Mitre 1234',
        localidad: 'Avellaneda',
        provincia: 'Buenos Aires',
        password: 'Abcdef12',
        password_confirmation: 'Abcdef12',
      })
    })

    it('TC-44: refreshes the session before navigating, so the route guards see the new dealer', async () => {
      let resolveRefresh!: () => void
      refresh.mockReturnValue(new Promise<void>((r) => (resolveRefresh = r)))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      expect(screen.queryByText('Estado de la concesionaria')).not.toBeInTheDocument()
      resolveRefresh()
      expect(await screen.findByText('Estado de la concesionaria')).toBeInTheDocument()
    })

    it('trims the text fields and sends the passwords untouched', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { Email: '  marta@autosdelsur.com ', Localidad: ' Avellaneda ', Contraseña: ' Abcdef12', 'Confirmar contraseña': ' Abcdef12' })
      await submit(user)

      expect(await screen.findByText('Estado de la concesionaria')).toBeInTheDocument()
      expect(registerDealer).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'marta@autosdelsur.com',
          localidad: 'Avellaneda',
          password: ' Abcdef12',
          password_confirmation: ' Abcdef12',
        }),
      )
    })

    it('navigates to / when the server says a session already exists (409)', async () => {
      vi.mocked(registerDealer).mockRejectedValue(new HttpError(409, { message: 'Ya existe una sesión iniciada.' }))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
      expect(refresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('client validation', () => {
    it.each([
      ['Nombre de la concesionaria', 'El nombre de la concesionaria es obligatorio.'],
      ['Email', 'El email es obligatorio.'],
      ['Nombre del responsable', 'El nombre es obligatorio.'],
      ['Apellido del responsable', 'El apellido es obligatorio.'],
      ['DNI del responsable', 'El DNI es obligatorio.'],
      ['Teléfono del responsable', 'El teléfono del responsable es obligatorio.'],
      ['Teléfono público', 'El teléfono de la concesionaria es obligatorio.'],
      ['Dirección', 'La dirección es obligatoria.'],
      ['Localidad', 'La localidad es obligatoria.'],
      ['Provincia', 'La provincia es obligatoria.'],
    ] as const)('TC-80: blocks submit without %s', async (label, message) => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { [label]: '' })
      await submit(user)

      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message)
      expect(registerDealer).not.toHaveBeenCalled()
    })

    it('TC-80: flags every field of an empty form and does not call the API', async () => {
      const user = userEvent.setup()
      renderPage()

      await submit(user)

      for (const label of Object.keys(validFields).filter((label) => label !== 'Confirmar contraseña')) {
        expect(screen.getByLabelText(label)).toBeInvalid()
      }
      expect(registerDealer).not.toHaveBeenCalled()
    })

    it('lists every unmet password requirement and blocks submit', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { Contraseña: 'abc', 'Confirmar contraseña': 'abc' })
      await submit(user)

      expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument()
      expect(screen.getByText('La contraseña debe incluir al menos una letra mayúscula.')).toBeInTheDocument()
      expect(screen.getByText('La contraseña debe incluir al menos un número.')).toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Requisitos de la contraseña' })).not.toBeInTheDocument()
      expect(registerDealer).not.toHaveBeenCalled()
    })

    it('blocks submit when the confirmation does not match or the email is invalid', async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { Email: 'no-es-email', 'Confirmar contraseña': 'Abcdef13' })
      await submit(user)

      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Ingresá un email válido.')
      expect(screen.getByLabelText('Confirmar contraseña')).toHaveAccessibleDescription('Las contraseñas no coinciden.')
      expect(registerDealer).not.toHaveBeenCalled()
    })

    it('clears the error of a field as soon as it is edited', async () => {
      const user = userEvent.setup()
      renderPage()

      await submit(user)
      await user.type(screen.getByLabelText('Localidad'), 'A')

      expect(screen.getByLabelText('Localidad')).not.toBeInvalid()
      expect(screen.getByLabelText('Provincia')).toBeInvalid()
    })
  })

  describe('pending state', () => {
    it('disables the button and shows CREANDO CUENTA… while the request is in flight', async () => {
      let resolve!: (value: typeof createdUser) => void
      vi.mocked(registerDealer).mockReturnValue(new Promise((r) => (resolve = r)))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(screen.getByRole('button', { name: 'CREANDO CUENTA…' })).toBeDisabled()
      resolve(createdUser)
      expect(await screen.findByText('Estado de la concesionaria')).toBeInTheDocument()
    })
  })

  describe('server errors', () => {
    it('shows each 422 error on its field, mapping the API keys to the form fields', async () => {
      vi.mocked(registerDealer).mockRejectedValue(
        new HttpError(422, {
          errors: {
            nombre_concesionaria: ['El nombre de la concesionaria no puede superar los 150 caracteres.'],
            name: ['El nombre no puede superar los 255 caracteres.'],
            apellido: ['El apellido no puede superar los 100 caracteres.'],
            responsable_dni: ['El DNI no puede superar los 20 caracteres.'],
            telefono_publico: ['El teléfono de la concesionaria no puede superar los 30 caracteres.'],
            telefono_responsable: ['El teléfono del responsable no puede superar los 30 caracteres.'],
            email: ['El email ya está en uso.'],
            direccion: ['La dirección no puede superar los 255 caracteres.'],
            localidad: ['La localidad no puede superar los 100 caracteres.'],
            provincia: ['La provincia no puede superar los 100 caracteres.'],
            password: ['La contraseña debe incluir al menos un número.'],
          },
        }),
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      const expected: Partial<Record<Label, string>> = {
        'Nombre de la concesionaria': 'El nombre de la concesionaria no puede superar los 150 caracteres.',
        Email: 'El email ya está en uso.',
        'Nombre del responsable': 'El nombre no puede superar los 255 caracteres.',
        'Apellido del responsable': 'El apellido no puede superar los 100 caracteres.',
        'DNI del responsable': 'El DNI no puede superar los 20 caracteres.',
        'Teléfono del responsable': 'El teléfono del responsable no puede superar los 30 caracteres.',
        'Teléfono público': 'El teléfono de la concesionaria no puede superar los 30 caracteres.',
        Dirección: 'La dirección no puede superar los 255 caracteres.',
        Localidad: 'La localidad no puede superar los 100 caracteres.',
        Provincia: 'La provincia no puede superar los 100 caracteres.',
        Contraseña: 'La contraseña debe incluir al menos un número.',
      }
      await screen.findByText('El email ya está en uso.')
      for (const [label, message] of Object.entries(expected)) {
        expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message)
      }
      expect(screen.getByLabelText('Confirmar contraseña')).not.toBeInvalid()
      expect(screen.queryByText('Estado de la concesionaria')).not.toBeInTheDocument()
      expect(refresh).not.toHaveBeenCalled()
    })

    // Laravel's `confirmed` rule reports the mismatch under `password`; no `password_confirmation` key ever arrives.
    it('shows the confirmation mismatch reported by the server on the password field', async () => {
      vi.mocked(registerDealer).mockRejectedValue(new HttpError(422, { errors: { password: ['Las contraseñas no coinciden.'] } }))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
      expect(screen.getByLabelText('Contraseña')).toBeInvalid()
      expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('Las contraseñas no coinciden.')
      expect(screen.getByLabelText('Confirmar contraseña')).not.toBeInvalid()
      expect(screen.getByLabelText('Confirmar contraseña')).not.toHaveAccessibleDescription('Las contraseñas no coinciden.')
    })

    it('ignores a password_confirmation key, which the API never sends', async () => {
      vi.mocked(registerDealer).mockRejectedValue(
        new HttpError(422, { errors: { password_confirmation: ['Las contraseñas no coinciden.'] } }),
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar el registro. Intentá nuevamente.')
      expect(screen.getByLabelText('Confirmar contraseña')).not.toBeInvalid()
    })

    it.each([
      ['a 500 response', new HttpError(500, { message: 'Server Error' })],
      ['a network failure', new TypeError('Failed to fetch')],
      ['a 422 without field errors', new HttpError(422, { message: 'Datos inválidos.' })],
    ])('shows a generic error on %s and keeps the form usable', async (_label, error) => {
      vi.mocked(registerDealer).mockRejectedValueOnce(error)
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await submit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar el registro. Intentá nuevamente.')
      expect(screen.getByRole('button', { name: 'CREAR CUENTA' })).toBeEnabled()

      await submit(user)
      expect(await screen.findByText('Estado de la concesionaria')).toBeInTheDocument()
      expect(registerDealer).toHaveBeenCalledTimes(2)
    })
  })
})
