import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChecklistCardGrid from './ChecklistCardGrid'

describe('ChecklistCardGrid', () => {
  it('renders its cards in order', () => {
    render(
      <ChecklistCardGrid single={false}>
        <p>first</p>
        <p>second</p>
      </ChecklistCardGrid>,
    )

    expect(screen.getAllByText(/first|second/).map((card) => card.textContent)).toEqual(['first', 'second'])
  })

  it('adds the single-column class only when single', () => {
    const { container, rerender } = render(
      <ChecklistCardGrid single={false}>
        <p>card</p>
      </ChecklistCardGrid>,
    )
    expect(container.firstElementChild?.className).not.toMatch(/single/)

    rerender(
      <ChecklistCardGrid single>
        <p>card</p>
      </ChecklistCardGrid>,
    )
    expect(container.firstElementChild?.className).toMatch(/single/)
  })
})
