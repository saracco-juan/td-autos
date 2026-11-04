import type { ChangeEvent, ReactNode } from 'react'
import Field from './Field'

export type SelectOption = { value: string; label: string }

export type SelectFieldProps = {
  // Full element id of the control.
  id: string
  name: string
  label: string
  value: string
  options: SelectOption[]
  // Label of the empty option shown while nothing is chosen.
  placeholder?: string
  errors?: string[]
  hint?: ReactNode
  hintId?: string
  onChange: (value: string) => void
}

// Labelled select; the empty first option is what "nothing chosen yet" looks like.
export default function SelectField({
  id,
  name,
  label,
  value,
  options,
  placeholder = 'Elegí una opción',
  errors,
  hint,
  hintId,
  onChange,
}: SelectFieldProps) {
  return (
    <Field id={id} label={label} errors={errors} hint={hint} hintId={hintId}>
      {(control) => (
        <select {...control} name={name} value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}
