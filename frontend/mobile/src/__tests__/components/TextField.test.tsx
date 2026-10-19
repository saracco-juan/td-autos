import { render, screen } from '@testing-library/react-native'

import TextField from '../../components/TextField'

describe('TextField', () => {
  it('is editable by default', async () => {
    await render(<TextField label="Nombre" value="Ana" onChangeText={() => undefined} />)

    expect(screen.getByLabelText('Nombre')).not.toHaveProp('editable', false)
  })

  it('shows a read-only value that cannot be edited', async () => {
    await render(<TextField label="Email" value="ana@example.com" onChangeText={() => undefined} readOnly />)

    const input = screen.getByLabelText('Email')
    expect(input).toHaveProp('editable', false)
    expect(input).toHaveDisplayValue('ana@example.com')
  })
})
