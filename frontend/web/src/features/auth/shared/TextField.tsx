import type { ChangeEvent, ReactNode } from 'react'
import Field from './Field'
import PasswordInput from './PasswordInput'

export type TextFieldProps = {
  // Full element id of the control.
  id: string
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'password'
  autoComplete: string
  // Keyboard hint for numbers typed in a text input (no spinner, no browser number parsing).
  inputMode?: 'numeric' | 'decimal'
  value: string
  errors?: string[]
  hint?: ReactNode
  hintId?: string
  onChange: (value: string) => void
}

// Labelled single-line input of the registration forms; a password type gets the visibility toggle.
export default function TextField({ id, name, label, type = 'text', autoComplete, inputMode, value, errors, hint, hintId, onChange }: TextFieldProps) {
  const Input = type === 'password' ? PasswordInput : 'input'

  return (
    <Field id={id} label={label} errors={errors} hint={hint} hintId={hintId}>
      {(control) => (
        <Input
          {...control}
          name={name}
          autoComplete={autoComplete}
          inputMode={inputMode}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          {...(type === 'password' ? {} : { type })}
        />
      )}
    </Field>
  )
}
