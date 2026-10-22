import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { NetworkError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import { fetchDiagnosis, saveDiagnosis } from './api'
import BodyTypeChips from './BodyTypeChips'
import ChoiceList from './ChoiceList'
import {
  UNANSWERED_STEP_MESSAGE,
  buildAnswers,
  createEmptyDraft,
  draftFromAnswers,
  isStepAnswered,
  toggleBodyType,
} from '@shared/diagnosis/diagnosisDraft'
import LoadError, { type LoadErrorKind } from './LoadError'
import { DIAGNOSIS_STEPS } from '@shared/diagnosis/steps'
import StepProgress from './StepProgress'
import type { BodyType, DiagnosisDraft } from '@shared/diagnosis/types'

const SAVE_ERROR = 'No se pudieron guardar las respuestas. Intentá nuevamente.'
const LAST_STEP = DIAGNOSIS_STEPS.length - 1

type LoadState = 'loading' | 'ready' | { error: LoadErrorKind }

// Needs diagnosis (UH-04, CU-03): seven questions one at a time, saved at the end, then Recomendados.
export default function DiagnosisScreen() {
  const router = useRouter()
  const { authFetch, refreshUser } = useAuth()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [draft, setDraft] = useState<DiagnosisDraft>(createEmptyDraft)
  const [bodyTypes, setBodyTypes] = useState<BodyType[]>([])
  const [step, setStep] = useState(0)
  const [unanswered, setUnanswered] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDiagnosis(authFetch)
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
  }, [authFetch])

  const goToStep = (index: number) => {
    setStep(index)
    setUnanswered(false)
  }

  const handleDraftChange = (next: DiagnosisDraft) => {
    setDraft(next)
    setUnanswered(false)
    setSaveFailed(false)
  }

  // TC-13: a step without an answer does not let the user advance.
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
      setStep(result.firstUnansweredStep)
      setUnanswered(true)
      return
    }

    setSaveFailed(false)
    setSaving(true)
    try {
      await saveDiagnosis(authFetch, result.answers)
    } catch {
      setSaveFailed(true)
      setSaving(false)
      return
    }
    // The session user carries tiene_diagnostico; refreshUser never rejects.
    await refreshUser()
    router.navigate('/recomendados')
    // The tab stays mounted: coming back starts again at the first question with the saved answers.
    setSaving(false)
    setStep(0)
  }

  if (loadState === 'loading') return <Loader />
  if (loadState !== 'ready') return <LoadError kind={loadState.error} />

  const current = DIAGNOSIS_STEPS[step]
  const isLast = step === LAST_STEP

  return (
    <View style={styles.screen}>
      {/* Keyed by step so every question starts scrolled to the top. */}
      <ScrollView key={step} style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DIAGNÓSTICO DE NECESIDADES</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {current.title}
          </Text>
          {current.subtitle ? <Text style={styles.subtitle}>{current.subtitle}</Text> : null}
        </View>
        <StepProgress current={step + 1} total={DIAGNOSIS_STEPS.length} />
        {current.kind === 'multi' ? (
          <BodyTypeChips
            bodyTypes={bodyTypes}
            selected={draft.carrocerias}
            max={current.max}
            onToggle={(id) => handleDraftChange(toggleBodyType(draft, id))}
          />
        ) : (
          <ChoiceList
            options={current.options}
            value={draft[current.field]}
            onSelect={(code) => handleDraftChange({ ...draft, [current.field]: code })}
          />
        )}
        {unanswered ? <Alert variant="warning">{UNANSWERED_STEP_MESSAGE}</Alert> : null}
        {saveFailed ? <Alert variant="error">{SAVE_ERROR}</Alert> : null}
      </ScrollView>

      <View style={styles.actions}>
        {step > 0 ? (
          <View style={styles.action}>
            <Button label="ATRÁS" disabled={saving} onPress={() => goToStep(step - 1)} />
          </View>
        ) : null}
        <View style={styles.action}>
          {isLast ? (
            <Button
              label="VER RECOMENDACIONES"
              busyLabel="GUARDANDO…"
              busy={saving}
              variant="primary"
              onPress={() => void handleFinish()}
            />
          ) : (
            <Button label="CONTINUAR" variant="primary" onPress={handleNext} />
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20 },
  header: { gap: 8 },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  // Pinned under the scrolling question (docs/design.md "Page layout"): the actions stay visible.
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  action: { flex: 1 },
})
