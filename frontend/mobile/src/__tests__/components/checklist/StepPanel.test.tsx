import { fireEvent, render, screen } from '@testing-library/react-native'
import { Animated, Text } from 'react-native'

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

  it('places checked items last and restores catalog order when unchecked', async () => {
    const view = await render(<StepPanel {...baseProps} completedCodes={new Set(['a'])} />)
    expect(screen.getAllByRole('checkbox')[1]).toBeChecked()
    await view.rerender(<StepPanel {...baseProps} />)
    expect(screen.getAllByRole('checkbox')[0]).toHaveAccessibleName('Primero, etiqueta')
  })

  it('reports the toggled item', async () => {
    const onToggle = jest.fn()
    await render(<StepPanel {...baseProps} onToggle={onToggle} />)

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Segundo' }))

    expect(onToggle).toHaveBeenCalledWith('b', true)
  })

  it('moves a row across the measured list and redirects a second tap mid-flight', async () => {
    const longStep = { ...step, items: [...step.items, { codigo: 'c', texto: 'Tercero', flagged: false }] }
    const panel = (codes: string[]) => <StepPanel {...baseProps} step={longStep} completedCodes={new Set(codes)} reduceMotion={false} />
    const view = await render(panel([]))
    for (const [code, height] of [['a', 60], ['b', 48], ['c', 84]] as const) {
      await fireEvent(screen.getByTestId('checklist-row-' + code), 'layout', { nativeEvent: { layout: { height } } })
    }
    const stop = jest.fn()
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop, reset: jest.fn() }))
    try {
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Primero, etiqueta' }))
      await view.rerender(panel(['a']))
      expect(screen.getByRole('checkbox', { name: 'Primero, etiqueta' })).toBeChecked()
      expect(screen.getByTestId('checklist-row-a')).toHaveStyle({ zIndex: 1 })
      const travel = timing.mock.calls.find(([, config]) => config.toValue === 132)
      expect(travel?.[1]).toMatchObject({ delay: 480, duration: 900, useNativeDriver: true })
      const position = travel![0] as Animated.Value
      position.setValue(65)
      const reset = jest.spyOn(position, 'setValue')
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Segundo' }))
      await view.rerender(panel(['a', 'b']))
      expect(screen.getByTestId('checklist-row-b')).toHaveStyle({ zIndex: 1 })
      expect(timing).toHaveBeenCalledWith(position, expect.objectContaining({ toValue: 84, delay: 0 }))
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Primero, etiqueta' }))
      await view.rerender(panel(['b']))
      expect(stop).toHaveBeenCalled()
      expect(timing).toHaveBeenCalledWith(position, expect.objectContaining({ toValue: 0, delay: 0 }))
      expect(reset).not.toHaveBeenCalled()
      expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked()
      expect(screen.getAllByRole('checkbox')[2]).toHaveAccessibleName('Segundo')
      expect(screen.getAllByRole('checkbox')[2]).toBeChecked()
    } finally {
      timing.mockRestore()
    }
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
