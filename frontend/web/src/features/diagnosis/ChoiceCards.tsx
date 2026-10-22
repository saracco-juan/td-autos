import styles from './ChoiceCards.module.css'

type Props = {
  name: string
  // Id of the element that names the group (the question title).
  labelledBy: string
  options: readonly { code: string; label: string }[]
  value: string | null
  // Id of the validation message; set only while it is shown.
  describedBy?: string
  invalid: boolean
  onSelect: (code: string) => void
}

// Single-choice question: native radios, so arrow keys move the selection inside the group.
export default function ChoiceCards({ name, labelledBy, options, value, describedBy, invalid, onSelect }: Props) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={styles.group}
    >
      {options.map((option) => (
        <label key={option.code} className={`${styles.card} ${option.code === value ? styles.selected : ''}`}>
          <input
            type="radio"
            name={name}
            value={option.code}
            checked={option.code === value}
            onChange={() => onSelect(option.code)}
            className={styles.input}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
