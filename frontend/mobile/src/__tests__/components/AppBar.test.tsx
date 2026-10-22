import { render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import AppBar from '../../components/AppBar'

describe('AppBar', () => {
  it('shows the TD monogram followed by "Autos", named as the full brand', async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <AppBar />
      </SafeAreaProvider>,
    )

    expect(screen.getByRole('header', { name: 'TD Autos' })).toBeOnTheScreen()
    expect(screen.getByText('Autos')).toBeOnTheScreen()
    expect(screen.queryByText('TD Autos')).not.toBeOnTheScreen()
  })
})
