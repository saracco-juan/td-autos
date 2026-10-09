import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChecklistActionBar from './ChecklistActionBar'

type Props = React.ComponentProps<typeof ChecklistActionBar>

const INSPECTION_LABELS: Props['labels'] = {
  previous: 'PASO ANTERIOR',
  next: 'PASO SIGUIENTE',
  finish: 'FINALIZAR',
  finishAnyway: 'FINALIZAR IGUAL',
  keepWorking: 'SEGUIR REVISANDO',
  finishError: 'No pudimos finalizar la inspección. Probá de nuevo.',
}

function renderBar(overrides: Partial<Props> = {}) {
  const props: Props = {
    labels: INSPECTION_LABELS,
    warning: false,
    finishing: false,
    finishFailed: false,
    hasPrevious: true,
    hasNext: true,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onFinish: vi.fn(),
    onFinishAnyway: vi.fn(),
    onKeepWorking: vi.fn(),
    ...overrides,
  }
  const view = render(<ChecklistActionBar {...props} />)
  return { props, ...view }
}

const labels = () => screen.getAllByRole('button').map((button) => button.textContent)

describe('ChecklistActionBar', () => {
  it('shows previous, next and finish, in that order, finish last', () => {
    renderBar()

    expect(labels()).toEqual(['PASO ANTERIOR', 'PASO SIGUIENTE', 'FINALIZAR'])
  })

  it('leaves out previous on the first step and next on the last one', () => {
    const { rerender, props } = renderBar({ hasPrevious: false })
    expect(labels()).toEqual(['PASO SIGUIENTE', 'FINALIZAR'])

    rerender(<ChecklistActionBar {...props} hasPrevious hasNext={false} />)
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

  it('swaps to finish anyway and keep working under the warning, without previous or next', async () => {
    const user = userEvent.setup()
    const { props } = renderBar({ warning: true })

    expect(labels()).toEqual(['FINALIZAR IGUAL', 'SEGUIR REVISANDO'])
    await user.click(screen.getByRole('button', { name: 'FINALIZAR IGUAL' }))
    await user.click(screen.getByRole('button', { name: 'SEGUIR REVISANDO' }))
    expect(props.onFinishAnyway).toHaveBeenCalledTimes(1)
    expect(props.onKeepWorking).toHaveBeenCalledTimes(1)
  })

  it('shows the busy state on the finishing button and disables every button', () => {
    const { rerender, props } = renderBar({ finishing: true })

    expect(screen.getByRole('button', { name: 'FINALIZANDO…' })).toHaveAttribute('aria-busy', 'true')
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled())

    rerender(<ChecklistActionBar {...props} warning />)
    expect(screen.getByRole('button', { name: 'FINALIZANDO…' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'SEGUIR REVISANDO' })).toBeDisabled()
  })

  it('shows the finish error as an alert only when finishing failed', () => {
    const { rerender, props } = renderBar({ finishFailed: true })
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos finalizar la inspección. Probá de nuevo.')

    rerender(<ChecklistActionBar {...props} finishFailed={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('takes every label and the finish error from the labels prop', () => {
    const labels = {
      previous: 'ETAPA ANTERIOR',
      next: 'ETAPA SIGUIENTE',
      finish: 'FINALIZAR',
      finishAnyway: 'FINALIZAR IGUAL',
      keepWorking: 'SEGUIR COMPLETANDO',
      finishError: 'No pudimos finalizar el checklist. Probá de nuevo.',
    }
    const { rerender, props } = renderBar({ labels, finishFailed: true })

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'ETAPA ANTERIOR',
      'ETAPA SIGUIENTE',
      'FINALIZAR',
    ])
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos finalizar el checklist. Probá de nuevo.')

    rerender(<ChecklistActionBar {...props} warning />)
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'FINALIZAR IGUAL',
      'SEGUIR COMPLETANDO',
    ])
  })
})
