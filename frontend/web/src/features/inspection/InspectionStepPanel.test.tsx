import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { STEPS } from './fixtures'
import InspectionStepPanel from './InspectionStepPanel'

type Props = React.ComponentProps<typeof InspectionStepPanel>

function renderPanel(overrides: Partial<Props> = {}) {
  const headingRef = createRef<HTMLHeadingElement>()
  const props: Props = {
    step: STEPS[0],
    completedCodes: new Set(),
    saveFailed: false,
    headingRef,
    onToggle: vi.fn(),
    ...overrides,
  }
  const view = render(<InspectionStepPanel {...props} />)
  return { props, headingRef, ...view }
}

describe('InspectionStepPanel', () => {
  it('is a tabpanel labelled by its tab, with the step title as a focusable heading', () => {
    const { headingRef } = renderPanel()

    const panel = screen.getByRole('tabpanel', { hidden: true })
    expect(panel).toHaveAttribute('id', 'inspection-panel-1')
    expect(panel).toHaveAttribute('aria-labelledby', 'inspection-tab-1')
    const heading = screen.getByRole('heading', { level: 2, name: '1. Papeles del auto' })
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(headingRef.current).toBe(heading)
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

  it('puts the CRÍTICO badge in the accessible name of the item', () => {
    renderPanel()

    expect(screen.getByRole('checkbox', { name: 'El titular coincide con el vendedor CRÍTICO' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'La VTV está vigente' })).toBeInTheDocument()
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

  it('shows the save error as an alert only when the save failed', () => {
    const { props, rerender } = renderPanel({ saveFailed: true })
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos guardar el cambio. Probá de nuevo.')

    rerender(<InspectionStepPanel {...props} saveFailed={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
