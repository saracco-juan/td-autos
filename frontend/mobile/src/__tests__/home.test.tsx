import { render, screen } from '@testing-library/react-native'

import Home from '../app/index'

describe('Home', () => {
  it('shows the app name and the preparing message', async () => {
    await render(<Home />)

    expect(screen.getByText('TD Autos')).toBeOnTheScreen()
    expect(screen.getByText('Estamos preparando la app.')).toBeOnTheScreen()
  })
})
