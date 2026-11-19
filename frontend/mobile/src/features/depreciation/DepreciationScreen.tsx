import { useBuyerTabBarSpace } from '../../components/BuyerTabIndicator'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { parseVehicleId, vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { depreciationCopy } from '@shared/depreciation/presentation'
import type { DepreciationResponse } from '@shared/depreciation/types'
import BackLink from '../../components/BackLink'
import { archivo } from '../../theme/archivo'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { HttpError, NetworkError } from '../../lib/http'
import { colors, radii, shadows } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { fetchDepreciation } from './api'
import DepreciationResult from './DepreciationResult'

type State = { status: 'loading' | 'unavailable' }
  | { status: 'error'; kind: LoadErrorKind }
  | { status: 'ready'; data: DepreciationResponse }

// HU15-MOBILE/RF13, High v3 2373:10051; only the content scrolls inside the existing tab shell.
export default function DepreciationScreen({ rawId }: Readonly<{ rawId: string | undefined }>) {
  return <Depreciation key={rawId} id={parseVehicleId(rawId)} />
}

function Depreciation({ id }: Readonly<{ id: number | null }>) {
  const barSpace = useBuyerTabBarSpace()
  const { authFetch } = useAuth()
  const router = useRouter()
  const [view, setView] = useState<State>({ status: id === null ? 'unavailable' : 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (id === null) return
    let active = true
    fetchDepreciation(authFetch, id).then(data => {
      if (active) setView({ status: 'ready', data })
    }).catch((error: unknown) => {
      if (!active) return
      setView(error instanceof HttpError && error.status === 404 ? { status: 'unavailable' }
        : { status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
    })
    return () => { active = false }
  }, [authFetch, id, attempt])

  const retry = () => {
    setView({ status: 'loading' })
    setAttempt(value => value + 1)
  }
  const data = view.status === 'ready' ? view.data : null

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: barSpace + 24 }]}>
      <Text accessibilityRole="header" style={[styles.title, archivo(true)]}>Depreciación</Text>
      {data ? <Text style={[styles.subtitle, archivo()]}>{vehicleTitle(data.vehicle)}</Text> : null}
      <BackLink label={id === null ? 'Volver a recomendados' : 'Volver a la ficha'}
        onPress={() => router.navigate(id === null ? '/recomendados' : `/vehiculos/${id}`)} />
      {view.status === 'loading' ? <View style={styles.section}><Loader /></View> : null}
      {view.status === 'error' ? <View style={styles.section}>
        <LoadError kind={view.kind} />
        <Button label="REINTENTAR" variant="primary" onPress={retry} />
      </View> : null}
      {view.status === 'unavailable' ? <Text accessibilityRole="header" style={styles.unavailable}>
        Esta publicación ya no está disponible.
      </Text> : null}
      {data ? <>
        {data.projection && data.reference ? <DepreciationResult projection={data.projection}
          reference={data.reference} kilometers={data.vehicle.kilometraje} />
          : <View style={styles.empty}>
            <Text accessibilityRole="header" style={styles.emptyTitle}>{depreciationCopy.insufficient}</Text>
            <Text style={styles.note}>{depreciationCopy.insufficientHint}</Text>
          </View>}
      </> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 24, gap: 12 },
  section: { minHeight: 240, gap: 16 },
  title: { color: colors.textPrimary, fontSize: 32 },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  unavailable: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  empty: { gap: 12, padding: 16, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.card },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
})
