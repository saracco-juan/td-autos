import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import VehicleCompatibility from '../../../features/vehicle-detail/components/VehicleCompatibility'

it('names the selected use and priority and exposes each factor as a percentage', () => {
  render(<VehicleCompatibility context={{ listingId: 7, score: 81.1,
    factors: { usage: 88.8, body: 100, priority: 80, comfort: 0 },
    usageLabel: 'Uso mixto', priorityLabel: 'Reventa', returnTo: '/recomendaciones' }} />)
  expect(screen.getByRole('heading', { name: 'Uso mixto' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Reventa' })).toBeInTheDocument()
  expect(screen.getByRole('meter', { name: 'Uso mixto' })).toHaveAttribute('aria-valuenow', '88.8')
  expect(screen.getByRole('meter', { name: 'Confort' })).toHaveAttribute('aria-valuenow', '0')
  expect(screen.getAllByRole('button')).toHaveLength(2)
})

it('does not turn an unavailable priority score into zero', () => {
  render(<VehicleCompatibility context={{ listingId: 7, score: 60,
    factors: { usage: 70, body: 80, priority: null, comfort: 10 }, returnTo: '/recomendaciones' }} />)
  expect(screen.getByText('Sin datos')).toBeInTheDocument()
  expect(screen.queryByRole('meter', { name: 'Prioridad' })).not.toBeInTheDocument()
})
