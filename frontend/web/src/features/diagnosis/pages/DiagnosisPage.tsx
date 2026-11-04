import Button from '../../../components/Buttons/Button'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import ErrorState, { type ErrorKind } from '../../../components/ErrorState/ErrorState'
import barStyles from '../../../components/checklist/pinnedBar.module.css'
import FlowLayout from '../../../components/FlowLayout/FlowLayout'
import { NetworkError } from '../../../lib/http'
import SessionLoading from '../../auth/session/components/SessionLoading'
import { useAuth } from '../../auth/session/hooks/useAuth'
import { fetchDiagnosis, saveDiagnosis } from '../api/client'
import DiagnosisQuestion from '../components/DiagnosisQuestion'
import DiagnosisSummary from '../components/DiagnosisSummary'
import {
  buildAnswers,
  createEmptyDraft,
  draftFromAnswers,
  isStepAnswered,
  toggleBodyType,
} from '@shared/diagnosis/diagnosisDraft'
import styles from './DiagnosisPage.module.css'
import { DIAGNOSIS_STEPS } from '@shared/diagnosis/steps'
import StepProgress from '../components/StepProgress'
import type { BodyType, DiagnosisDraft } from '@shared/diagnosis/types'

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
            <Button
              type="button"
              disabled={saving}
              variant="secondary" className={`${barStyles.action}`}
              onClick={() => goToStep(step - 1)}
            >
              ATRÁS
            </Button>
          ) : null}
          {isLast ? (
            <Button
              type="button"
              disabled={saving}
              aria-busy={saving}
              variant="primary" className={`${barStyles.actionWide}`}
              onClick={handleFinish}
            >
              {saving ? 'GUARDANDO…' : 'VER RECOMENDACIONES'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary" className={`${barStyles.action}`}
              onClick={handleNext}
            >
              CONTINUAR
            </Button>
          )}
        </div>
      }
    >
      <StepProgress current={step + 1} total={DIAGNOSIS_STEPS.length} />
      <div className={styles.body}>
        <div className={styles.questions}>
          {DIAGNOSIS_STEPS.map((current, index) => (
            <DiagnosisQuestion
              key={current.field}
              current={current}
              index={index}
              active={index === step}
              step={step}
              draft={draft}
              bodyTypes={bodyTypes}
              unanswered={unanswered}
              bodyTypeLimitReached={bodyTypeLimitReached}
              passengersNeedConfirmation={passengersNeedConfirmation}
              saveFailed={saveFailed}
              titleRef={titleRef}
              onBodyTypeToggle={handleBodyTypeToggle}
              onDraftChange={handleDraftChange}
            />
          ))}
        </div>
        <DiagnosisSummary draft={draft} currentStep={step} bodyTypes={bodyTypes} />
      </div>

    </FlowLayout>
  )
}
