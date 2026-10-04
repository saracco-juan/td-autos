import type { ReactNode } from 'react'
import styles from './authForm.module.css'

export type FieldControlProps = {
  id: string
  className: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

type Props = {
  // Full element id of the control; the error list and hint ids derive from it.
  id: string
  label: string
  errors?: string[]
  // Hint element rendered below the control while there are no errors; it must carry the id `${id}-hint`.
  hint?: ReactNode
  // Receives the props to spread on the control (input, PasswordInput, ...).
  children: (control: FieldControlProps) => ReactNode
}

// Labelled field: wires label, aria-invalid and aria-describedby to the control, and lists its errors.
export default function Field({ id, label, errors, hint, children }: Props) {
  const errorId = `${id}-error`
  const describedBy = errors ? errorId : hint ? `${id}-hint` : undefined

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children({
        id,
        className: styles.input,
        'aria-invalid': errors ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {errors ? (
        <ul id={errorId} className={styles.errors}>
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        hint
      )}
    </div>
  )
}
