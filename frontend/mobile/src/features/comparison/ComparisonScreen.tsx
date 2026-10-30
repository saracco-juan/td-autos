import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { canCompare } from '@shared/comparison/selection'
import type { ComparisonEntry } from '@shared/comparison/groups'
import BackChip from '../../components/BackChip'
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
import { useComparisonSelection } from './ComparisonSelection'

type ViewState = { status: 'loading' } | { status: 'unavailable' } | { status: 'error'; kind: LoadErrorKind }
  | { status: 'ready'; entries: [ComparisonEntry, ComparisonEntry] }

export default function ComparisonScreen() {
  const { ids, toggle } = useComparisonSelection()
  const [attempt, setAttempt] = useState(0)
  const router = useRouter()
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <BackChip label="Volver a recomendados" onPress={() => router.navigate('/recomendados')} />
    <Text style={styles.eyebrow}>COMPARAR UNIDADES</Text>
    <Text accessibilityRole="header" style={styles.title}>Comparar vehículos</Text>
    <Text style={styles.muted}>{ids.length} {ids.length === 1 ? 'vehículo seleccionado' : 'vehículos seleccionados'}</Text>
    {canCompare(ids) ? <ReadyComparison key={`${ids.join(',')}:${attempt}`} ids={ids as [number, number]} onRemove={toggle}
      onRetry={() => setAttempt((value) => value + 1)} /> : (
      <View accessibilityLiveRegion="polite">
        <Text style={styles.muted}>Seleccioná exactamente dos vehículos recomendados para completar la comparación.</Text>
        {ids.map((id) => <Text key={id} style={styles.muted}>Conservás el vehículo {id}.</Text>)}
      </View>
    )}
  </ScrollView>
}

function ReadyComparison({ ids: [first, second], onRemove, onRetry }: {
  ids: [number, number]; onRemove: (id: number) => void; onRetry: () => void
}) {
  const { authFetch } = useAuth()
  const router = useRouter()
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

  if (view.status === 'loading') return <Loader />
  if (view.status === 'unavailable') return <Text style={styles.muted}>
    Algún vehículo ya no está disponible entre tus recomendaciones. Volvé y corregí la selección.
  </Text>
  if (view.status === 'error') return <View style={styles.content}>
    <LoadError kind={view.kind} />
    <Button label="REINTENTAR" onPress={onRetry} />
  </View>
  return <ComparisonCards entries={view.entries} onRemove={onRemove} onCosts={(id) => router.push(`/vehiculos/${id}/costos`)} />
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 14 },
})
