import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import type { ChecklistStep } from '@shared/checklist/types'
import StepPanel from '../../../components/checklist/StepPanel'

const step: ChecklistStep = {
  numero: 1,
  titulo: 'Etapa',
  ayuda: 'Ayuda',
  items: [
    { codigo: 'a', texto: 'Primero', flagged: true },
    { codigo: 'b', texto: 'Segundo', flagged: false },
  ],
}

const baseProps = {
  step,
  completedCodes: new Set<string>(),
  saveFailed: false,
  flagLabel: 'ETIQUETA',
  saveError: 'No se guardó',
  onToggle: jest.fn(),
}

describe('StepPanel', () => {
  it('uses the flag label and the save error it receives', async () => {
    await render(<StepPanel {...baseProps} saveFailed />)

    expect(screen.getByText('ETIQUETA')).toBeOnTheScreen()
    expect(screen.getByRole('checkbox', { name: 'Primero, etiqueta' })).toBeOnTheScreen()
    expect(screen.getByRole('alert')).toHaveTextContent('No se guardó')
  })

  it('reports the toggled item', async () => {
    const onToggle = jest.fn()
    await render(<StepPanel {...baseProps} onToggle={onToggle} />)

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Segundo' }))

    expect(onToggle).toHaveBeenCalledWith('b', true)
  })

  it('renders the footer inside the card, under the items', async () => {
    await render(
      <StepPanel {...baseProps}>
        <Text>Nota al pie</Text>
      </StepPanel>,
    )

    expect(screen.getByText('Nota al pie')).toBeOnTheScreen()
  })
})
