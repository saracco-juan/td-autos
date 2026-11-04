import styles from '../button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success'

export function buttonClassName(variant?: ButtonVariant, className?: string) {
  return [styles.button, variant && styles[variant], className].filter(Boolean).join(' ')
}
