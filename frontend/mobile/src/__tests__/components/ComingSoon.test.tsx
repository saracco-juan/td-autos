import { render, screen } from '@testing-library/react-native'

import ComingSoon from '../../components/ComingSoon'

describe('ComingSoon', () => {
  it('shows the tab title and the coming-soon text', async () => {
    await render(<ComingSoon title="Favoritos" />)

    expect(screen.getByText('Favoritos')).toBeOnTheScreen()
    expect(screen.getByText('Próximamente.')).toBeOnTheScreen()
  })
})
