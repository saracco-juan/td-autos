import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SessionLoading from './SessionLoading'

describe('SessionLoading', () => {
  it('announces the loading state as a status with its text', () => {
    render(<SessionLoading />)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
  })

  it('shows a decorative spinner hidden from assistive technology', () => {
    render(<SessionLoading />)

    const spinner = screen.getByRole('status').querySelector('[aria-hidden="true"]')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toBeEmptyDOMElement()
  })
})
