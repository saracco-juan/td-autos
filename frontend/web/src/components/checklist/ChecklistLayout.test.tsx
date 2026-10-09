import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import ChecklistColumns from './ChecklistColumns'
import ChecklistWarning from './ChecklistWarning'
import { STEPS } from './fixtures'

describe('ChecklistColumns', () => {
  it('renders the list, the panel and the optional aside', () => {
    render(<ChecklistColumns steps={STEPS} list={<p>lista</p>} panel={<p>panel</p>} aside={<p>lateral</p>} />)

    expect(screen.getByText('lista')).toBeInTheDocument()
    expect(screen.getByText('panel')).toBeInTheDocument()
    expect(screen.getByText('lateral')).toBeInTheDocument()
  })

  it('renders without an aside', () => {
    render(<ChecklistColumns steps={STEPS} list={<p>lista</p>} panel={<p>panel</p>} />)

    expect(screen.queryByText('lateral')).not.toBeInTheDocument()
  })

  it('sizes the panel for the longest step through --max-items', () => {
    const { container } = render(<ChecklistColumns steps={STEPS} list={<p>lista</p>} panel={<p>panel</p>} />)

    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--max-items')).toBe('2')
  })
})

describe('ChecklistWarning', () => {
  it('is an alert box that can receive the focus', () => {
    const ref = createRef<HTMLParagraphElement>()
    render(<ChecklistWarning warningRef={ref}>Te quedan 2 pendientes.</ChecklistWarning>)

    const warning = screen.getByRole('alert')
    expect(warning).toHaveTextContent('Te quedan 2 pendientes.')
    expect(warning).toHaveAttribute('tabindex', '-1')
    expect(ref.current).toBe(warning)
  })
})
