import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CRITICAL_CODES, STEPS, VEHICLE } from './fixtures'
import InspectionSummary from './InspectionSummary'

function renderSummary(onKeepReviewing = vi.fn(), completedCodes = CRITICAL_CODES) {
  render(
    <MemoryRouter>
      <InspectionSummary
        vehicle={VEHICLE}
        steps={STEPS}
        completedCodes={completedCodes}
        onKeepReviewing={onKeepReviewing}
      />
    </MemoryRouter>,
  )
  return onKeepReviewing
}

describe('InspectionSummary', () => {
  it('renders the shared header: back link, eyebrow, vehicle title and counter', () => {
    renderSummary()

    expect(screen.getByRole('link', { name: 'Volver a la ficha' })).toHaveAttribute('href', '/vehiculos/7')
    expect(screen.getByText('CHECKLIST DE INSPECCIÓN')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
    expect(screen.getByText('4 de 10 puntos revisados')).toBeInTheDocument()
  })

  it('has no checkboxes and calls onKeepReviewing from SEGUIR REVISANDO', async () => {
    const onKeepReviewing = renderSummary()

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'SEGUIR REVISANDO' }))

    expect(onKeepReviewing).toHaveBeenCalledTimes(1)
  })
})
