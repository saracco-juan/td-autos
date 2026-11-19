import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DealerRegistrationProgress from '../../../../features/auth/dealer/components/DealerRegistrationProgress'

describe('DealerRegistrationProgress', () => {
  it('preserves the registration label and passes instant navigation to shared progress', () => {
    const { container, rerender } = render(<DealerRegistrationProgress step={1} />)

    expect(container.querySelector('[data-instant="true"]')).not.toBeInTheDocument()
    rerender(<DealerRegistrationProgress step={1} instant />)

    const progress = screen.getByRole('progressbar', { name: 'Registro de concesionaria' })
    expect(progress).toHaveValue(2)
    expect(progress).toHaveAttribute('aria-valuenow', '2')
    expect(container.querySelector('[data-instant="true"]')).toContainElement(progress)
    rerender(<DealerRegistrationProgress step={2} instant={false} />)
    expect(progress).toHaveValue(3)
    expect(container.querySelector('[data-instant="true"]')).not.toBeInTheDocument()
  })
})
