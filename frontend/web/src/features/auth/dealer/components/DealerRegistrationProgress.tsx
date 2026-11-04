import { DEALER_REGISTRATION_STEPS } from '../model/dealerRegistrationSteps'
import styles from './DealerRegisterForm.module.css'

export default function DealerRegistrationProgress({ step, instant = false }: { step: number; instant?: boolean }) {
  return (
    <div
      role="progressbar"
      className={styles.progressRoot}
      data-instant={instant || undefined}
      aria-label="Registro de concesionaria"
      aria-valuemin={1}
      aria-valuemax={DEALER_REGISTRATION_STEPS.length}
      aria-valuenow={step + 1}
      aria-valuetext={`Paso ${step + 1} de ${DEALER_REGISTRATION_STEPS.length}: ${DEALER_REGISTRATION_STEPS[step].title}`}
    >
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
