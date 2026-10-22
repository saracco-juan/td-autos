import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SelectField from './SelectField'
import TextAreaField from './TextAreaField'
import TextField from './TextField'

const OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatica', label: 'Automática' },
]

describe('SelectField', () => {
  it('renders a labelled select with a placeholder option and the given options', () => {
    render(<SelectField id="f-trans" name="transmision" label="Transmisión" value="" options={OPTIONS} onChange={() => {}} />)

    const select = screen.getByLabelText('Transmisión')
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveAttribute('name', 'transmision')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Elegí una opción', 'Manual', 'Automática'])
    expect(select).toHaveValue('')
  })

  it('shows the selected option and reports a new choice by value', async () => {
    const onChange = vi.fn()
    render(<SelectField id="f-trans" name="transmision" label="Transmisión" value="manual" options={OPTIONS} onChange={onChange} />)
    expect(screen.getByLabelText('Transmisión')).toHaveValue('manual')

    await userEvent.setup().selectOptions(screen.getByLabelText('Transmisión'), 'Automática')

    expect(onChange).toHaveBeenCalledWith('automatica')
  })

  it('uses a custom placeholder', () => {
    render(<SelectField id="f-c" name="c" label="Carrocería" value="" options={OPTIONS} placeholder="Elegí la carrocería" onChange={() => {}} />)

    expect(screen.getByRole('option', { name: 'Elegí la carrocería' })).toBeInTheDocument()
  })

  it('wires the errors like every Field: invalid, described by the list', () => {
    render(
      <SelectField id="f-trans" name="transmision" label="Transmisión" value="" options={OPTIONS} errors={['Elegí la transmisión.']} onChange={() => {}} />,
    )

    const select = screen.getByLabelText('Transmisión')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('Elegí la transmisión.')
  })
})

describe('TextAreaField', () => {
  it('renders a labelled textarea with its value and reports typing', async () => {
    const onChange = vi.fn()
    render(<TextAreaField id="f-desc" name="descripcion" label="Descripción" value="Hola" rows={4} onChange={onChange} />)

    const area = screen.getByLabelText('Descripción')
    expect(area.tagName).toBe('TEXTAREA')
    expect(area).toHaveValue('Hola')
    expect(area).toHaveAttribute('rows', '4')
    expect(area).toHaveAttribute('name', 'descripcion')

    await userEvent.setup().type(area, '!')

    expect(onChange).toHaveBeenLastCalledWith('Hola!')
  })

  it('wires the errors like every Field', () => {
    render(<TextAreaField id="f-desc" name="descripcion" label="Descripción" value="" errors={['Demasiado larga.']} onChange={() => {}} />)

    expect(screen.getByLabelText('Descripción')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Descripción')).toHaveAccessibleDescription('Demasiado larga.')
  })
})

describe('TextField inputMode', () => {
  it('passes inputMode to the input so numbers get the numeric keyboard', () => {
    render(<TextField id="f-km" name="km" label="Kilometraje" autoComplete="off" inputMode="numeric" value="" onChange={() => {}} />)

    expect(screen.getByLabelText('Kilometraje')).toHaveAttribute('inputmode', 'numeric')
  })
})
