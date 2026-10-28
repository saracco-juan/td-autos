import { fireEvent, render, screen } from '@testing-library/react-native'

import VehicleGallery from '../../../features/vehicle-detail/VehicleGallery'

const PHOTOS = [
  { id: 2, url: 'https://example.test/two.jpg', orden: 2 },
  { id: 1, url: 'https://example.test/one.jpg', orden: 1 },
  { id: 3, url: 'https://example.test/three.jpg', orden: 3 },
]
const TITLE = 'Toyota Corolla XEI 2021'
const cover = () => screen.getByTestId('gallery-cover')
const thumbnail = (position: number) => screen.getByRole('button', { name: `Ver foto ${position} de ${TITLE}` })

describe('VehicleGallery', () => {
  it('shows the first photo by order as the cover, with one thumbnail button per photo', async () => {
    await render(<VehicleGallery photos={PHOTOS} title={TITLE} />)

    expect(cover().props.accessibilityLabel).toBe(`Foto 1 de ${TITLE}`)
    expect(cover().props.source).toEqual({ uri: 'https://example.test/one.jpg' })
    expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
      `Ver foto 1 de ${TITLE}`,
      `Ver foto 2 de ${TITLE}`,
      `Ver foto 3 de ${TITLE}`,
    ])
    expect(thumbnail(1)).toBeSelected()
  })

  it('changes the cover when a thumbnail is pressed', async () => {
    await render(<VehicleGallery photos={PHOTOS} title={TITLE} />)

    await fireEvent.press(thumbnail(3))

    expect(cover().props.source).toEqual({ uri: 'https://example.test/three.jpg' })
    expect(cover().props.accessibilityLabel).toBe(`Foto 3 de ${TITLE}`)
    expect(thumbnail(3)).toBeSelected()
  })

  it('says the cover is unavailable when it fails, keeping the other photos reachable', async () => {
    await render(<VehicleGallery photos={PHOTOS} title={TITLE} />)

    await fireEvent(cover(), 'error')

    expect(screen.getByText('Esta foto no está disponible.')).toBeOnTheScreen()
    expect(screen.queryByTestId('gallery-cover')).not.toBeOnTheScreen()
    await fireEvent.press(thumbnail(2))
    expect(cover().props.source).toEqual({ uri: 'https://example.test/two.jpg' })
  })

  it('replaces a broken thumbnail by a text fallback', async () => {
    await render(<VehicleGallery photos={PHOTOS} title={TITLE} />)

    await fireEvent(screen.getByTestId('gallery-thumbnail-2'), 'error')

    expect(screen.getByText('Foto 2 no disponible')).toBeOnTheScreen()
    expect(thumbnail(2)).toBeOnTheScreen()
  })

  it('shows a plain message, never a stock image, when there are no photos', async () => {
    await render(<VehicleGallery photos={[]} title={TITLE} />)

    expect(screen.getByText('Fotos no disponibles.')).toBeOnTheScreen()
    expect(screen.queryByRole('button')).not.toBeOnTheScreen()
    expect(screen.queryByTestId('gallery-cover')).not.toBeOnTheScreen()
  })
})
