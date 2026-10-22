import type { ChangeEvent, ReactNode } from 'react'
import Field from './Field'
import styles from './authForm.module.css'

export type TextAreaFieldProps = {
  // Full element id of the control.
  id: string
  name: string
  label: string
  value: string
  rows?: number
  errors?: string[]
  hint?: ReactNode
  hintId?: string
  onChange: (value: string) => void
}

// Labelled multi-line input, same look as the single-line fields but as tall as its rows.
export default function TextAreaField({ id, name, label, value, rows = 3, errors, hint, hintId, onChange }: TextAreaFieldProps) {
  return (
    <Field id={id} label={label} errors={errors} hint={hint} hintId={hintId}>
      {(control) => (
        <textarea
          {...control}
          className={`${control.className} ${styles.textarea}`}
          name={name}
          rows={rows}
          value={value}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        />
      )}
    </Field>
  )
}
