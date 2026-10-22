import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ChecklistStepPanel from './ChecklistStepPanel'
import { STEPS } from '@shared/checklist/fixtures'

type Props = React.ComponentProps<typeof ChecklistStepPanel>

function renderPanel(overrides: Partial<Props> = {}) {
  const headingRef = createRef<HTMLHeadingElement>()
  const props: Props = {
    idPrefix: 'inspection',
    step: STEPS[0],
    completedCodes: new Set(),
    saveFailed: false,
    saveError: 'No pudimos guardar el cambio. Probá de nuevo.',
    flagLabel: 'CRÍTICO',
    headingRef,
    onToggle: vi.fn(),
    ...overrides,
  }
  const view = render(<ChecklistStepPanel {...props} />)
  return { props, headingRef, ...view }
}

describe('ChecklistStepPanel', () => {
  it('is a tabpanel labelled by its tab, with the step title as a focusable heading', () => {
    const { headingRef } = renderPanel()

    const panel = screen.getByRole('tabpanel', { hidden: true })
    expect(panel).toHaveAttribute('id', 'inspection-panel-1')
    expect(panel).toHaveAttribute('aria-labelledby', 'inspection-tab-1')
    const heading = screen.getByRole('heading', { level: 2, name: '1. Papeles del auto' })
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(headingRef.current).toBe(heading)
  })

  it('builds the panel and tab ids from the id prefix', () => {
    renderPanel({ idPrefix: 'transfer', step: STEPS[1] })

    const panel = screen.getByRole('tabpanel', { hidden: true })
    expect(panel).toHaveAttribute('id', 'transfer-panel-2')
    expect(panel).toHaveAttribute('aria-labelledby', 'transfer-tab-2')
  })

  it('shows the hint when the step has one and one checkbox per item', () => {
    renderPanel()

    expect(screen.getByText('Pedile al vendedor la cédula y el título del auto.')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('renders no hint paragraph when the step has none', () => {
    renderPanel({ step: STEPS[3] })

    expect(document.getElementById('inspection-panel-4')?.querySelectorAll('p')).toHaveLength(0)
  })

  it('puts the flag label in the accessible name of the flagged items only', () => {
    renderPanel()

    expect(screen.getByRole('checkbox', { name: 'El titular coincide con el vendedor CRÍTICO' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'La VTV está vigente' })).toBeInTheDocument()
  })

  it('shows the given flag label instead of a fixed one', () => {
    renderPanel({ flagLabel: 'OBLIGATORIO' })

    expect(screen.getByRole('checkbox', { name: 'El titular coincide con el vendedor OBLIGATORIO' })).toBeInTheDocument()
    expect(screen.queryByText('CRÍTICO')).not.toBeInTheDocument()
  })

  it('reflects ticked items and reports the code and the new value on change', async () => {
    const { props } = renderPanel({ completedCodes: new Set(['papeles_vtv']) })
    const user = userEvent.setup()

    expect(screen.getByRole('checkbox', { name: 'La VTV está vigente' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /El titular/ }))
    await user.click(screen.getByRole('checkbox', { name: 'La VTV está vigente' }))

    expect(props.onToggle).toHaveBeenNthCalledWith(1, 'papeles_titular', true)
    expect(props.onToggle).toHaveBeenNthCalledWith(2, 'papeles_vtv', false)
  })

  it('never locks a row: two clicks report two changes and the checkbox is never busy', async () => {
    const { props } = renderPanel()

    await userEvent.setup().dblClick(screen.getByRole('checkbox', { name: 'La VTV está vigente' }))

    expect(props.onToggle).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('checkbox', { name: 'La VTV está vigente' })).not.toHaveAttribute('aria-busy')
  })

  it('shows the given save error as an alert only when the save failed', () => {
    const { props, rerender } = renderPanel({ saveFailed: true })
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos guardar el cambio. Probá de nuevo.')

    rerender(<ChecklistStepPanel {...props} saveFailed={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    rerender(<ChecklistStepPanel {...props} saveFailed saveError="No se pudo guardar." />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.')
  })

  it('renders the footer content under the rows, and nothing when there is none', () => {
    const { props, rerender } = renderPanel()
    expect(screen.queryByText('Fuente: Registro Automotor')).not.toBeInTheDocument()

    rerender(
      <ChecklistStepPanel {...props}>
        <p>Fuente: Registro Automotor</p>
      </ChecklistStepPanel>,
    )

    const note = screen.getByText('Fuente: Registro Automotor')
    const lastRow = screen.getAllByRole('checkbox').at(-1) as HTMLElement
    expect(lastRow.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
