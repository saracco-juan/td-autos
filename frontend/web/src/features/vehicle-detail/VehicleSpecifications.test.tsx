import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { vehicle } from '@shared/vehicles/fixtures'
import VehicleSpecifications from './VehicleSpecifications'

it('keeps separate specification instances independent with unique tab and panel IDs', async () => {
  render(<><VehicleSpecifications vehicle={vehicle} /><VehicleSpecifications vehicle={vehicle} /></>)
  const sections = screen.getAllByRole('region', { name: 'Especificaciones técnicas' })
  await userEvent.click(within(sections[0]).getByRole('tab', { name: 'Motor y consumo' }))
  expect(within(sections[0]).getByRole('tab', { name: 'Motor y consumo', selected: true })).toBeInTheDocument()
  expect(within(sections[1]).getByRole('tab', { name: 'Información general', selected: true })).toBeInTheDocument()
  const ids = screen.getAllByRole('tab').map((tab) => tab.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(within(sections[0]).getByRole('tabpanel').id).not.toBe(within(sections[1]).getByRole('tabpanel').id)
})

it('HU09 / TC-26 exposes complete facts and equipment through section tabs', async () => {
  render(<VehicleSpecifications vehicle={{ ...vehicle, frenos_abs: true, aire_acondicionado: false }} />)
  expect(screen.getByRole('heading', { name: 'Especificaciones técnicas' })).toBeInTheDocument()
  expect(screen.getByText('62.000 km')).toBeInTheDocument()
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'Información general', 'Motor y consumo', 'Seguridad', 'Confort',
  ])
  expect(screen.getByRole('tab', { name: 'Información general' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByText('170 CV')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: 'Motor y consumo' }))
  expect(screen.getByText('170 CV')).toBeInTheDocument()
  expect(screen.getByText(/no indica el consumo/)).toBeInTheDocument()
  expect(screen.queryByText('62.000 km')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: 'Seguridad' }))
  const security = screen.getByRole('tabpanel', { name: 'Seguridad' })
  expect(within(security).getByText('Frenos ABS').nextElementSibling).toHaveTextContent('Sí')
  await userEvent.click(screen.getByRole('tab', { name: 'Confort' }))
  const comfort = screen.getByRole('tabpanel', { name: 'Confort' })
  expect(within(comfort).getByText('Aire acondicionado o climatizador').nextElementSibling).toHaveTextContent('No')
  expect(screen.getByText('Único dueño')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Descripción de la concesionaria' }).closest('[role="tabpanel"]')).toBeNull()
})

it('HU09 / TC-27 renders explicit unknowns and descriptions as plain text', async () => {
  render(<VehicleSpecifications vehicle={{ ...vehicle, motor: null, descripcion: '<script>alert(1)</script>' }} />)
  await userEvent.click(screen.getByRole('tab', { name: 'Motor y consumo' }))
  expect(screen.getByText('Motor').parentElement).toHaveTextContent('No disponible')
  await userEvent.click(screen.getByRole('tab', { name: 'Seguridad' }))
  expect(screen.getByText('Frenos ABS').nextElementSibling).toHaveTextContent('No disponible')
  expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
})

it('explains a missing description instead of hiding its section', () => {
  render(<VehicleSpecifications vehicle={{ ...vehicle, descripcion: null }} />)
  expect(screen.getByText('Descripción no disponible.')).toBeInTheDocument()
})

it('RF08 explains equipment acronyms without claiming unknown equipment is present', async () => {
  render(<VehicleSpecifications vehicle={vehicle} />)
  await userEvent.click(screen.getByRole('tab', { name: 'Seguridad' }))
  expect(screen.getByText('Ayuda a evitar que las ruedas se bloqueen al frenar.')).toBeInTheDocument()
  expect(screen.getByText('Anclajes para sujetar sillas infantiles compatibles.')).toBeInTheDocument()
  expect(screen.getByText('Anclajes ISOFIX').closest('div')).toHaveTextContent('No disponible')
  await userEvent.click(screen.getByRole('tab', { name: 'Confort' }))
  expect(screen.getByText('Permite regular por separado la temperatura de dos zonas.')).toBeInTheDocument()
})

it('HU09 switches tabs with arrow keys, Home and End while keeping the description visible', async () => {
  const user = userEvent.setup()
  render(<VehicleSpecifications vehicle={vehicle} />)
  const tabs = screen.getAllByRole('tab')
  tabs[0].focus()
  for (const [key, index] of [['{ArrowRight}', 1], ['{End}', 3], ['{ArrowRight}', 0],
    ['{ArrowLeft}', 3], ['{Home}', 0]] as const) {
    await user.keyboard(key)
    expect(tabs[index]).toHaveFocus()
    expect(tabs[index]).toHaveAttribute('aria-selected', 'true')
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([tabs[index]])
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[index].id)
    expect(tabs[index]).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id)
    expect(screen.getByText('Único dueño')).toBeInTheDocument()
  }
  await user.keyboard('{Tab}')
  expect(screen.getByRole('tabpanel')).toHaveFocus()
})
