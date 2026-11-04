import { DEALER_REGISTRATION_STEPS } from '../model/dealerRegistrationSteps'
import accessibilityStyles from '../../../../styles/accessibility.module.css'
import styles from './DealerRegisterForm.module.css'

type Props = Readonly<{ step: number; instant?: boolean }>

export default function DealerRegistrationProgress({ step, instant = false }: Props) {
  return (
    <div
      className={styles.progressRoot}
      data-instant={instant || undefined}
    >
      <progress
        className={accessibilityStyles.visuallyHidden}
        aria-label="Registro de concesionaria"
        aria-valuemin={1}
        aria-valuemax={DEALER_REGISTRATION_STEPS.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Paso ${step + 1} de ${DEALER_REGISTRATION_STEPS.length}: ${DEALER_REGISTRATION_STEPS[step].title}`}
        value={step + 1}
        max={DEALER_REGISTRATION_STEPS.length}
      />
      <p className={styles.progressCaption} aria-hidden="true">
        Paso {step + 1} de {DEALER_REGISTRATION_STEPS.length}
        <span>{DEALER_REGISTRATION_STEPS[step].title}</span>
      </p>
      <ol className={styles.progress} aria-hidden="true">
        {DEALER_REGISTRATION_STEPS.map(({ title }, index) => (
          <li key={title} className={styles.segment} data-current={index === step || undefined}>
            <span className={styles.stepLabel}>{title}</span>
            <span className={styles.track}>
              <span className={styles.fill} style={{ transform: `scaleX(${index <= step ? 1 : 0})` }} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
