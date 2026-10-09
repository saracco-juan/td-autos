import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import InspectionActionBar from './InspectionActionBar'

type Props = React.ComponentProps<typeof InspectionActionBar>

function renderBar(overrides: Partial<Props> = {}) {
  const props: Props = {
    warning: false,
    finishing: false,
    finishFailed: false,
    hasPrevious: true,
    hasNext: true,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onFinish: vi.fn(),
    onFinishAnyway: vi.fn(),
    onKeepReviewing: vi.fn(),
    ...overrides,
  }
  const view = render(<InspectionActionBar {...props} />)
  return { props, ...view }
}

const labels = () => screen.getAllByRole('button').map((button) => button.textContent)

describe('InspectionActionBar', () => {
  it('shows PASO ANTERIOR, PASO SIGUIENTE and FINALIZAR, in that order, FINALIZAR last', () => {
    renderBar()

    expect(labels()).toEqual(['PASO ANTERIOR', 'PASO SIGUIENTE', 'FINALIZAR'])
  })

  it('leaves out PASO ANTERIOR on the first step and PASO SIGUIENTE on the last one', () => {
    const { rerender, props } = renderBar({ hasPrevious: false })
    expect(labels()).toEqual(['PASO SIGUIENTE', 'FINALIZAR'])

    rerender(<InspectionActionBar {...props} hasPrevious hasNext={false} />)
    expect(labels()).toEqual(['PASO ANTERIOR', 'FINALIZAR'])
  })

  it('calls the matching handler for each button', async () => {
    const user = userEvent.setup()
    const { props } = renderBar()

    await user.click(screen.getByRole('button', { name: 'PASO ANTERIOR' }))
    await user.click(screen.getByRole('button', { name: 'PASO SIGUIENTE' }))
    await user.click(screen.getByRole('button', { name: 'FINALIZAR' }))

    expect(props.onPrevious).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)
    expect(props.onFinish).toHaveBeenCalledTimes(1)
  })

  it('swaps to FINALIZAR IGUAL and SEGUIR REVISANDO under the warning, without previous or next', async () => {
    const user = userEvent.setup()
    const { props } = renderBar({ warning: true })

    expect(labels()).toEqual(['FINALIZAR IGUAL', 'SEGUIR REVISANDO'])
    await user.click(screen.getByRole('button', { name: 'FINALIZAR IGUAL' }))
    await user.click(screen.getByRole('button', { name: 'SEGUIR REVISANDO' }))
    expect(props.onFinishAnyway).toHaveBeenCalledTimes(1)
    expect(props.onKeepReviewing).toHaveBeenCalledTimes(1)
  })

  it('shows the busy state on the finishing button and disables every button', () => {
    const { rerender, props } = renderBar({ finishing: true })

    expect(screen.getByRole('button', { name: 'FINALIZANDO…' })).toHaveAttribute('aria-busy', 'true')
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled())

    rerender(<InspectionActionBar {...props} warning />)
    expect(screen.getByRole('button', { name: 'FINALIZANDO…' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'SEGUIR REVISANDO' })).toBeDisabled()
  })

  it('shows the finish error as an alert only when finishing failed', () => {
    const { rerender, props } = renderBar({ finishFailed: true })
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos finalizar la inspección. Probá de nuevo.')

    rerender(<InspectionActionBar {...props} finishFailed={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
