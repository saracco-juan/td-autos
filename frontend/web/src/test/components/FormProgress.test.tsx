import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FormProgress from '../../components/FormProgress/FormProgress'

describe('FormProgress', () => {
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
})
