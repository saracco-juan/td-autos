import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { STEPS } from './fixtures'
import InspectionStepCard from './InspectionStepCard'

type Props = React.ComponentProps<typeof InspectionStepCard>

function buildProps(overrides: Partial<Props> = {}): Props {
  return {
    step: STEPS[0],
    completedCodes: new Set(),
    open: true,
    saveFailed: false,
    onToggleOpen: vi.fn(),
    onToggle: vi.fn(),
    ...overrides,
  }
}

function renderCard(overrides: Partial<Props> = {}) {
  const props = buildProps(overrides)
  const view = render(<InspectionStepCard {...props} />)
  return { props, ...view }
}

describe('InspectionStepCard', () => {
  it('renders the header button with the numbered title and the step progress', () => {
    renderCard({ completedCodes: new Set(['papeles_vtv']) })

    const header = screen.getByRole('button', { name: /1\. Papeles del auto/ })
    expect(header).toHaveTextContent('1. Papeles del auto')
    expect(header).toHaveTextContent('1 de 2')
    expect(screen.getByRole('heading', { level: 2 })).toContainElement(header)
  })

  it('exposes the open state and the controlled panel on the header', () => {
    renderCard()

    const header = screen.getByRole('button', { name: /1\. Papeles del auto/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    const panel = document.getElementById(header.getAttribute('aria-controls') ?? '')
    expect(panel).toContainElement(screen.getAllByRole('checkbox')[0])
  })

  it('shows the hint and one checkbox per item when open', () => {
    renderCard()

    expect(screen.getByText('Pedile al vendedor la cédula y el título del auto.')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('renders no hint paragraph when the step has none', () => {
    renderCard({ step: STEPS[3] })

    expect(screen.getByRole('region', { name: '4. Interior' }).querySelectorAll('p')).toHaveLength(0)
  })

  it('hides the content from the keyboard and the accessibility tree when collapsed', () => {
    renderCard({ open: false })

    expect(screen.getByRole('button', { name: /1\. Papeles del auto/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText('Pedile al vendedor la cédula y el título del auto.')).not.toBeVisible()
  })

  it('asks to open or close from the header', async () => {
    const { props } = renderCard()

    await userEvent.setup().click(screen.getByRole('button', { name: /1\. Papeles del auto/ }))

    expect(props.onToggleOpen).toHaveBeenCalledTimes(1)
  })

  it('reflects ticked items and reports the code and the new value on change', async () => {
    const { props } = renderCard({ completedCodes: new Set(['papeles_vtv']) })
    const user = userEvent.setup()

    expect(screen.getByRole('checkbox', { name: 'La VTV está vigente' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /El titular/ }))
    await user.click(screen.getByRole('checkbox', { name: 'La VTV está vigente' }))

    expect(props.onToggle).toHaveBeenNthCalledWith(1, 'papeles_titular', true)
    expect(props.onToggle).toHaveBeenNthCalledWith(2, 'papeles_vtv', false)
  })

  it('never locks a row: clicking an item twice reports both changes', async () => {
    const { props } = renderCard()
    const user = userEvent.setup()

    await user.dblClick(screen.getByRole('checkbox', { name: 'La VTV está vigente' }))

    expect(props.onToggle).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('checkbox', { name: 'La VTV está vigente' })).not.toHaveAttribute('aria-busy')
  })

  it('shows the save error as an alert only when the save failed', () => {
    const { rerender, props } = renderCard({ saveFailed: true })
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos guardar el cambio. Probá de nuevo.')

    rerender(<InspectionStepCard {...props} saveFailed={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
