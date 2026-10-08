import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { STEPS } from './fixtures'
import InspectionStepList from './InspectionStepList'

type Props = React.ComponentProps<typeof InspectionStepList>

function renderList(overrides: Partial<Props> = {}) {
  const props: Props = {
    steps: STEPS,
    completedCodes: new Set(),
    selected: 1,
    orientation: 'vertical',
    pendingCritical: new Map(),
    onSelect: vi.fn(),
    ...overrides,
  }
  const view = render(<InspectionStepList {...props} />)
  return { props, ...view }
}

const tabs = () => screen.getAllByRole('tab')

describe('InspectionStepList', () => {
  it('renders a vertical tablist with one tab per step: title on the left, progress on the right', () => {
    renderList({ completedCodes: new Set(['papeles_vtv']) })

    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical')
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      '1. Papeles del auto1 de 2',
      '2. Exterior0 de 2',
      '3. Motor0 de 2',
      '4. Interior0 de 2',
      '5. Prueba de manejo0 de 2',
    ])
  })

  it('supports the horizontal orientation', () => {
    renderList({ orientation: 'horizontal' })

    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('marks only the selected tab, with a roving tabindex, and points each tab to its panel', () => {
    renderList({ selected: 3 })

    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false', 'false'])
    expect(tabs().map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1'])
    expect(tabs()[2]).toHaveAttribute('aria-controls', 'inspection-panel-3')
    expect(tabs()[2]).toHaveAttribute('id', 'inspection-tab-3')
  })

  it('selects a step by clicking its tab', async () => {
    const { props } = renderList()

    await userEvent.setup().click(screen.getByRole('tab', { name: /^3\. Motor/ }))

    expect(props.onSelect).toHaveBeenCalledWith(3)
  })

  it('moves and selects with Up and Down (wrapping) in a vertical list, focusing the new tab', async () => {
    const user = userEvent.setup()
    const { props, rerender } = renderList({ selected: 1 })
    tabs()[0].focus()

    await user.keyboard('{ArrowDown}')
    expect(props.onSelect).toHaveBeenLastCalledWith(2)
    expect(tabs()[1]).toHaveFocus()

    rerender(<InspectionStepList {...props} selected={1} />)
    tabs()[0].focus()
    await user.keyboard('{ArrowUp}')
    expect(props.onSelect).toHaveBeenLastCalledWith(5)
    expect(tabs()[4]).toHaveFocus()
  })

  it('ignores Left and Right in a vertical list, and Up and Down in a horizontal one', async () => {
    const user = userEvent.setup()
    const { props, rerender } = renderList()
    tabs()[0].focus()

    await user.keyboard('{ArrowRight}{ArrowLeft}')
    expect(props.onSelect).not.toHaveBeenCalled()

    rerender(<InspectionStepList {...props} orientation="horizontal" />)
    await user.keyboard('{ArrowDown}')
    expect(props.onSelect).not.toHaveBeenCalled()
    await user.keyboard('{ArrowRight}')
    expect(props.onSelect).toHaveBeenLastCalledWith(2)
  })

  it('goes to the first and last step with Home and End', async () => {
    const user = userEvent.setup()
    const { props } = renderList({ selected: 3 })
    tabs()[2].focus()

    await user.keyboard('{End}')
    expect(props.onSelect).toHaveBeenLastCalledWith(5)
    expect(tabs()[4]).toHaveFocus()

    await user.keyboard('{Home}')
    expect(props.onSelect).toHaveBeenLastCalledWith(1)
    expect(tabs()[0]).toHaveFocus()
  })

  it('shows a marker with accessible text, singular and plural, only on the steps with critical items pending', () => {
    renderList({
      pendingCritical: new Map([
        [2, 2],
        [5, 1],
      ]),
    })

    expect(screen.getByRole('tab', { name: /^2\. Exterior/ })).toHaveTextContent('2 críticos pendientes')
    expect(screen.getByRole('tab', { name: /^5\. Prueba/ })).toHaveTextContent('1 crítico pendiente')
    expect(screen.getByRole('tab', { name: /^1\. Papeles/ })).not.toHaveTextContent('pendiente')
  })
})
