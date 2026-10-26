import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import InfoTip from './InfoTip'

const renderTip = () => render(
  <div>
    <p>Outside</p>
    <InfoTip label="Cómo calculamos Seguro">7% anual del valor del auto.</InfoTip>
  </div>,
)
const button = () => screen.getByRole('button', { name: 'Cómo calculamos Seguro' })

it('is a closed, accessible button that points to its tooltip', () => {
  renderTip()
  expect(button()).toHaveAttribute('type', 'button')
  expect(button()).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(button()).toHaveAccessibleDescription('7% anual del valor del auto.')
})

it('opens on mouse hover and closes when the mouse leaves', async () => {
  const user = userEvent.setup()
  renderTip()
  await user.hover(button())
  expect(screen.getByRole('tooltip')).toHaveTextContent('7% anual del valor del auto.')
  await user.unhover(button())
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('opens on keyboard focus and closes on blur', async () => {
  const user = userEvent.setup()
  renderTip()
  await user.tab()
  expect(button()).toHaveFocus()
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  await user.tab()
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('stays open after a click (touch) even when the pointer leaves, and a second click closes it', async () => {
  const user = userEvent.setup()
  renderTip()
  await user.click(button())
  await user.unhover(button())
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  expect(button()).toHaveAttribute('aria-expanded', 'true')
  await user.click(button())
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('closes on Escape', async () => {
  const user = userEvent.setup()
  renderTip()
  await user.click(button())
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('closes on a click outside', async () => {
  const user = userEvent.setup()
  renderTip()
  await user.click(button())
  await user.click(screen.getByText('Outside'))
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})
