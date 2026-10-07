import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
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
} from './diagnosisDraft'
import styles from './DiagnosisPage.module.css'
import { DIAGNOSIS_STEPS } from './steps'
import StepProgress from './StepProgress'
import type { BodyType, DiagnosisDraft } from './types'

const SAVE_ERROR = 'No se pudieron guardar las respuestas. Intentá nuevamente.'
const TITLE_ID = 'diagnosis-step-title'
const MESSAGE_ID = 'diagnosis-step-message'
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
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const stepChanged = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchDiagnosis()
      .then(({ diagnostico, carrocerias }) => {
        if (cancelled) return
        setBodyTypes(carrocerias)
        setDraft(diagnostico ? draftFromAnswers(diagnostico) : createEmptyDraft())
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
    titleRef.current?.focus()
  }, [step])

  const goToStep = (index: number) => {
    stepChanged.current = index !== step
    setStep(index)
    setUnanswered(false)
  }

  const handleDraftChange = (next: DiagnosisDraft) => {
    setDraft(next)
    setUnanswered(false)
    setSaveFailed(false)
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

  const current = DIAGNOSIS_STEPS[step]
  const isLast = step === LAST_STEP
  const messageId = unanswered ? MESSAGE_ID : undefined

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>DIAGNÓSTICO DE NECESIDADES</p>
        <h1 id={TITLE_ID} ref={titleRef} tabIndex={-1} className={styles.title}>
          {current.title}
        </h1>
        {current.subtitle ? <p className={styles.subtitle}>{current.subtitle}</p> : null}
        <StepProgress current={step + 1} total={DIAGNOSIS_STEPS.length} />
      </div>

      <div className={styles.body}>
        <div className={styles.options}>
          {current.kind === 'multi' ? (
            <BodyTypeChips
              labelledBy={TITLE_ID}
              bodyTypes={bodyTypes}
              selected={draft.carrocerias}
              describedBy={messageId}
              onToggle={(id) => handleDraftChange(toggleBodyType(draft, id))}
            />
          ) : (
            <ChoiceCards
              // The step key resets the radio group so a step never inherits the previous focus.
              key={current.field}
              name={current.field}
              labelledBy={TITLE_ID}
              options={current.options}
              value={draft[current.field]}
              describedBy={messageId}
              invalid={unanswered}
              onSelect={(code) => handleDraftChange({ ...draft, [current.field]: code })}
            />
          )}
          {unanswered ? (
            <p id={MESSAGE_ID} role="alert" className={`${alertStyles.warning} ${styles.message}`}>
              {UNANSWERED_STEP_MESSAGE}
            </p>
          ) : null}
          {saveFailed ? (
            <p role="alert" className={`${alertStyles.alert} ${styles.message}`}>
              {SAVE_ERROR}
            </p>
          ) : null}
        </div>
        <DiagnosisSummary draft={draft} currentStep={step} bodyTypes={bodyTypes} />
      </div>

      <div className={styles.actions}>
        {step > 0 ? (
          <button
            type="button"
            disabled={saving}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.back}`}
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
            className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.finish}`}
            onClick={handleFinish}
          >
            {saving ? 'GUARDANDO…' : 'VER RECOMENDACIONES'}
          </button>
        ) : (
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.next}`}
            onClick={handleNext}
          >
            CONTINUAR
          </button>
        )}
      </div>
    </div>
  )
}
