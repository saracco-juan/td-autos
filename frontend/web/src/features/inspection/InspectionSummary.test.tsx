import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CRITICAL_CODES, STEPS, VEHICLE } from './fixtures'
import InspectionSummary from './InspectionSummary'

const ALL_CODES = STEPS.flatMap((step) => step.items.map((item) => item.codigo))
// Everything ticked except these codes.
const allExcept = (...pending: string[]) => ALL_CODES.filter((code) => !pending.includes(code))

function renderSummary(completedCodes: string[] = CRITICAL_CODES, onKeepReviewing = vi.fn()) {
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

const message = () => screen.getByRole('status')

describe('InspectionSummary', () => {
  it('renders the shared header: back link, eyebrow, vehicle title and counter', () => {
    renderSummary()

    expect(screen.getByRole('link', { name: 'Volver a la ficha' })).toHaveAttribute('href', '/vehiculos/7')
    expect(screen.getByText('CHECKLIST DE INSPECCIÓN')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
    expect(screen.getByText('4 de 10 puntos revisados')).toBeInTheDocument()
  })

  describe('message', () => {
    it('D5: says the inspection is complete, in the success style, when everything is ticked', () => {
      renderSummary(ALL_CODES)

      expect(message()).toHaveTextContent('Inspección completa: revisaste los 10 puntos.')
      expect(message().className).toMatch(/notice/)
    })

    it('critical and non-critical pending: the frame copy with the count of critical ones, in the warning style', () => {
      renderSummary(allExcept('papeles_titular', 'papeles_vtv', 'manejo_caja'))

      expect(message()).toHaveTextContent(
        'Inspección incompleta: te quedan 3 puntos sin revisar, 1 de ellos crítico.',
      )
      expect(message().className).toMatch(/warning/)
    })

    it('uses the plural for several critical items among the pending ones', () => {
      renderSummary(allExcept('papeles_titular', 'exterior_pintura', 'papeles_vtv', 'manejo_caja'))

      expect(message()).toHaveTextContent(
        'Inspección incompleta: te quedan 4 puntos sin revisar, 2 de ellos críticos.',
      )
    })

    it('says the pending ones are critical when all of them are, plural', () => {
      renderSummary(allExcept('papeles_titular', 'exterior_pintura'))

      expect(message()).toHaveTextContent('Inspección incompleta: te quedan 2 puntos críticos sin revisar.')
    })

    it('says the pending one is critical when it is the only one', () => {
      renderSummary(allExcept('manejo_frenos'))

      expect(message()).toHaveTextContent('Inspección incompleta: te queda 1 punto crítico sin revisar.')
    })

    it('D6: only non-critical items pending, plural', () => {
      renderSummary(CRITICAL_CODES)

      expect(message()).toHaveTextContent('Inspección incompleta: te quedan 6 puntos sin revisar.')
      expect(message().className).toMatch(/warning/)
    })

    it('D6: a single non-critical item pending, singular', () => {
      renderSummary(allExcept('manejo_caja'))

      expect(message()).toHaveTextContent('Inspección incompleta: te queda 1 punto sin revisar.')
    })
  })

  describe('progress card', () => {
    it('lists one step per row with its progress and a bold total, as term and definition pairs', () => {
      renderSummary(['papeles_vtv', 'motor_perdidas', 'motor_aceite'])

      const card = screen.getByRole('region', { name: 'Avance por paso' })
      const terms = within(card).getAllByRole('term').map((term) => term.textContent)
      const definitions = within(card).getAllByRole('definition').map((definition) => definition.textContent)
      expect(terms).toEqual([
        '1. Papeles del auto',
        '2. Exterior',
        '3. Motor',
        '4. Interior',
        '5. Prueba de manejo',
        'Total',
      ])
      expect(definitions).toEqual(['1 de 2', '0 de 2', '2 de 2', '0 de 2', '0 de 2', '3 de 10'])
    })
  })

  describe('pending card', () => {
    it('TC-37: with critical items pending it lists only those, with the badge and the frame subtitle', () => {
      renderSummary(allExcept('papeles_titular', 'exterior_pintura', 'papeles_vtv'))

      const card = screen.getByRole('region', { name: 'Puntos críticos pendientes' })
      expect(within(card).getByText('Son los que más pesan a la hora de decidir.')).toBeInTheDocument()
      const rows = within(card).getAllByRole('listitem')
      expect(rows.map((row) => row.textContent)).toEqual([
        'El titular coincide con el vendedor CRÍTICO',
        'La pintura es pareja CRÍTICO',
      ])
      expect(within(card).queryByText('La VTV está vigente')).not.toBeInTheDocument()
      expect(within(card).getAllByText('CRÍTICO')).toHaveLength(2)
    })

    it('D6: with only non-critical items pending it lists every one in catalog order, no subtitle', () => {
      renderSummary(CRITICAL_CODES)

      const card = screen.getByRole('region', { name: 'Puntos pendientes' })
      expect(within(card).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
        'La VTV está vigente',
        'Las luces funcionan',
        'El aceite se ve limpio',
        'No hay testigos encendidos',
        'El kilometraje es coherente',
        'La caja cambia sin tirones',
      ])
      expect(within(card).queryByText(/pesan/)).not.toBeInTheDocument()
      expect(within(card).queryByText('CRÍTICO')).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Puntos críticos pendientes' })).not.toBeInTheDocument()
    })

    it('D5: with everything ticked there is no pending card', () => {
      renderSummary(ALL_CODES)

      expect(screen.getByRole('region', { name: 'Avance por paso' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: /pendientes?$/ })).not.toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })

    it('shows read-only rows: no checkboxes, buttons or links inside the cards', () => {
      renderSummary(allExcept('papeles_titular', 'papeles_vtv'))

      const card = screen.getByRole('region', { name: 'Puntos críticos pendientes' })
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(within(card).queryByRole('button')).not.toBeInTheDocument()
      expect(within(card).queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('buttons', () => {
    it('VOLVER A LA FICHA links to the planned vehicle sheet (HU09), like the header link', () => {
      renderSummary()

      expect(screen.getByRole('link', { name: 'VOLVER A LA FICHA' })).toHaveAttribute('href', '/vehiculos/7')
    })

    it('calls onKeepReviewing from SEGUIR REVISANDO, the right-most button', async () => {
      const onKeepReviewing = renderSummary()

      const buttons = [
        screen.getByRole('link', { name: 'VOLVER A LA FICHA' }),
        screen.getByRole('button', { name: 'SEGUIR REVISANDO' }),
      ]
      expect(buttons[0].compareDocumentPosition(buttons[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      await userEvent.setup().click(buttons[1])

      expect(onKeepReviewing).toHaveBeenCalledTimes(1)
    })
  })
})
