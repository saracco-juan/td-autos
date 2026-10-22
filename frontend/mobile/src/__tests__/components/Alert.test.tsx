import { render, screen } from '@testing-library/react-native'

import Alert from '../../components/Alert'

describe('Alert', () => {
  it.each(['error', 'success', 'warning'] as const)('announces the %s message as an alert', async (variant) => {
    await render(<Alert variant={variant}>Mensaje</Alert>)

    expect(screen.getByRole('alert')).toHaveTextContent('Mensaje')
  })
})
