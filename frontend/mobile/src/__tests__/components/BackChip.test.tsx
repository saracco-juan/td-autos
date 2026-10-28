import { fireEvent, render, screen } from '@testing-library/react-native'

import BackChip from '../../components/BackChip'

describe('BackChip', () => {
  it('is a link named by its label and calls onPress', async () => {
    const onPress = jest.fn()
    await render(<BackChip label="Volver a la ficha" onPress={onPress} />)

    const link = screen.getByRole('link', { name: 'Volver a la ficha' })
    expect(link).toHaveTextContent('Volver a la ficha')
    await fireEvent.press(link)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
