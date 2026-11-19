import { fireEvent, render, screen } from '@testing-library/react-native'

import VehicleGallery from '../../../features/vehicle-detail/VehicleGallery'

const PHOTOS = [
  { id: 2, url: 'https://example.test/two.jpg', orden: 2 },
  { id: 1, url: 'https://example.test/one.jpg', orden: 1 },
  { id: 3, url: 'https://example.test/three.jpg', orden: 3 },
]
const TITLE = 'Toyota Corolla XEI 2021'
const cover = () => screen.getByTestId('gallery-cover')
const swipeTo = (index: number) => fireEvent.scroll(screen.getByTestId('photo-pager'), {
  nativeEvent: { contentOffset: { x: index * 320, y: 0 }, layoutMeasurement: { width: 320 } },
})

describe('VehicleGallery', () => {
  it('shows the first photo by order and pages horizontally without buttons', async () => {
    await render(<VehicleGallery photos={PHOTOS} title={TITLE} />)

    expect(cover().props.accessibilityLabel).toBe(`Foto 1 de ${TITLE}`)
    expect(cover().props.source).toEqual({ uri: 'https://example.test/one.jpg' })
    expect(cover().props.resizeMode).toBe('contain')
    expect(screen.getByTestId('photo-pager').props.pagingEnabled).toBe(true)
    expect(screen.getByTestId('photo-pager').props.horizontal).toBe(true)
    expect(screen.queryByRole('button')).not.toBeOnTheScreen()
  })

  it('updates the current photo and counter after a swipe', async () => {
    await render(<VehicleGallery photos={PHOTOS} title={TITLE} />)

    await swipeTo(2)

    expect(cover().props.source).toEqual({ uri: 'https://example.test/three.jpg' })
    expect(cover().props.accessibilityLabel).toBe(`Foto 3 de ${TITLE}`)
    expect(screen.getByText('3 / 3')).toBeOnTheScreen()
  })

  it('says the cover is unavailable when it fails, keeping the other photos reachable', async () => {
    await render(<VehicleGallery photos={PHOTOS} title={TITLE} />)

    await fireEvent(cover(), 'error')

    expect(screen.getByText('Esta foto no está disponible.')).toBeOnTheScreen()
    expect(screen.queryByTestId('gallery-cover')).not.toBeOnTheScreen()
    await swipeTo(1)
    expect(cover().props.source).toEqual({ uri: 'https://example.test/two.jpg' })
  })

  it('omits the counter and disables paging for a single photo', async () => {
    await render(<VehicleGallery photos={[PHOTOS[0]]} title={TITLE} />)

    expect(cover()).toBeOnTheScreen()
    expect(screen.getByTestId('photo-pager').props.scrollEnabled).toBe(false)
    expect(screen.queryByText('1 / 1')).not.toBeOnTheScreen()
  })

  it('shows a plain message, never a stock image, when there are no photos', async () => {
    await render(<VehicleGallery photos={[]} title={TITLE} />)

    expect(screen.getByText('Fotos no disponibles.')).toBeOnTheScreen()
    expect(screen.queryByRole('button')).not.toBeOnTheScreen()
    expect(screen.queryByTestId('gallery-cover')).not.toBeOnTheScreen()
  })
})
