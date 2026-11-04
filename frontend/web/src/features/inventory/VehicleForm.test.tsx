import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { fetchBodyTypes, fetchVehicleCatalog, type VehicleSubmission } from './api'
import { inactiveBody, MATCHING_FACTS, VEHICLE_CATALOG, vehiculo } from './fixtures'
import { matchingValues } from './matchingFields'
import VehicleForm from './VehicleForm'
import { emptyValues, valuesFromVehicle, type VehicleValues } from './vehicleFields'

vi.mock('./api', () => ({ fetchBodyTypes: vi.fn(), fetchVehicleCatalog: vi.fn() }))

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

function fillValid() {
  fill('Patente', 'ab-123 cd')
  fill('Marca', 'Toyota')
  fill('Modelo', 'Corolla')
  fill('Versión', 'XEI')
  fill('Año', '2021')
  fill('Kilometraje', '60000')
  fill('Precio', '18500000')
  fill('Transmisión', 'automatica')
  fill('Combustible', 'nafta')
  fill('Carrocería', '1')
  fill('Ubicación', 'Córdoba')
  for (const [key, value] of Object.entries(matchingValues(MATCHING_FACTS))) {
    if (key === 'potencia_unidad') continue
    fireEvent.change(document.getElementById(`vehicle-${key}`)!, { target: { value } })
  }
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
    expect(within(bar).getByRole('button', { name: 'GUARDAR VEHÍCULO' })).toHaveAttribute('type', 'submit')
  })

  it('HU21: exposes searchable catalog options and clears dependent identity when the make changes', async () => {
    await renderForm()
    expect(screen.getByLabelText('Marca')).toHaveAttribute('list', 'vehicle-marca-options')
    fill('Marca', 'Toyota')
    expect(document.querySelector('#vehicle-modelo-options option')).toHaveAttribute('value', 'Corolla')
    expect(document.querySelector('#vehicle-modelo-options option[value="Civic"]')).toBeNull()
    fill('Modelo', 'Corolla')
    fill('Versión', 'XEI')
    fill('Marca', 'Other')
    expect(screen.getByLabelText('Modelo')).toHaveValue('')
    expect(screen.getByLabelText('Versión')).toHaveValue('')
  })

  it('HU21: prevents free-text versions outside the catalog from being submitted', async () => {
    const saved = vehiculo()
    const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
    fill('Versión', 'Invented version')
    await userEvent.setup().click(submitButton())
    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Versión')).toHaveAccessibleDescription('Elegí la marca, el modelo y la versión del catálogo.')
  })

  it('HU21: preserves an existing linked identity during a catalog outage', async () => {
    vi.mocked(fetchVehicleCatalog).mockRejectedValue(new HttpError(503, {}))
    const saved = vehiculo({ acara_version_id: 'selected-corolla' })
    const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })
    expect(screen.getByText(/El catálogo no está disponible/)).toBeInTheDocument()
    fill('Precio', '20000000')
    await userEvent.setup().click(submitButton())
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0][0].values.acara_version_id).toBe('selected-corolla')
  })

  it('HU21: rejects saving an unchanged unlinked vehicle', async () => {
    const saved = vehiculo({ acara_version_id: '' })
    const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })

    await userEvent.setup().click(submitButton())

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
      const submit = await renderForm()
      expect(screen.getByLabelText('Potencia (CV)')).toHaveValue('')
      expect(screen.queryByLabelText('Unidad de potencia')).not.toBeInTheDocument()
      fillValid()
      await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())
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
      fill('Plazas (incluye conductor)', '')
      await userEvent.setup().click(submitButton())
      expect(submit).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent(/plazas/i)
      expect(within(screen.getByRole('group', { name: 'Acciones' })).getByRole('alert')).toBeVisible()
      expect(screen.getByLabelText('Plazas (incluye conductor)')).toHaveFocus()
      fill('Plazas (incluye conductor)', '6')
      fill('Android Auto o Apple CarPlay', '0')
      await userEvent.setup().click(submitButton())
      expect(submit).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('alert')).toHaveTextContent('Revisá las plazas informadas.')
      expect(screen.getByLabelText('Plazas (incluye conductor)')).toHaveAccessibleDescription('Revisá las plazas informadas.')
      expect(screen.getByLabelText('Android Auto o Apple CarPlay')).toHaveValue('0')
      expect(screen.getAllByRole('img')).toHaveLength(7)
    })

    it('renders the fields in order with their labels, and the actions of Figma 38:923', async () => {
      await renderForm()

      const labels = ['Patente', 'Marca', 'Modelo', 'Versión', 'Año', 'Kilometraje', 'Precio', 'Transmisión', 'Combustible', 'Carrocería', 'Ubicación', 'Descripción (opcional)']
      const controls = labels.map((label) => screen.getByLabelText(label))
      for (let index = 1; index < controls.length; index++) {
        expect(controls[index - 1].compareDocumentPosition(controls[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      }
      expect(screen.getByLabelText('Descripción (opcional)').tagName).toBe('TEXTAREA')
      expect(screen.getByRole('heading', { name: 'Imágenes' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'CANCELAR' })).toHaveAttribute('href', '/concesionaria/inventario')
      expect(submitButton()).toHaveTextContent('GUARDAR VEHÍCULO')
    })

    it('offers the options of the catalog and the fixed lists', async () => {
      await renderForm()

      const optionsOf = (label: string) => within(screen.getByLabelText(label)).getAllByRole('option').map((option) => option.textContent)
      expect(optionsOf('Carrocería')).toEqual(['Elegí una opción', 'Sedán', 'Hatchback', 'SUV'])
      expect(optionsOf('Transmisión')).toEqual(['Elegí una opción', 'Manual', 'Automática'])
      expect(optionsOf('Combustible')).toEqual(['Elegí una opción', 'Nafta', 'Diésel', 'GNC', 'Híbrido', 'Eléctrico'])
    })

    it('prefills the values and the saved photos', async () => {
      const saved = vehiculo({ version: 'XEI', descripcion: 'Único dueño', potencia: 150, potencia_unidad: 'HP' })
      await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })

      expect(screen.getByLabelText('Patente')).toHaveValue('AB123CD')
      expect(screen.getByLabelText('Versión')).toHaveValue('XEI')
      expect(screen.getByLabelText('Transmisión')).toHaveValue('automatica')
      expect(screen.getByLabelText('Carrocería')).toHaveValue('2')
      expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('Único dueño')
      expect(screen.getByLabelText('Potencia (CV)')).toHaveValue('152')
      expect(screen.queryByLabelText('Unidad de potencia')).not.toBeInTheDocument()
      expect(screen.getAllByRole('img')).toHaveLength(7)
      expect(screen.getByText('7 imágenes cargadas.')).toBeInTheDocument()
    })
  })

  describe('client validation', () => {
    it('shows every error, does not submit and moves the focus to the first invalid field', async () => {
      const submit = await renderForm()

      await userEvent.setup().click(submitButton())

      expect(submit).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Patente')).toHaveFocus()
      expect(screen.getByLabelText('Patente')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText('Patente')).toHaveAccessibleDescription('Indicá la patente.')
      expect(screen.getByLabelText('Marca')).toHaveAccessibleDescription('Indicá la marca.')
      expect(screen.getByLabelText('Carrocería')).toHaveAccessibleDescription('Elegí la carrocería.')
      expect(screen.getByText('Cargá al menos siete fotos.')).toBeInTheDocument()
    })

    it('focuses the photo control when the photos are the only problem', async () => {
      const submit = await renderForm()
      fillValid()

      await userEvent.setup().click(submitButton())

      expect(submit).not.toHaveBeenCalled()
      expect(screen.getByLabelText('AGREGAR IMAGEN')).toHaveFocus()
      expect(screen.getByText('Cargá al menos siete fotos.')).toBeInTheDocument()
    })

    it('rejects a plate with a wrong format', async () => {
      await renderForm()
      fillValid()
      fill('Patente', 'ABCD12')

      await userEvent.setup().click(submitButton())

      expect(screen.getByLabelText('Patente')).toHaveAccessibleDescription('Ingresá una patente válida, por ejemplo AB123CD o ABC123.')
    })

    it('clears the error of a field as soon as it is edited', async () => {
      await renderForm()
      const user = userEvent.setup()
      await user.click(submitButton())
      expect(screen.getByLabelText('Marca')).toHaveAttribute('aria-invalid', 'true')

      await user.type(screen.getByLabelText('Marca'), 'T')

      expect(screen.getByLabelText('Marca')).not.toHaveAttribute('aria-invalid')
    })

    it('counts the new photos together with the saved ones', async () => {
      const saved = vehiculo({ acara_version_id: 'selected-corolla', fotos: vehiculo().fotos.slice(0, 4) })
      const submit = await renderForm({ values: valuesFromVehicle(saved), photos: saved.fotos })

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
      const files = [jpg('nueva.jpg')]
      await user.click(screen.getByRole('button', { name: 'Quitar foto 2' }))
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), files)
      fill('Marca', 'Honda')
      fill('Modelo', 'Civic')
      fill('Versión', 'EX')

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
      fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())

      await user.click(submitButton())

      expect(submit).toHaveBeenCalledTimes(1)
      expect(submitButton()).toBeDisabled()
      expect(submitButton()).toHaveAttribute('aria-busy', 'true')
      expect(submitButton()).toHaveTextContent('GUARDANDO…')
      expect(screen.getByLabelText('Marca')).toHaveValue('Toyota')
      finish()
    })

    it('maps a 422 to the fields and the photo panel and focuses the first invalid one', async () => {
      const body = {
        message: 'The given data was invalid.',
        errors: {
          modelo: ['Indicá el modelo.'],
          patente: ['Esa patente ya está cargada en la plataforma.'],
          'fotos.0': ['Cada foto tiene que ser una imagen JPG, PNG o WebP.'],
        },
      }
      await renderForm({ onSubmit: () => Promise.reject(new HttpError(422, body)) })
      fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())

      await user.click(submitButton())

      expect(await screen.findByText('Esa patente ya está cargada en la plataforma.')).toBeInTheDocument()
      expect(screen.getByLabelText('Patente')).toHaveFocus()
      expect(screen.getByLabelText('Modelo')).toHaveAccessibleDescription('Indicá el modelo.')
      expect(screen.getByText('Cada foto tiene que ser una imagen JPG, PNG o WebP.')).toBeInTheDocument()
      expect(submitButton()).toBeEnabled()
      expect(screen.getByRole('alert')).toHaveTextContent('Esa patente ya está cargada en la plataforma.')
    })

    it('shows a filled error near the actions on a network failure and keeps everything', async () => {
      await renderForm({ onSubmit: () => Promise.reject(new NetworkError(new Error('down'))) })
      fillValid()
      const user = userEvent.setup({ applyAccept: false })
      await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), sevenFiles())

      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
      expect(screen.getByLabelText('Marca')).toHaveValue('Toyota')
      expect(screen.getAllByRole('img')).toHaveLength(7)
      expect(submitButton()).toBeEnabled()
    })

    it('explains an inactive subscription in a compact box with a way to renew instead of the generic error', async () => {
      const body = inactiveBody()
      await renderForm({ onSubmit: () => Promise.reject(new HttpError(403, body)) })
      fillValid()
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
      fillValid()
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
      fillValid()
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
