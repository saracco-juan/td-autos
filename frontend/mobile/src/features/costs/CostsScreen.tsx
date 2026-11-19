import { useBuyerTabBarSpace } from '../../components/BuyerTabIndicator'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import BackLink from '../../components/BackLink'
import { archivo } from '../../theme/archivo'
import useReduceMotion from '../../lib/useReduceMotion'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { HttpError, NetworkError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { parseVehicleId } from '@shared/checklist/inspection/vehicle'
import { validateKm } from '@shared/costs/validateKm'
import type { Coverage, CostsQuery, OwnershipCosts } from '@shared/costs/types'
import { useAuth } from '../auth/useAuth'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { fetchCosts } from './api'
import { Disclaimer, MonthlyPanel, PurchasePanel } from './CostPanels'
import CostsForm, { type FieldErrors } from './CostsForm'

type ScreenState = { status: 'loading' | 'notFound' } | { status: 'error'; kind: LoadErrorKind } | { status: 'ready'; data: OwnershipCosts }

const GENERIC_ERROR = 'No pudimos calcular los costos. Intentá de nuevo en unos minutos.'
const NOT_FOUND = 'No encontramos ese vehículo.'
const BACK_LABEL = 'Volver a la ficha'

type ValidationBody = { errors?: { km?: string[]; cobertura?: string[] } }

function fieldErrorsOf(error: unknown): FieldErrors | null {
  if (!(error instanceof HttpError) || error.status !== 422) return null
  const errors = (error.body as ValidationBody | null)?.errors
  const found: FieldErrors = { km: errors?.km, coverage: errors?.cobertura }
  return found.km?.length || found.coverage?.length ? found : null
}

// Financial calculator (HU10-MOBILE, RF09), Figma "06 - Calculadora financiera" 2373:10024 / 06b 2469:16159.
// Same data, copy and states as the web OwnershipCostsPage; texts and formulas come from `@shared/costs`.
export default function CostsScreen({ rawId }: Readonly<{ rawId: string | undefined }>) {
  // The key restarts the whole screen when the route points to another vehicle.
  return <Costs key={rawId} id={parseVehicleId(rawId)} />
}

function Costs({ id }: Readonly<{ id: number | null }>) {
  const [editing, setEditing] = useState(false)
  const reduceMotion = useReduceMotion()
  const barSpace = useBuyerTabBarSpace()
  const { authFetch } = useAuth()
  const router = useRouter()
  const [view, setView] = useState<ScreenState>({ status: id === null ? 'notFound' : 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [recalculating, setRecalculating] = useState(false)
  const [km, setKm] = useState('')
  const [coverage, setCoverage] = useState<Coverage>('terceros_completo')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<string>()
  const latest = useRef(0)

  const load = useCallback(
    (query: CostsQuery, first: boolean) => {
      if (id === null) return
      const request = ++latest.current
      fetchCosts(authFetch, id, ...(first ? [] : [query]))
        .then((data) => {
          if (request !== latest.current) return
          setView({ status: 'ready', data })
          setKm(String(data.inputs.km_per_month))
          setCoverage(data.inputs.coverage)
          setRecalculating(false)
          setEditing(false)
        })
        .catch((error: unknown) => {
          if (request !== latest.current) return
          setRecalculating(false)
          if (error instanceof HttpError && error.status === 404) {
            setView({ status: 'notFound' })
            return
          }
          if (first) {
            setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
            return
          }
          // A failed recalculation keeps the previous result on screen.
          const invalid = fieldErrorsOf(error)
          if (invalid) setFieldErrors(invalid)
          else setNotice(GENERIC_ERROR)
        })
    },
    [authFetch, id],
  )

  useEffect(() => {
    load({}, true)
    return () => {
      latest.current += 1
    }
  }, [load, attempt])

  const retry = () => {
    setView({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  const recalculate = () => {
    const checked = validateKm(km)
    if ('error' in checked) {
      setFieldErrors({ km: [checked.error] })
      return
    }
    setFieldErrors({})
    setNotice(undefined)
    setRecalculating(true)
    load({ km: checked.km, coverage }, false)
  }

  // Explicit target: the tabs navigator's back goes to its first tab, not to the previous screen.
  const goBack = () => router.navigate(`/vehiculos/${id}`)
  const data = view.status === 'ready' ? view.data : null
  const vehicle = data?.vehicle
  const title = vehicle ? [vehicle.make, vehicle.model, vehicle.version, vehicle.year].filter(Boolean).join(' ') : ''

  const closeEditor = () => {
    if (recalculating) return
    setEditing(false)
    setFieldErrors({})
    setNotice(undefined)
    if (data) {
      setKm(String(data.inputs.km_per_month))
      setCoverage(data.inputs.coverage)
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: barSpace + 16 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, archivo(true)]}>Calculadora de costos</Text>
        {title ? <Text style={[styles.muted, archivo()]}>{title}</Text> : null}
        <BackLink label={BACK_LABEL} onPress={goBack} />
      </View>
      {view.status === 'loading' ? (
        <View style={styles.section}>
          <Loader />
        </View>
      ) : null}
      {view.status === 'notFound' ? (
        <View accessibilityRole="alert" style={styles.notFound}>
          <Text accessibilityRole="header" style={styles.notFoundTitle}>
            {NOT_FOUND}
          </Text>
        </View>
      ) : null}
      {view.status === 'error' ? (
        <View style={styles.section}>
          <LoadError kind={view.kind} />
          <Button label="REINTENTAR" variant="primary" onPress={retry} />
        </View>
      ) : null}

      {data && vehicle ? (
        <>
          <MonthlyPanel data={data} onAdjust={() => setEditing(true)} />
          <PurchasePanel data={data} />
          <Disclaimer data={data} />
          <Modal visible={editing} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={closeEditor}>
            <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.dialog} accessibilityViewIsModal>
                <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                  <Text accessibilityRole="header" style={[styles.modalTitle, archivo(true)]}>Ajustá tu estimación</Text>
                  <Text style={[styles.muted, archivo()]}>Indicá cuánto vas a manejar y la cobertura que preferís.</Text>
                  {notice ? <Alert variant="error">{notice}</Alert> : null}
                  <CostsForm
                    km={km}
                    coverage={coverage}
                    kmHint={data.inputs.km_source === 'default'}
                    errors={fieldErrors}
                    busy={recalculating}
                    onKmChange={setKm}
                    onCoverageChange={setCoverage}
                    onSubmit={recalculate}
                    onCancel={closeEditor}
                  />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 28 },
  // Loading and errors stay inside the screen content (docs/design.md "Feedback").
  section: { minHeight: 240, gap: 16 },
  notFound: { gap: 8 },
  notFoundTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  header: { gap: 8 },
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#241f1c66' },
  dialog: { maxHeight: '90%', width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  form: { padding: 20, gap: 16 },
  modalTitle: { fontSize: 24, color: colors.charcoal },
  title: { color: colors.textPrimary, fontSize: 32 },
  muted: { color: colors.textSecondary, fontSize: 14 },
})
