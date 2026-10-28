import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { HttpError, NetworkError } from '../../lib/http'
import { colors, radii } from '../../theme/tokens'
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="link" accessibilityLabel={BACK_LABEL} onPress={goBack} style={styles.back}>
        <View style={styles.chevron}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </View>
        <Text style={styles.backLabel}>{BACK_LABEL}</Text>
      </Pressable>
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
          <View style={styles.header}>
            <Text style={styles.eyebrow}>COSTO DE POSESIÓN</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.muted}>Cuánto te costaría comprarlo y mantenerlo, más allá del precio publicado.</Text>
          </View>
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
          />
          {recalculating ? (
            <View style={styles.section}>
              <Loader />
            </View>
          ) : (
            <>
              <MonthlyPanel data={data} />
              <PurchasePanel data={data} />
              <Disclaimer data={data} />
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  chevron: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  backLabel: { color: colors.textPrimary, fontSize: 13 },
  // Loading and errors stay inside the screen content (docs/design.md "Feedback").
  section: { minHeight: 240, gap: 16 },
  notFound: { gap: 8 },
  notFoundTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  header: { gap: 8 },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 14 },
})
