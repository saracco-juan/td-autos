import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../../lib/http'
import { fetchBodyTypes, fetchVehicleCatalog, type VehicleSubmission } from '../../../features/inventory/api/client'
import { inactiveBody, MATCHING_FACTS, VEHICLE_CATALOG, vehiculo } from '../../fixtures/inventory/fixtures'
import { matchingValues } from '../../../features/inventory/model/matchingFields'
import VehicleForm from '../../../features/inventory/components/VehicleForm'
import { emptyValues, valuesFromVehicle, type VehicleValues } from '../../../features/inventory/model/vehicleFields'

vi.mock('../../../features/inventory/api/client', () => ({ fetchBodyTypes: vi.fn(), fetchVehicleCatalog: vi.fn() }))

const BODY_TYPES = [
  { id: 1, nombre: 'Sedán' },
  { id: 2, nombre: 'Hatchback' },
  { id: 3, nombre: 'SUV' },
]

const jpg = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
const sevenFiles = () => Array.from({ length: 7 }, (_, index) => jpg(`foto-${index + 1}.jpg`))

type Setup = { values?: VehicleValues; photos?: ReturnType<typeof vehiculo>['fotos']; onSubmit?: (s: VehicleSubmission) => Promise<void> }

async function renderForm({ values = emptyValues(), photos = [], onSubmit = () => Promise.resolve() }: Setup = {}) {
  const submit = vi.fn(onSubmit)
  render(
    <MemoryRouter>
      <VehicleForm title="Cargar vehículo" subtitle="Subtítulo" initialValues={values} initialPhotos={photos} isEditing={photos.length > 0} submitLabel="GUARDAR VEHÍCULO" onSubmit={submit} />
    </MemoryRouter>,
  )
  await screen.findByLabelText('Patente')
  return submit
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

const nextButton = () => screen.getByRole('button', { name: 'SIGUIENTE' })

async function advanceToPhotos(user = userEvent.setup(), startingStep = 0) {
  for (let step = startingStep; step < 4; step++) await user.click(nextButton())
}

async function advanceToStep(target: number, user = userEvent.setup()) {
  for (let step = 0; step < target; step++) await user.click(nextButton())
}

async function fillValid() {
  fill('Patente', 'ab-123 cd')
  fill('Marca', 'Toyota')
  fill('Modelo', 'Corolla')
  fill('Versión', 'XEI')
  fill('Año', '2021')
  const user = userEvent.setup({ applyAccept: false })
  await user.click(nextButton())
  fill('Kilometraje', '60000')
  fill('Precio', '18500000')
  fill('Moneda del precio', 'ARS')
  fill('Ubicación', 'Córdoba')
  fill('Descripción (opcional)', 'Buen estado')
  await user.click(nextButton())
  fill('Transmisión', 'automatica')
  fill('Combustible', 'nafta')
  fill('Carrocería', '1')
  for (const [key, value] of Object.entries(matchingValues(MATCHING_FACTS))) {
    const field = document.getElementById(`vehicle-${key}`)
    if (field) fireEvent.change(field, { target: { value } })
  }
  await user.click(nextButton())
  for (const [key, value] of Object.entries(matchingValues(MATCHING_FACTS))) {
    const field = document.getElementById(`vehicle-${key}`)
    if (field) fireEvent.change(field, { target: { value } })
  }
  await user.click(nextButton())
}

const submitButton = () => screen.getByRole('button', { name: /GUARD/ })

describe('VehicleForm', () => {
  beforeEach(() => {
    vi.mocked(fetchBodyTypes).mockReset()
    vi.mocked(fetchBodyTypes).mockResolvedValue(BODY_TYPES)
    vi.mocked(fetchVehicleCatalog).mockReset()
    vi.mocked(fetchVehicleCatalog).mockResolvedValue(VEHICLE_CATALOG)
  })

  it('keeps CANCELAR and the save button in the pinned action bar', async () => {
    await renderForm()

    const bar = screen.getByRole('group', { name: 'Acciones' })
    expect(within(bar).getByRole('link', { name: 'CANCELAR' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'SIGUIENTE' })).toHaveAttribute('type', 'submit')
  })

  it('HU21: exposes native catalog selectors and clears dependent identity when the make changes', async () => {
    await renderForm()
    const make = screen.getByLabelText('Marca')
    expect(make.tagName).toBe('SELECT')
    expect(within(make).getAllByRole('option').map((option) => option.textContent)).toContain('Toyota')
    await userEvent.setup().selectOptions(make, 'Toyota')
    expect(within(screen.getByLabelText('Modelo')).getAllByRole('option').map((option) => option.textContent)).toEqual(['Elegí una opción', 'Corolla'])
    await userEvent.setup().selectOptions(screen.getByLabelText('Modelo'), 'Corolla')
    await userEvent.setup().selectOptions(screen.getByLabelText('Versión'), 'XEI')
    await userEvent.setup().selectOptions(make, 'Honda')
    expect(screen.getByLabelText('Modelo')).toHaveValue('')
    expect(screen.getByLabelText('Versión')).toHaveValue('')
  })

  it('HU21: keeps catalog identity values limited to native select options', async () => {
    const saved = vehiculo()
    const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
    expect(screen.getByLabelText('Marca').tagName).toBe('SELECT')
    expect(screen.getByLabelText('Modelo').tagName).toBe('SELECT')
    expect(screen.getByLabelText('Versión').tagName).toBe('SELECT')
    expect(within(screen.getByLabelText('Versión')).getByRole('option', { name: 'XEI' })).toBeInTheDocument()
    expect(screen.getByLabelText('Patente')).toHaveAttribute('placeholder', 'Ej.: AB123CD o ABC123')
    expect(submit).not.toHaveBeenCalled()
  })

  it('HU21: preserves an existing linked identity during a catalog outage', async () => {
    vi.mocked(fetchVehicleCatalog).mockRejectedValue(new HttpError(503, {}))
    const saved = vehiculo({ acara_version_id: 'selected-corolla' })
    const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
    expect(screen.getByText(/El catálogo no está disponible/)).toBeInTheDocument()
    expect(screen.getByLabelText('Marca')).toHaveValue('Toyota')
    expect(screen.getByLabelText('Modelo')).toHaveValue('Corolla')
    expect(screen.getByLabelText('Versión')).toHaveValue('XEI')
    const user = userEvent.setup()
    await user.click(nextButton())
    fill('Precio', '20000000')
    await advanceToPhotos(user, 1)
    await user.click(submitButton())
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0][0].values.acara_version_id).toBe('selected-corolla')
  })

  it('HU21: rejects saving an unchanged unlinked vehicle', async () => {
    const saved = vehiculo({ acara_version_id: '' })
    const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })

    await userEvent.setup().click(nextButton())

    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Versión')).toHaveAccessibleDescription('Elegí la marca, el modelo y la versión del catálogo.')
  })

  describe('loading the body types', () => {
    it('shows a section loader and no form while the catalog loads', () => {
      vi.mocked(fetchBodyTypes).mockReturnValue(new Promise(() => {}))
      render(
        <MemoryRouter>
          <VehicleForm title="Cargar vehículo" subtitle="Subtítulo" initialValues={emptyValues()} initialPhotos={[]} submitLabel="GUARDAR VEHÍCULO" onSubmit={vi.fn()} />
        </MemoryRouter>,
      )

      expect(screen.getByRole('status')).toHaveTextContent('Cargando')
      expect(screen.queryByLabelText('Patente')).not.toBeInTheDocument()
    })

    it('offers a retry when the catalog fails and loads the form once it answers', async () => {
      vi.mocked(fetchBodyTypes).mockRejectedValueOnce(new NetworkError(new Error('down')))
      render(
        <MemoryRouter>
          <VehicleForm title="Cargar vehículo" subtitle="Subtítulo" initialValues={emptyValues()} initialPhotos={[]} submitLabel="GUARDAR VEHÍCULO" onSubmit={vi.fn()} />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión con el servidor')
      await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))

      expect(await screen.findByLabelText('Patente')).toBeInTheDocument()
      expect(fetchBodyTypes).toHaveBeenCalledTimes(2)
    })
  })

  describe('layout and fields', () => {
    it('HU05: offers a single Potencia (CV) input and submits CV without a selector', async () => {
      const saved = vehiculo({ acara_version_id: 'selected-corolla', potencia: 150, potencia_unidad: 'HP' })
      const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
      await advanceToStep(2)
      expect(screen.getByLabelText('Potencia (CV)')).toHaveValue('152')
      expect(screen.queryByLabelText('Unidad de potencia')).not.toBeInTheDocument()
      fill('Potencia (CV)', '140')
      await advanceToPhotos(userEvent.setup(), 2)
      await userEvent.setup().click(submitButton())
      expect(submit).toHaveBeenCalledTimes(1)
      expect(submit.mock.calls[0][0].values).toMatchObject({ potencia: '140', potencia_unidad: 'CV' })
    })

    it('HU05: requires explicit facts, preserves edits and explains a server rejection', async () => {
      const saved = vehiculo({ acara_version_id: 'selected-corolla' })
      const submit = await renderForm({
        values: valuesFromVehicle(saved),
        photos: saved.fotos,
        onSubmit: () => Promise.reject(new HttpError(422, { errors: { plazas: ['Revisá las plazas informadas.'] } })),
      })
      const user = userEvent.setup()
      await advanceToStep(2, user)
      fill('Plazas (incluye conductor)', '')
      await user.click(nextButton())
      expect(submit).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent(/plazas/i)
      expect(within(screen.getByRole('group', { name: 'Acciones' })).getByRole('alert')).toBeVisible()
      expect(screen.getByLabelText('Plazas (incluye conductor)')).toHaveFocus()
      fill('Plazas (incluye conductor)', '6')
      await user.click(nextButton())
      fill('Android Auto o Apple CarPlay', '0')
      await user.click(nextButton())
      await user.click(submitButton())
      expect(submit).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('alert')).toHaveTextContent('Revisá las plazas informadas.')
      expect(screen.getByLabelText('Plazas (incluye conductor)')).toHaveAccessibleDescription('Revisá las plazas informadas.')
      await user.click(nextButton())
      expect(screen.getByLabelText('Android Auto o Apple CarPlay')).toHaveValue('0')
      await user.click(nextButton())
      expect(screen.getAllByRole('img')).toHaveLength(7)
    })

    it('renders ordered fields inside the shared steps', async () => {
      const saved = vehiculo({ acara_version_id: 'selected-corolla', descripcion: 'Único dueño' })
      await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
      const controls = ['Patente', 'Marca', 'Modelo', 'Versión', 'Año'].map((label) => screen.getByLabelText(label))
      for (let index = 1; index < controls.length; index++) {
        expect(controls[index - 1].compareDocumentPosition(controls[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      }
      expect(screen.getByRole('link', { name: 'CANCELAR' })).toHaveAttribute('href', '/concesionaria/inventario')
      const user = userEvent.setup()
      await advanceToStep(1, user)
      expect(screen.getByLabelText('Descripción (opcional)').tagName).toBe('TEXTAREA')
      expect(screen.getByLabelText('Kilometraje').compareDocumentPosition(screen.getByLabelText('Descripción (opcional)')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      await user.click(nextButton())
      expect(screen.getByLabelText('Transmisión')).toBeInTheDocument()
      expect(screen.getByLabelText('Carrocería')).toBeInTheDocument()
      await advanceToPhotos(user, 2)
      expect(screen.getByRole('heading', { name: 'Imágenes' })).toBeInTheDocument()
      expect(submitButton()).toHaveTextContent('GUARDAR VEHÍCULO')
    })

    it('offers the options of the catalog and the fixed lists', async () => {
      const saved = vehiculo({ acara_version_id: 'selected-corolla' })
      await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
      await advanceToStep(2)

      const optionsOf = (label: string) => within(screen.getByLabelText(label)).getAllByRole('option').map((option) => option.textContent)
      expect(optionsOf('Carrocería')).toEqual(['Elegí una opción', 'Sedán', 'Hatchback', 'SUV'])
      expect(optionsOf('Transmisión')).toEqual(['Elegí una opción', 'Manual', 'Automática'])
      expect(optionsOf('Combustible')).toEqual(['Elegí una opción', 'Nafta', 'Diésel', 'GNC', 'Híbrido', 'Eléctrico'])
    })

    it('prefills the values and the saved photos', async () => {
      const saved = vehiculo({ acara_version_id: 'selected-corolla', version: 'XEI', descripcion: 'Único dueño', potencia: 150, potencia_unidad: 'HP' })
      await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })

      expect(screen.getByLabelText('Patente')).toHaveValue('AB123CD')
      expect(screen.getByLabelText('Versión')).toHaveValue('XEI')
      const user = userEvent.setup()
      await user.click(nextButton())
      expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('Único dueño')
      await user.click(nextButton())
      expect(screen.getByLabelText('Transmisión')).toHaveValue('automatica')
      expect(screen.getByLabelText('Carrocería')).toHaveValue('2')
      expect(screen.getByLabelText('Potencia (CV)')).toHaveValue('152')
      expect(screen.queryByLabelText('Unidad de potencia')).not.toBeInTheDocument()
      await advanceToPhotos(user, 2)
      expect(screen.getAllByRole('img')).toHaveLength(7)
      expect(screen.getByText('7 imágenes cargadas.')).toBeInTheDocument()
    })
  })

  describe('client validation', () => {
    it('validates the identity step and focuses its first invalid field', async () => {
      const submit = await renderForm()

      await userEvent.setup().click(nextButton())

      expect(submit).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Patente')).toHaveFocus()
      expect(screen.getByLabelText('Patente')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText('Patente')).toHaveAccessibleDescription('Indicá la patente.')
      expect(screen.getByLabelText('Marca')).toHaveAccessibleDescription('Indicá la marca.')
      expect(screen.queryByLabelText('Carrocería')).not.toBeInTheDocument()
    })

    it('focuses the photo control when the photos are the only problem', async () => {
      const saved = vehiculo({ acara_version_id: 'selected-corolla', fotos: [] })
      const submit = await renderForm({ values: valuesFromVehicle(saved) })
      await advanceToPhotos()

      await userEvent.setup().click(submitButton())

      expect(submit).not.toHaveBeenCalled()
      expect(screen.getByLabelText('AGREGAR IMAGEN')).toHaveFocus()
      expect(screen.getByText('Cargá al menos siete fotos.')).toBeInTheDocument()
    })

    it('rejects a plate with a wrong format', async () => {
      await renderForm()
      fill('Patente', 'ABCD12')
      fill('Marca', 'Toyota')
      fill('Modelo', 'Corolla')
      fill('Versión', 'XEI')
      fill('Año', '2021')

      await userEvent.setup().click(nextButton())

      expect(screen.getByLabelText('Patente')).toHaveAccessibleDescription('Ingresá una patente válida, por ejemplo AB123CD o ABC123.')
    })

    it('clears the error of a field as soon as it is edited', async () => {
      await renderForm()
      const user = userEvent.setup()
      await user.click(nextButton())
      expect(screen.getByLabelText('Marca')).toHaveAttribute('aria-invalid', 'true')

      await user.selectOptions(screen.getByLabelText('Marca'), 'Toyota')

      expect(screen.getByLabelText('Marca')).not.toHaveAttribute('aria-invalid')
    })

    it('counts the new photos together with the saved ones', async () => {
      const saved = vehiculo({ acara_version_id: 'selected-corolla', fotos: vehiculo().fotos.slice(0, 4) })
      const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
      await advanceToPhotos()

      await userEvent.setup({ applyAccept: false }).click(submitButton())
      expect(submit).not.toHaveBeenCalled()
      expect(screen.getByText('Cargá al menos siete fotos.')).toBeInTheDocument()

      await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText('AGREGAR IMAGEN'), [jpg('a.jpg'), jpg('b.jpg'), jpg('c.jpg')])
      await userEvent.setup().click(submitButton())

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    })
  })

  describe('submitting', () => {
    it('sends the values, the new files in order and the removed saved photo ids', async () => {
      const saved = vehiculo({ version: 'XEI' })
      const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
      const user = userEvent.setup({ applyAccept: false })
      await user.selectOptions(screen.getByLabelText('Marca'), 'Honda')
      await user.selectOptions(screen.getByLabelText('Modelo'), 'Civic')
      await user.selectOptions(screen.getByLabelText('Versión'), 'EX')
      await advanceToPhotos(user)
      const files = [jpg('nueva.jpg')]
      await user.click(screen.getByRole('button', { name: 'Quitar foto 2' }))
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), files)

      await user.click(submitButton())

      expect(submit).toHaveBeenCalledTimes(1)
      const sent = submit.mock.calls[0][0]
      expect(sent.values).toEqual({ ...valuesFromVehicle(saved), marca: 'Honda', modelo: 'Civic', version: 'EX', acara_version_id: 'selected-civic' })
      expect(sent.newPhotos).toEqual(files)
      expect(sent.removedPhotoIds).toEqual([2])
    })

    it('shows a busy state on the button while the request runs and keeps the form', async () => {
      let finish: () => void = () => {}
      const submit = await renderForm({ onSubmit: () => new Promise<void>((resolve) => (finish = resolve)) })
      await fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())

      await user.click(submitButton())

      expect(submit).toHaveBeenCalledTimes(1)
      expect(submitButton()).toBeDisabled()
      expect(submitButton()).toHaveAttribute('aria-busy', 'true')
      expect(submitButton()).toHaveTextContent('GUARDANDO…')
      expect(screen.getByRole('heading', { name: 'Fotos' })).toBeInTheDocument()
      expect(screen.getByText('7 imágenes cargadas.')).toBeInTheDocument()
      finish()
    })

    it('maps a 422 to the identity step and focuses the first invalid field', async () => {
      const body = {
        message: 'The given data was invalid.',
        errors: {
          modelo: ['Indicá el modelo.'],
          patente: ['Esa patente ya está cargada en la plataforma.'],
        },
      }
      await renderForm({ onSubmit: () => Promise.reject(new HttpError(422, body)) })
      await fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())

      await user.click(submitButton())

      expect(await screen.findByText('Esa patente ya está cargada en la plataforma.')).toBeInTheDocument()
      expect(screen.getByLabelText('Patente')).toHaveFocus()
      expect(screen.getByLabelText('Modelo')).toHaveAccessibleDescription('Indicá el modelo.')
      expect(nextButton()).toBeEnabled()
      expect(screen.getByRole('alert')).toHaveTextContent('Esa patente ya está cargada en la plataforma.')
    })

    it('shows a filled error near the actions on a network failure and keeps everything', async () => {
      await renderForm({ onSubmit: () => Promise.reject(new NetworkError(new Error('down'))) })
      await fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())

      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
      expect(screen.getByText('7 imágenes cargadas.')).toBeInTheDocument()
      for (let step = 0; step < 4; step++) await user.click(screen.getByRole('button', { name: 'ANTERIOR' }))
      expect(screen.getByLabelText('Marca')).toHaveValue('Toyota')
      expect(nextButton()).toBeEnabled()
    })

    it('explains an inactive subscription in a compact box with a way to renew instead of the generic error', async () => {
      const body = inactiveBody()
      await renderForm({ onSubmit: () => Promise.reject(new HttpError(403, body)) })
      await fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())

      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(body.message)
      expect(screen.getByRole('link', { name: 'RENOVAR SUSCRIPCIÓN' })).toHaveAttribute('href', '/concesionaria/suscripcion')
      expect(screen.queryByText('No pudimos guardar el vehículo. Probá de nuevo.')).not.toBeInTheDocument()
      expect(submitButton()).toBeEnabled()
    })

    it('shows the generic error on a server failure or a 422 it cannot map', async () => {
      const submit = await renderForm({ onSubmit: () => Promise.reject(new HttpError(500, 'Server Error')) })
      await fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())

      await user.click(submitButton())
      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar el vehículo. Probá de nuevo.')

      submit.mockRejectedValueOnce(new HttpError(422, { errors: { otro: ['x'] } }))
      await user.click(submitButton())
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(2))
      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar el vehículo. Probá de nuevo.')
    })

    it('clears the previous error message when submitting again', async () => {
      const submit = await renderForm({ onSubmit: () => Promise.reject(new HttpError(500, undefined)) })
      await fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())
      await user.click(submitButton())
      await screen.findByRole('alert')

      submit.mockImplementationOnce(() => new Promise(() => {}))
      await user.click(submitButton())

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
