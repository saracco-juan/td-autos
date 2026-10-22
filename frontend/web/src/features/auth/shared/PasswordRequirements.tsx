import { PASSWORD_RULES } from '../passwordRules'
import styles from './PasswordRequirements.module.css'

type Props = {
  id: string
  password: string
}

// Always-visible checklist: each requirement turns green as soon as it is met.
export default function PasswordRequirements({ id, password }: Props) {
  return (
    <ul id={id} className={styles.requirements} aria-label="Requisitos de la contraseña">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li key={rule.id} data-met={met} className={styles.requirement}>
            <svg className={styles.requirementIcon} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              {met ? (
                <>
                  <circle cx="8" cy="8" r="7" fill="currentColor" />
                  <path d="M4.8 8.2l2.1 2.1 4.3-4.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
            <span>{rule.label}</span>
            <span className={styles.srOnly}>{met ? ' (cumplido)' : ' (pendiente)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
