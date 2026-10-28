import { fireEvent, render, screen } from '@testing-library/react-native'

import VehicleSpecifications from '../../../features/vehicle-detail/VehicleSpecifications'
import { vehicle } from '@shared/vehicles/fixtures'

const tab = (name: string) => screen.getByRole('tab', { name })

describe('VehicleSpecifications', () => {
  it('S1: opens on the general information with plain-language explanations', async () => {
    await render(<VehicleSpecifications vehicle={vehicle} />)

    expect(screen.getAllByRole('tab').map((item) => item.props.accessibilityLabel)).toEqual([
      'Información general',
      'Motor y consumo',
      'Seguridad',
      'Confort',
    ])
    expect(tab('Información general')).toBeSelected()
    expect(screen.getByText('Kilometraje')).toBeOnTheScreen()
    expect(screen.getByText('62.000 km')).toBeOnTheScreen()
    expect(screen.getByText('Cantidad de personas que pueden viajar sentadas.')).toBeOnTheScreen()
    expect(screen.queryByText('Motor')).not.toBeOnTheScreen()
  })

  it('shows only the rows of the selected section', async () => {
    await render(<VehicleSpecifications vehicle={{ ...vehicle, frenos_abs: true, isofix: false }} />)

    await fireEvent.press(tab('Seguridad'))

    expect(tab('Seguridad')).toBeSelected()
    expect(screen.getByText('Frenos ABS')).toBeOnTheScreen()
    expect(screen.getByText('Ayuda a evitar que las ruedas se bloqueen al frenar.')).toBeOnTheScreen()
    expect(screen.queryByText('Kilometraje')).not.toBeOnTheScreen()
    await fireEvent.press(tab('Motor y consumo'))
    expect(screen.getByText('170 CV')).toBeOnTheScreen()
    expect(screen.queryByText('Frenos ABS')).not.toBeOnTheScreen()
  })

  it('S2: unreported facts and equipment read "No disponible", never an empty value', async () => {
    const incomplete = { ...vehicle, kilometraje: null, carroceria: null, motor: null, potencia: null }
    await render(<VehicleSpecifications vehicle={incomplete} />)

    expect(screen.getAllByText('No disponible').length).toBeGreaterThanOrEqual(2)
    await fireEvent.press(tab('Confort'))
    expect(screen.getAllByText('No disponible')).toHaveLength(8)
  })

  it('shows the dealer description below the sections, with a fallback when it is missing', async () => {
    const { rerender } = await render(<VehicleSpecifications vehicle={vehicle} />)
    expect(screen.getByText('Descripción de la concesionaria')).toBeOnTheScreen()
    expect(screen.getByText('Único dueño')).toBeOnTheScreen()

    await rerender(<VehicleSpecifications vehicle={{ ...vehicle, descripcion: '   ' }} />)
    await fireEvent.press(tab('Seguridad'))
    expect(screen.getByText('Descripción no disponible.')).toBeOnTheScreen()
  })
})
