import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import Tabs from './Tabs'

const items = [{ id: 'general', label: 'General' }, { id: 'engine', label: 'Engine' }]
const mount = () => render(<Tabs label="Example sections" items={items}>
  {(id) => <p>{id} content</p>}
</Tabs>)

it('connects selected tabs to a single accessible panel and switches on click', async () => {
  mount()
  const general = screen.getByRole('tab', { name: 'General', selected: true })
  expect(general).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id)
  expect(screen.getByRole('tabpanel', { name: 'General' })).toHaveTextContent('general content')
  await userEvent.click(screen.getByRole('tab', { name: 'Engine' }))
  expect(screen.getByRole('tabpanel', { name: 'Engine' })).toHaveTextContent('engine content')
  expect(screen.queryByText('general content')).not.toBeInTheDocument()
  expect(general).toHaveAttribute('tabindex', '-1')
})

it('supports automatic arrow activation, wrapping, Home and End with roving focus', async () => {
  mount()
  const general = screen.getByRole('tab', { name: 'General' })
  general.focus()
  for (const [key, name] of [['{ArrowLeft}', 'Engine'], ['{ArrowRight}', 'General'],
    ['{End}', 'Engine'], ['{Home}', 'General']] as const) {
    await userEvent.keyboard(key)
    expect(screen.getByRole('tab', { name, selected: true })).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name })).toBeVisible()
  }
})

it('keeps IDs unique across independent uses without vehicle-specific content', () => {
  mount()
  mount()
  const panels = screen.getAllByRole('tabpanel')
  expect(panels[0].id).not.toBe(panels[1].id)
})
