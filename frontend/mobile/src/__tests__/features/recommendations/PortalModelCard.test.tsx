import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Linking from 'expo-linking'

import PortalModelCard from '../../../features/recommendations/PortalModelCard'
import { portalModel } from '../../../test-utils/portalModels'

jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), openURL: jest.fn() }))
const openURL = jest.mocked(Linking.openURL)

describe('HU06 mobile model card', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    openURL.mockResolvedValue(true)
  })

  it('TC-18 displays model years, reference price and reasons/filters through its info action', async () => {
    await render(<PortalModelCard model={portalModel} />)
    expect(screen.getByText('Chevrolet Onix')).toBeOnTheScreen()
    expect(screen.getByText('Modelos 2017–2025')).toBeOnTheScreen()
    expect(screen.getByText('$ 27.521.100 – $ 33.217.300')).toBeOnTheScreen()
    expect(screen.getByText('Precio de referencia del modelo 2025')).toBeOnTheScreen()
    expect(screen.getByText('Hatchback')).toBeOnTheScreen()
    expect(screen.queryByText('Ideal para la ciudad')).not.toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Más información sobre Chevrolet Onix' }))
    expect(screen.getByText('Ideal para la ciudad')).toBeOnTheScreen()
    expect(screen.getByText('Transmisión automática')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'CERRAR' }))
    expect(screen.queryByText('Ideal para la ciudad')).not.toBeOnTheScreen()
  })

  it.each(portalModel.links)('TC-18/88 opens $nombre with the exact filtered API URL', async (link) => {
    await render(<PortalModelCard model={portalModel} />)
    await fireEvent.press(screen.getByRole('button', { name: `VER EN ${link.nombre.toUpperCase()}` }))
    expect(openURL).toHaveBeenCalledTimes(1)
    expect(openURL).toHaveBeenCalledWith(link.url)
  })

  it('shows a recoverable message when the OS rejects opening a link', async () => {
    openURL.mockRejectedValueOnce(new Error('No activity'))
    await render(<PortalModelCard model={portalModel} />)
    const button = screen.getByRole('button', { name: 'VER EN MERCADO LIBRE' })
    await fireEvent.press(button)
    expect(await screen.findByText('No pudimos abrir el portal. Intentá de nuevo.')).toBeOnTheScreen()
    await fireEvent.press(button)
    await waitFor(() => expect(screen.queryByText('No pudimos abrir el portal. Intentá de nuevo.')).not.toBeOnTheScreen())
    expect(openURL).toHaveBeenLastCalledWith(portalModel.links[0].url)
  })

  it('shows a neutral placeholder when the model photo is absent or fails', async () => {
    const view = await render(<PortalModelCard model={portalModel} />)
    await fireEvent(screen.getByLabelText('Foto de Chevrolet Onix'), 'error')
    expect(screen.getByText('Sin fotos')).toBeOnTheScreen()
    await view.rerender(<PortalModelCard model={{ ...portalModel, imagen_url: null }} />)
    expect(screen.getByText('Sin fotos')).toBeOnTheScreen()
  })
})

