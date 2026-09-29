import { PASSWORD_RULES } from '../passwordRules'
import styles from './RegisterForm.module.css'

type Props = {
  id: string
  password: string
}

// Live list of the password requirements that are still unmet.
export default function PasswordRequirements({ id, password }: Props) {
  if (password === '') return null
  const unmet = PASSWORD_RULES.filter((rule) => !rule.test(password))
  if (unmet.length === 0) return null

  return (
    <ul id={id} className={styles.hints} aria-label="Requisitos de la contraseña">
      {unmet.map((rule) => (
        <li key={rule.id}>{rule.message}</li>
      ))}
    </ul>
  )
}
