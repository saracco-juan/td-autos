import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FormProgress from '../../components/FormProgress/FormProgress'

describe('FormProgress', () => {
  it.each([
    { labels: ['Identidad'], step: -1 },
    { labels: ['Identidad'], step: 1 },
    { labels: [], step: 0 },
  ])('does not announce progress for a missing step ($step)', ({ labels, step }) => {
    const { container } = render(<FormProgress ariaLabel="Carga de vehículo" labels={labels} step={step} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it('announces the current step and renders the shared segmented progress', () => {
    render(<FormProgress ariaLabel="Carga de vehículo" labels={['Identidad', 'Publicación', 'Técnica']} step={1} />)

    expect(screen.getByRole('progressbar', { name: 'Carga de vehículo' })).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Paso 2 de 3: Publicación')
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument()
    expect(screen.getAllByText('Publicación')).toHaveLength(2)
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(3)
  })

  it('supports an instant initial render for reduced-motion navigation', () => {
    const { container } = render(<FormProgress ariaLabel="Carga de vehículo" labels={['Fotos', 'Guardar']} step={0} instant />)

    expect(container.querySelector('[data-instant="true"]')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2')
  })

  it('keeps the accessible step current when navigating forward, backward and rerendering', () => {
    const labels = ['Identidad', 'Publicación', 'Fotos']
    const { rerender } = render(<FormProgress ariaLabel="Carga de vehículo" labels={labels} step={0} />)

    for (const step of [2, 1, 1]) {
      rerender(<FormProgress ariaLabel="Carga de vehículo" labels={labels} step={step} instant={step === 2} />)
      const progress = screen.getByRole('progressbar', { name: 'Carga de vehículo' })
      expect(progress).toHaveValue(step + 1)
      expect(progress).toHaveAttribute('aria-valuetext', `Paso ${step + 1} de 3: ${labels[step]}`)
    }
  })
})
