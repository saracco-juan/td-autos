import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import barStyles from '../../components/checklist/pinnedBar.module.css'
import FlowLayout from '../../components/FlowLayout'
import { NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import { useAuth } from '../auth/session/useAuth'
import { fetchDiagnosis, saveDiagnosis } from './api'
import BodyTypeChips from './BodyTypeChips'
import ChoiceCards from './ChoiceCards'
import DiagnosisSummary from './DiagnosisSummary'
import {
  UNANSWERED_STEP_MESSAGE,
  buildAnswers,
  createEmptyDraft,
  draftFromAnswers,
  isStepAnswered,
  toggleBodyType,
} from '@shared/diagnosis/diagnosisDraft'
import styles from './DiagnosisPage.module.css'
import { DIAGNOSIS_STEPS } from '@shared/diagnosis/steps'
import StepProgress from './StepProgress'
import type { BodyType, DiagnosisDraft } from '@shared/diagnosis/types'

const SAVE_ERROR = 'No se pudieron guardar las respuestas. Intentá nuevamente.'
const TITLE_ID = 'diagnosis-step-title'
const MESSAGE_ID = 'diagnosis-step-message'
const BODY_TYPE_HINT_ID = 'diagnosis-body-type-hint'
const BODY_TYPE_LIMIT_MESSAGE = 'Podés elegir hasta dos. Desmarcá una para cambiarla.'
const LAST_STEP = DIAGNOSIS_STEPS.length - 1

type LoadState = 'loading' | 'ready' | { error: ErrorKind }

export default function DiagnosisPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [draft, setDraft] = useState<DiagnosisDraft>(createEmptyDraft)
  const [bodyTypes, setBodyTypes] = useState<BodyType[]>([])
  const [step, setStep] = useState(0)
  const [unanswered, setUnanswered] = useState(false)
  const [bodyTypeLimitReached, setBodyTypeLimitReached] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [passengersNeedConfirmation, setPassengersNeedConfirmation] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const stepChanged = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchDiagnosis()
      .then(({ diagnostico, carrocerias }) => {
        if (cancelled) return
        setBodyTypes(carrocerias)
        setDraft(diagnostico ? draftFromAnswers(diagnostico) : createEmptyDraft())
        if (diagnostico?.pasajeros === null) {
          setPassengersNeedConfirmation(true)
          setStep(DIAGNOSIS_STEPS.findIndex(({ field }) => field === 'pasajeros'))
        }
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadState({ error: error instanceof NetworkError ? 'network' : 'server' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // After a step change the title takes the focus, so the new question is announced and the keyboard starts there.
  useEffect(() => {
    if (!stepChanged.current) return
    stepChanged.current = false
    const title = titleRef.current
    if (!title) return
    title.focus({ preventScroll: true })
    const { top, bottom } = title.getBoundingClientRect()
    if (top < 96 || bottom > window.innerHeight) {
      title.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }
  }, [step])

  const goToStep = (index: number) => {
    stepChanged.current = index !== step
    setStep(index)
    setUnanswered(false)
    setBodyTypeLimitReached(false)
  }

  const handleDraftChange = (next: DiagnosisDraft) => {
    setDraft(next)
    setUnanswered(false)
    setSaveFailed(false)
    setBodyTypeLimitReached(false)
  }

  const handleBodyTypeToggle = (id: number) => {
    const next = toggleBodyType(draft, id)
    if (next === draft) {
      setBodyTypeLimitReached(true)
      return
    }
    handleDraftChange(next)
  }

  const handleNext = () => {
    if (!isStepAnswered(draft, step)) {
      setUnanswered(true)
      return
    }
    goToStep(step + 1)
  }

  const handleFinish = async () => {
    if (saving) return
    const result = buildAnswers(draft)
    if (!result.ok) {
      stepChanged.current = result.firstUnansweredStep !== step
      setStep(result.firstUnansweredStep)
      setUnanswered(true)
      return
    }

    setSaveFailed(false)
    setSaving(true)
    try {
      await saveDiagnosis(result.answers)
      // The session user carries tiene_diagnostico: reload it so going back to / does not bounce here again.
      // refresh() never rejects; the guard keeps a failure from blocking the navigation anyway.
      try {
        await refresh()
      } catch {
        // Nothing to do: the saved diagnosis stands and the user moves on.
      }
      // The button stays busy until the page is replaced: no second submit while navigating.
      navigate('/recomendaciones')
    } catch {
      setSaveFailed(true)
      setSaving(false)
    }
  }

  // The loader is a direct child of the content area so it is centered there, not inside the page column.
  if (loadState === 'loading') return <SessionLoading />

  if (typeof loadState === 'object') return <ErrorState kind={loadState.error} />

  const isLast = step === LAST_STEP

  return (
    <FlowLayout
      className={styles.page}
      actions={
        <div className={`${barStyles.actions} ${styles.actions}`}>
          {step > 0 ? (
            <button
              type="button"
              disabled={saving}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${barStyles.action}`}
              onClick={() => goToStep(step - 1)}
            >
              ATRÁS
            </button>
          ) : null}
          {isLast ? (
            <button
              type="button"
              disabled={saving}
              aria-busy={saving}
              className={`${buttonStyles.button} ${buttonStyles.primary} ${barStyles.actionWide}`}
              onClick={handleFinish}
            >
              {saving ? 'GUARDANDO…' : 'VER RECOMENDACIONES'}
            </button>
          ) : (
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.primary} ${barStyles.action}`}
              onClick={handleNext}
            >
              CONTINUAR
            </button>
          )}
        </div>
      }
    >
      <StepProgress current={step + 1} total={DIAGNOSIS_STEPS.length} />
      <div className={styles.body}>
        <div className={styles.questions}>
          {DIAGNOSIS_STEPS.map((current, index) => {
            const active = index === step
            const titleId = `${TITLE_ID}-${index}`
            const messageId = active && unanswered ? MESSAGE_ID : undefined
            return <section key={current.field} className={styles.question}
              aria-labelledby={titleId} aria-hidden={!active} inert={!active}
              style={{ transform: `translateX(${active ? '0px' : index < step ? 'var(--diagnosis-motion-distance)' : 'calc(-1 * var(--diagnosis-motion-distance))'})`, opacity: active ? 1 : 0 }}>
              <div className={styles.header}>
                <h1 id={titleId} ref={active ? titleRef : null} tabIndex={-1} className={styles.title}>{current.title}</h1>
                {current.subtitle ? <p className={styles.subtitle}
                  id={current.kind === 'multi' ? BODY_TYPE_HINT_ID : undefined}
                  role={current.kind === 'multi' ? 'status' : undefined}>
                  {current.kind === 'multi' && bodyTypeLimitReached ? BODY_TYPE_LIMIT_MESSAGE : current.subtitle}
                </p> : null}
              </div>
              <div className={styles.options}>
                {active && passengersNeedConfirmation && current.field === 'pasajeros' && draft.pasajeros === null && !unanswered ? (
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
                    onToggle={handleBodyTypeToggle}
                  />
                ) : (
                  <ChoiceCards
                    name={current.field}
                    labelledBy={titleId}
                    options={current.options}
                    value={draft[current.field]}
                    describedBy={messageId}
                    invalid={active && unanswered}
                    onSelect={(code) => handleDraftChange({ ...draft, [current.field]: code })}
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
          })}
        </div>
        <DiagnosisSummary draft={draft} currentStep={step} bodyTypes={bodyTypes} />
      </div>

    </FlowLayout>
  )
}
