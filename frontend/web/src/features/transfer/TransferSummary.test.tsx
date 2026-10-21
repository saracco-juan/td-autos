import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ALL_CODES, MANDATORY_CODES, STAGES } from '@shared/checklist/transfer/fixtures'
import TransferSummary from './TransferSummary'

// Everything ticked except these codes.
const allExcept = (...pending: string[]) => ALL_CODES.filter((code) => !pending.includes(code))
// Every mandatory item ticked; the optional ones are pending (4 of them).
const ONLY_MANDATORY = MANDATORY_CODES

function renderSummary(completedCodes: string[] = ONLY_MANDATORY, onKeepCompleting = vi.fn()) {
  render(<TransferSummary stages={STAGES} completedCodes={completedCodes} onKeepCompleting={onKeepCompleting} />)
  return onKeepCompleting
}

const message = () => screen.getByRole('status')

describe('TransferSummary', () => {
  it('renders the shared header: eyebrow, title and counter, with no advisor card', () => {
    renderSummary(MANDATORY_CODES)

    expect(screen.getByText('TRÁMITES')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Checklist de transferencia' })).toBeInTheDocument()
    expect(screen.getByText('8 de 15 pasos completados')).toBeInTheDocument()
    expect(screen.queryByText('ASESORAMIENTO')).not.toBeInTheDocument()
  })

  describe('mandatory items pending (09c)', () => {
    it('TC-79: says the transfer is incomplete with the pending and the mandatory counts, in the warning style', () => {
      renderSummary(['antes_titular', 'documentacion_dni', 'documentacion_titulo', 'tramite_turno', 'despues_seguro'])

      expect(message()).toHaveTextContent(
        'Trámite incompleto: te quedan 10 pasos sin completar, 6 de ellos obligatorios.',
      )
      expect(message().className).toMatch(/warning/)
    })

    it('uses the singular for one mandatory item among several pending', () => {
      renderSummary(allExcept('documentacion_cedula', 'despues_seguro'))

      expect(message()).toHaveTextContent('Trámite incompleto: te quedan 2 pasos sin completar, 1 de ellos obligatorio.')
    })

    it('says the pending one is mandatory when it is the only one', () => {
      renderSummary(allExcept('documentacion_cedula'))

      expect(message()).toHaveTextContent('Trámite incompleto: te queda 1 paso sin completar, y es obligatorio.')
    })

    it('TC-85: lists only the pending mandatory items, in catalog order, each with the badge and the subtitle', () => {
      renderSummary(['antes_titular', 'documentacion_dni', 'documentacion_titulo', 'tramite_turno', 'tramite_formulario_08'])

      const card = screen.getByRole('region', { name: 'Pasos obligatorios pendientes' })
      expect(within(card).getByText('El registro los exige para hacer la transferencia.')).toBeInTheDocument()
      expect(within(card).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
        'Cédula del vehículo OBLIGATORIO',
        'CUIT o CUIL del comprador OBLIGATORIO',
        'Si el vendedor está casado, documento y firma del cónyuge OBLIGATORIO',
        'Verificación física del auto (inscriptos desde 2001) OBLIGATORIO',
        'Firma de ambas partes y pago de aranceles OBLIGATORIO',
      ])
      expect(within(card).queryByText('Pedí el informe de dominio del auto')).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Pasos pendientes' })).not.toBeInTheDocument()
    })

    it('shows the progress card first, then the pending card, in two columns', () => {
      renderSummary([])

      const regions = screen.getAllByRole('region')
      expect(regions.map((region) => region.getAttribute('aria-labelledby') && region.querySelector('h2')?.textContent)).toEqual([
        'Avance por etapa',
        'Pasos obligatorios pendientes',
      ])
    })

    it('shows read-only rows: no checkboxes, buttons or links inside the cards', () => {
      renderSummary([])

      const card = screen.getByRole('region', { name: 'Pasos obligatorios pendientes' })
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(within(card).queryByRole('button')).not.toBeInTheDocument()
      expect(within(card).queryByRole('link')).not.toBeInTheDocument()
    })

    it('has SEGUIR COMPLETANDO as the only button and calls back when pressed', async () => {
      const onKeepCompleting = renderSummary([])

      expect(screen.getAllByRole('button')).toHaveLength(1)
      await userEvent.setup().click(screen.getByRole('button', { name: 'SEGUIR COMPLETANDO' }))

      expect(onKeepCompleting).toHaveBeenCalledTimes(1)
    })
  })

  describe('pending without mandatory items (09e)', () => {
    it('TC-79: says how many steps are left, in the warning style', () => {
      renderSummary(ONLY_MANDATORY)

      expect(message()).toHaveTextContent('Trámite incompleto: te quedan 7 pasos sin completar.')
      expect(message().className).toMatch(/warning/)
    })

    it('uses the singular for a single pending step', () => {
      renderSummary(allExcept('despues_seguro'))

      expect(message()).toHaveTextContent('Trámite incompleto: te queda 1 paso sin completar.')
    })

    it('lists every pending item in catalog order, with no subtitle and no badge', () => {
      renderSummary(ONLY_MANDATORY)

      const card = screen.getByRole('region', { name: 'Pasos pendientes' })
      expect(within(card).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
        'Pedí el informe de dominio del auto',
        'El vendedor es el titular del auto',
        'El auto no tiene deudas de patentes ni infracciones',
        'Turno en el registro',
        'Retirá el título y la cédula a tu nombre',
        'Poné el seguro a tu nombre',
        'Hacé el alta en patentes',
      ])
      expect(within(card).queryByText('OBLIGATORIO')).not.toBeInTheDocument()
      expect(within(card).queryByText(/El registro los exige/)).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Pasos obligatorios pendientes' })).not.toBeInTheDocument()
    })

    it('has SEGUIR COMPLETANDO and calls back when pressed', async () => {
      const onKeepCompleting = renderSummary(ONLY_MANDATORY)

      await userEvent.setup().click(screen.getByRole('button', { name: 'SEGUIR COMPLETANDO' }))

      expect(onKeepCompleting).toHaveBeenCalledTimes(1)
    })
  })

  describe('complete (09d)', () => {
    it('says the transfer is complete, in the success style', () => {
      renderSummary(ALL_CODES)

      expect(message()).toHaveTextContent('Trámite completo: completaste los 15 pasos.')
      expect(message().className).toMatch(/notice/)
    })

    it('shows only the progress card, with no pending list', () => {
      renderSummary(ALL_CODES)

      expect(screen.getAllByRole('region')).toHaveLength(1)
      expect(screen.getByRole('region', { name: 'Avance por etapa' })).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })

    it('has VOLVER AL CHECKLIST instead of SEGUIR COMPLETANDO and calls back when pressed', async () => {
      const onKeepCompleting = renderSummary(ALL_CODES)

      expect(screen.queryByRole('button', { name: 'SEGUIR COMPLETANDO' })).not.toBeInTheDocument()
      await userEvent.setup().click(screen.getByRole('button', { name: 'VOLVER AL CHECKLIST' }))

      expect(onKeepCompleting).toHaveBeenCalledTimes(1)
    })
  })

  describe('progress card', () => {
    it('lists one stage per row with its progress and a bold total, as term and definition pairs', () => {
      renderSummary(['antes_titular', 'documentacion_dni', 'documentacion_titulo'])

      const card = screen.getByRole('region', { name: 'Avance por etapa' })
      const terms = within(card).getAllByRole('term').map((term) => term.textContent)
      const definitions = within(card).getAllByRole('definition').map((definition) => definition.textContent)
      expect(terms).toEqual([
        '1. Antes de señar',
        '2. Documentación',
        '3. Trámite en el registro',
        '4. Después de transferir',
        'Total',
      ])
      expect(definitions).toEqual(['1 de 3', '2 de 5', '0 de 4', '0 de 3', '3 de 15'])
    })
  })
})
