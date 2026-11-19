import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { canCompare } from '@shared/comparison/selection'
import type { ComparisonEntry } from '@shared/comparison/groups'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { HttpError, NetworkError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import { fetchCosts } from '../costs/api'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { fetchRecommendations } from '../recommendations/api'
import { fetchVehicleDetail } from '../vehicle-detail/api'
import ComparisonCards from './ComparisonCards'
import ComparisonLayout from './ComparisonLayout'
import { useComparisonSelection } from './ComparisonSelection'

type ViewState = { status: 'loading' } | { status: 'unavailable' } | { status: 'error'; kind: LoadErrorKind }
  | { status: 'ready'; entries: [ComparisonEntry, ComparisonEntry] }

export default function ComparisonScreen() {
  const { ids } = useComparisonSelection()
  const [attempt, setAttempt] = useState(0)
  if (canCompare(ids)) return <ReadyComparison key={`${ids.join(',')}:${attempt}`} ids={ids as [number, number]}
    onRetry={() => setAttempt((value) => value + 1)} />
  return <ComparisonLayout>
    <View accessibilityLiveRegion="polite" style={styles.content}>
      <Text style={styles.muted}>{ids.length} {ids.length === 1 ? 'vehículo seleccionado' : 'vehículos seleccionados'}</Text>
      {ids.length === 1 && <Text style={styles.muted}>Conservás el vehículo {ids[0]}.</Text>}
      <Text style={styles.muted}>Seleccioná exactamente dos vehículos recomendados para completar la comparación.</Text>
    </View>
  </ComparisonLayout>
}

function ReadyComparison({ ids: [first, second], onRetry }: Readonly<{
  ids: [number, number]; onRetry: () => void
}>) {
  const { authFetch } = useAuth()
  const router = useRouter()
  const { toggle } = useComparisonSelection()
  const [view, setView] = useState<ViewState>({ status: 'loading' })
  useFocusEffect(useCallback(() => {
    let active = true
    setView({ status: 'loading' })
    async function load() {
      const recommendations = await fetchRecommendations(authFetch)
      const selected = [first, second].map((id) => recommendations.results.find((result) => result.listing_id === id))
      if (recommendations.status !== 'ready' || selected.some((result) => !result)) {
        if (active) setView({ status: 'unavailable' })
        return
      }
      const entries = await Promise.all([first, second].map(async (id, index) => {
        const [detail, costs] = await Promise.all([fetchVehicleDetail(authFetch, id), fetchCosts(authFetch, id)])
        return { id, detail, costs, recommendation: selected[index]! }
      }))
      if (active) setView({ status: 'ready', entries: [entries[0], entries[1]] })
    }
    load().catch((error: unknown) => {
      if (!active) return
      setView(error instanceof HttpError && error.status === 404 ? { status: 'unavailable' }
        : { status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
    })
    return () => { active = false }
  }, [authFetch, first, second]))

  if (view.status === 'loading') return <ComparisonLayout><Loader /></ComparisonLayout>
  if (view.status === 'unavailable') return <ComparisonLayout><Text style={styles.muted}>
    Algún vehículo ya no está disponible entre tus recomendaciones. Volvé y corregí la selección.
  </Text></ComparisonLayout>
  if (view.status === 'error') return <ComparisonLayout><View style={styles.content}>
    <LoadError kind={view.kind} />
    <Button label="REINTENTAR" onPress={onRetry} />
  </View></ComparisonLayout>
  return <ComparisonCards entries={view.entries} onChangeVehicle={(id) => {
    toggle(id)
    router.navigate('/recomendados')
  }}
    onCosts={(id) => router.push(`/vehiculos/${id}/costos`)} />
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  muted: { color: colors.textSecondary, fontSize: 14 },
})
