import type { CSSProperties, Ref } from 'react'
import alertStyles from '../../../styles/alert.module.css'
import { UNANSWERED_STEP_MESSAGE } from '@shared/diagnosis/diagnosisDraft'
import type { DiagnosisStep } from '@shared/diagnosis/steps'
import type { BodyType, DiagnosisDraft } from '@shared/diagnosis/types'
import BodyTypeChips from './BodyTypeChips'
import ChoiceCards from './ChoiceCards'
import styles from '../pages/DiagnosisPage.module.css'

const MESSAGE_ID = 'diagnosis-step-message'
const BODY_TYPE_HINT_ID = 'diagnosis-body-type-hint'
const BODY_TYPE_LIMIT_MESSAGE = 'Podés elegir hasta dos. Desmarcá una para cambiarla.'
const SAVE_ERROR = 'No se pudieron guardar las respuestas. Intentá nuevamente.'

type Props = Readonly<{
  current: DiagnosisStep
  index: number
  active: boolean
  step: number
  draft: DiagnosisDraft
  bodyTypes: BodyType[]
  unanswered: boolean
  bodyTypeLimitReached: boolean
  passengersNeedConfirmation: boolean
  saveFailed: boolean
  titleRef: Ref<HTMLHeadingElement>
  onBodyTypeToggle: (id: number) => void
  onDraftChange: (next: DiagnosisDraft) => void
}>

export default function DiagnosisQuestion({
  current,
  index,
  active,
  step,
  draft,
  bodyTypes,
  unanswered,
  bodyTypeLimitReached,
  passengersNeedConfirmation,
  saveFailed,
  titleRef,
  onBodyTypeToggle,
  onDraftChange,
}: Props) {
  const titleId = `diagnosis-step-title-${index}`
  const messageId = active && unanswered ? MESSAGE_ID : undefined
  const showPassengerNotice = active && passengersNeedConfirmation && current.field === 'pasajeros' && draft.pasajeros === null && !unanswered
  const subtitle = current.kind === 'multi' && bodyTypeLimitReached ? BODY_TYPE_LIMIT_MESSAGE : current.subtitle
  let motionOffset = '0px'
  if (!active && index < step) motionOffset = 'var(--diagnosis-motion-distance)'
  else if (!active) motionOffset = 'calc(-1 * var(--diagnosis-motion-distance))'

  const motionStyle = {
    '--diagnosis-motion-offset': motionOffset,
    opacity: active ? 1 : 0,
  } as CSSProperties

  return (
    <section
      className={styles.question}
      aria-labelledby={titleId}
      aria-hidden={!active}
      inert={!active}
      style={motionStyle}
    >
      <div className={styles.header}>
        <h1 id={titleId} ref={active ? titleRef : null} tabIndex={-1} className={styles.title}>{current.title}</h1>
        {current.subtitle ? (
          <p
            className={styles.subtitle}
            id={current.kind === 'multi' ? BODY_TYPE_HINT_ID : undefined}
            role={current.kind === 'multi' ? 'status' : undefined}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className={styles.options}>
        {showPassengerNotice ? (
          <p role="alert" className={`${alertStyles.warning} ${styles.message}`}>
            Actualizamos las opciones de pasajeros. Volvé a elegir cuántas personas viajan habitualmente.
          </p>
        ) : null}
        {current.kind === 'multi' ? (
          <BodyTypeChips
            labelledBy={titleId}
            bodyTypes={bodyTypes}
            selected={draft.carrocerias}
            describedBy={messageId ?? (bodyTypeLimitReached ? BODY_TYPE_HINT_ID : undefined)}
            onToggle={onBodyTypeToggle}
          />
        ) : (
          <ChoiceCards
            name={current.field}
            labelledBy={titleId}
            options={current.options}
            value={draft[current.field]}
            describedBy={messageId}
            invalid={active && unanswered}
            onSelect={(code) => onDraftChange({ ...draft, [current.field]: code })}
          />
        )}
        {active && unanswered ? (
          <p id={MESSAGE_ID} role="alert" className={`${alertStyles.warning} ${styles.message}`}>
            {UNANSWERED_STEP_MESSAGE}
          </p>
        ) : null}
        {active && saveFailed ? (
          <p role="alert" className={`${alertStyles.alert} ${styles.message}`}>
            {SAVE_ERROR}
          </p>
        ) : null}
      </div>
    </section>
  )
}
