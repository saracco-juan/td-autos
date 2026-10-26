import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { vehicle } from '@shared/vehicles/fixtures'
import VehicleSpecifications from './VehicleSpecifications'

it('HU09 / TC-26 exposes complete facts and equipment in comprehensible groups', () => {
  render(<VehicleSpecifications vehicle={{ ...vehicle, frenos_abs: true, aire_acondicionado: false }} />)
  expect(screen.getByRole('heading', { name: 'Especificaciones técnicas' })).toBeInTheDocument()
  expect(screen.getByText('62.000 km')).toBeInTheDocument()
  expect(screen.getByText('170 CV')).toBeInTheDocument()
  expect(screen.getByText(/no indica el consumo/)).toBeInTheDocument()
  const security = screen.getByRole('region', { name: 'Seguridad' })
  expect(within(security).getByText('Frenos ABS').nextElementSibling).toHaveTextContent('Sí')
  const comfort = screen.getByRole('region', { name: 'Confort' })
  expect(within(comfort).getByText('Aire acondicionado o climatizador').nextElementSibling).toHaveTextContent('No')
  expect(screen.getByText('Único dueño')).toBeInTheDocument()
})

it('HU09 / TC-27 renders explicit unknowns and descriptions as plain text', () => {
  render(<VehicleSpecifications vehicle={{ ...vehicle, motor: null, descripcion: '<script>alert(1)</script>' }} />)
  expect(screen.getByText('Motor').parentElement).toHaveTextContent('No disponible')
  expect(screen.getByText('Frenos ABS').nextElementSibling).toHaveTextContent('No disponible')
  expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
})

it('explains a missing description instead of hiding its section', () => {
  render(<VehicleSpecifications vehicle={{ ...vehicle, descripcion: null }} />)
  expect(screen.getByText('Descripción no disponible.')).toBeInTheDocument()
})
