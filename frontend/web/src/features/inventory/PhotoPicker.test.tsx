import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhotoPicker from './PhotoPicker'
import { vehiculo } from './fixtures'
import type { FotoVehiculo } from './types'
import { usePhotoDraft, type PhotoDraft } from './usePhotoDraft'

let latest: PhotoDraft
let counter = 0
const revoke = vi.fn()

function Harness({ initial, errors }: { initial?: FotoVehiculo[]; errors?: string[] }) {
  const draft = usePhotoDraft(initial)
  // The tests read the draft state that the panel does not show (counts, removed ids).
  useEffect(() => {
    latest = draft
  })
  return <PhotoPicker draft={draft} errors={errors} />
}

const jpg = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
const input = () => screen.getByLabelText('AGREGAR IMAGEN')
const saved = (count: number) => vehiculo({ fotos: Array.from({ length: count }, (_, i) => ({ id: i + 10, url: `http://x/${i}.jpg`, orden: i + 1 })) }).fotos

describe('PhotoPicker', () => {
  beforeEach(() => {
    counter = 0
    revoke.mockReset()
    URL.createObjectURL = vi.fn(() => `blob:preview-${++counter}`)
    URL.revokeObjectURL = revoke
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the empty panel of Figma 38:923: title, counter and the add control', () => {
    render(<Harness />)

    expect(screen.getByRole('heading', { name: 'Imágenes' })).toBeInTheDocument()
    expect(screen.getByText('0 de 7 imágenes cargadas.')).toBeInTheDocument()
    expect(input()).toHaveAttribute('type', 'file')
    expect(input()).toHaveAttribute('multiple')
    expect(input()).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('previews each picked file with a remove control and marks the first as the cover', async () => {
    render(<Harness />)

    await userEvent.setup({ applyAccept: false }).upload(input(), [jpg('a.jpg'), jpg('b.jpg')])

    const items = within(screen.getByRole('list', { name: 'Imágenes del vehículo' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('img', { name: 'Foto 1' })).toHaveAttribute('src', 'blob:preview-1')
    expect(within(items[0]).getByText('Portada')).toBeInTheDocument()
    expect(within(items[1]).queryByText('Portada')).not.toBeInTheDocument()
    expect(within(items[1]).getByRole('button', { name: 'Quitar foto 2' })).toBeInTheDocument()
    expect(screen.getByText('2 de 7 imágenes cargadas.')).toBeInTheDocument()
  })

  it('counts without the minimum once there are seven or more', async () => {
    render(<Harness initial={saved(7)} />)

    expect(screen.getByText('7 imágenes cargadas.')).toBeInTheDocument()
  })

  it('lists saved photos from their url before the new ones', async () => {
    render(<Harness initial={saved(2)} />)
    await userEvent.setup({ applyAccept: false }).upload(input(), [jpg('new.jpg')])

    const images = screen.getAllByRole('img')
    expect(images.map((image) => image.getAttribute('src'))).toEqual(['http://x/0.jpg', 'http://x/1.jpg', 'blob:preview-1'])
  })

  it('removes a new photo, revoking its preview URL', async () => {
    render(<Harness />)
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(input(), [jpg('a.jpg'), jpg('b.jpg')])

    await user.click(screen.getByRole('button', { name: 'Quitar foto 1' }))

    expect(revoke).toHaveBeenCalledWith('blob:preview-1')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Foto 1' })).toHaveAttribute('src', 'blob:preview-2')
    expect(latest.count).toBe(1)
  })

  it('removes a saved photo and reports its id as removed', async () => {
    render(<Harness initial={saved(3)} />)

    await userEvent.setup({ applyAccept: false }).click(screen.getByRole('button', { name: 'Quitar foto 2' }))

    expect(latest.removedIds).toEqual([11])
    expect(latest.kept.map((photo) => photo.id)).toEqual([10, 12])
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('revokes every preview URL on unmount', async () => {
    const { unmount } = render(<Harness />)
    await userEvent.setup({ applyAccept: false }).upload(input(), [jpg('a.jpg'), jpg('b.jpg')])

    unmount()

    expect(revoke).toHaveBeenCalledWith('blob:preview-1')
    expect(revoke).toHaveBeenCalledWith('blob:preview-2')
  })

  it('rejects a file of another type naming it, keeping the valid ones', async () => {
    render(<Harness />)

    await userEvent.setup({ applyAccept: false }).upload(input(), [new File(['x'], 'anim.gif', { type: 'image/gif' }), jpg('ok.jpg')])

    expect(within(screen.getByRole('list', { name: 'Imágenes del vehículo' })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('anim.gif: tiene que ser una imagen JPG, PNG o WebP.')).toBeInTheDocument()
  })

  it('refuses photos beyond twenty', async () => {
    render(<Harness initial={saved(19)} />)

    await userEvent.setup({ applyAccept: false }).upload(input(), [jpg('1.jpg'), jpg('2.jpg')])

    expect(latest.count).toBe(20)
    expect(screen.getByText('Podés cargar hasta 20 fotos.')).toBeInTheDocument()
  })

  it('shows the errors passed in and links them to the control', () => {
    render(<Harness errors={['Cargá al menos siete fotos.']} />)

    expect(screen.getByText('Cargá al menos siete fotos.')).toBeInTheDocument()
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(input()).toHaveAccessibleDescription('Cargá al menos siete fotos.')
  })

  it('clears the rejection messages when new files are picked', async () => {
    render(<Harness />)
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(input(), [new File(['x'], 'anim.gif', { type: 'image/gif' })])
    expect(screen.getByText('anim.gif: tiene que ser una imagen JPG, PNG o WebP.')).toBeInTheDocument()

    await user.upload(input(), [jpg('ok.jpg')])

    expect(screen.queryByText('anim.gif: tiene que ser una imagen JPG, PNG o WebP.')).not.toBeInTheDocument()
  })
})
