import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch, HttpError } from '../../../lib/http'
import DealerProfilePage from '../../../features/dealer/pages/DealerProfilePage'

vi.mock('../../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))

const endpoint = '/api/concesionaria/perfil'
const profile = { nombre: 'Autos del Plata', email: 'dealer@example.com', telefono_publico: '5491155550101',
  direccion: 'Av. Libertador 2450', localidad: 'Vicente López', provincia: 'Buenos Aires',
  responsable_nombre: 'Ana', responsable_apellido: 'Pérez', responsable_dni: '30123456', telefono_responsable: '1155550202' }
const editable = Object.fromEntries(Object.entries(profile).filter(([key]) => !['nombre', 'email'].includes(key)))
const save = () => userEvent.click(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

function mount() {
  const router = createMemoryRouter([
    { path: '/', element: <><Link to="/other">Inventario</Link><DealerProfilePage /></> },
    { path: '/other', element: <h1>Otra pantalla</h1> },
  ])
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockResolvedValue(profile)
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } },
  })
})

it('shows the saved fields, keeps commercial name and email read-only, and starts clean', async () => {
  mount()
  expect(await screen.findByLabelText('Nombre comercial')).toHaveValue(profile.nombre)
  for (const label of ['Nombre comercial', 'Email']) {
    expect(screen.getByLabelText(label)).toHaveAttribute('readonly')
    expect(screen.getByLabelText(label)).not.toBeDisabled()
  }
  expect(screen.getByLabelText('Nombre del responsable')).toHaveValue('Ana')
  expect(screen.getByLabelText('Teléfono público / WhatsApp')).toHaveValue(profile.telefono_publico)
  expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeDisabled()
  const phone = screen.getByLabelText('Teléfono público / WhatsApp')
  phone.scrollIntoView = vi.fn()
  vi.spyOn(phone, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 800, 100, 48))
  await userEvent.click(phone)
  expect(phone.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' })
})

it('saves trimmed editable values only, including a changed responsible person, and resets dirty state', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(profile).mockResolvedValueOnce({ ...profile, responsable_nombre: 'María' })
  mount()
  const input = await screen.findByLabelText('Nombre del responsable')
  await userEvent.clear(input)
  await userEvent.type(input, ' María ')
  await save()
  expect(await screen.findByRole('status')).toHaveTextContent('Guardaste los cambios del perfil.')
  expect(apiFetch).toHaveBeenLastCalledWith(endpoint, { method: 'PUT', body: { ...editable, responsable_nombre: 'María' } })
  expect(input).toHaveValue('María')
  expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeDisabled()
})

it('discards local edits without a request and guards navigation only while dirty', async () => {
  const router = mount()
  const input = await screen.findByLabelText('Dirección')
  await userEvent.type(input, ' nueva')
  await userEvent.click(screen.getByRole('link', { name: 'Inventario' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('Tenés cambios sin guardar')
  await userEvent.click(screen.getByRole('button', { name: 'SEGUIR EDITANDO' }))
  expect(router.state.location.pathname).toBe('/')
  expect(input).toHaveValue(`${profile.direccion} nueva`)
  await userEvent.click(screen.getByRole('button', { name: 'DESCARTAR CAMBIOS' }))
  expect(input).toHaveValue(profile.direccion)
  expect(apiFetch).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('link', { name: 'Inventario' }))
  expect(await screen.findByRole('heading', { name: 'Otra pantalla' })).toBeInTheDocument()
})

it('retains edits on server validation and network failures, allowing retry', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(profile)
    .mockRejectedValueOnce(new HttpError(422, { errors: { telefono_publico: ['Número inválido.'], direccion: ['Dirección inválida.'] } }))
    .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...profile, telefono_publico: null })
  mount()
  const input = await screen.findByLabelText('Teléfono público / WhatsApp')
  await userEvent.clear(input)
  await userEvent.type(input, '123')
  await save()
  expect(await screen.findByText('Número inválido.')).toBeInTheDocument()
  expect(input).toHaveAccessibleDescription(/Número inválido\./)
  expect(input).toHaveValue('123')
  await userEvent.clear(input)
  await userEvent.type(input, '54')
  expect(input).toHaveValue('54')
  expect(input).toHaveFocus()
  await userEvent.clear(input)
  await save()
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar')
  expect(input).toHaveValue('')
  await save()
  expect(await screen.findByRole('status')).toHaveTextContent('Guardaste los cambios')
  expect(apiFetch).toHaveBeenLastCalledWith(endpoint, { method: 'PUT', body: { ...editable, telefono_publico: '' } })
})

it('allows retry after a failed load and disables editing and duplicate submission while saving', async () => {
  let resolve!: (value: typeof profile) => void
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(profile)
    .mockImplementationOnce(() => new Promise((r) => { resolve = r }))
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'REINTENTAR' }))
  await userEvent.type(await screen.findByLabelText('Localidad'), ' Norte')
  await save()
  expect(screen.getByRole('button', { name: 'GUARDANDO…' })).toBeDisabled()
  expect(screen.getByLabelText('Localidad')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'DESCARTAR CAMBIOS' })).toBeDisabled()
  await userEvent.click(screen.getByRole('link', { name: 'Inventario' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  await act(async () => resolve({ ...profile, localidad: 'Vicente López Norte' }))
  await waitFor(() => expect(screen.getByLabelText('Localidad')).toBeEnabled())
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(3)
})
