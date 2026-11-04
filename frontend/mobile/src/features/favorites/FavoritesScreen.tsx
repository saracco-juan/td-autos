import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { createFavoritesApi } from '@shared/favorites/api'
import type { FavoriteVehicle, FavoritesResponse } from '@shared/favorites/types'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import type { Recommendation } from '@shared/recommendations/matching'
import Button from '../../components/Button'
import Alert from '../../components/Alert'
import Loader from '../../components/Loader'
import { NetworkError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { fetchRecommendations } from '../recommendations/api'
import FavoriteCard from './FavoriteCard'
import { useFavoriteState } from './FavoriteButton'
import FavoritesPager from './FavoritesPager'

type ViewState = { status: 'loading' } | { status: 'error'; kind: LoadErrorKind }
  | { status: 'ready' }

// Figma 2373:10676 / 2373:10698: only the list scrolls between the heading and action.
export default function FavoritesScreen() {
  const router = useRouter()
  const { authFetch } = useAuth()
  const favorites = useFavoriteState()
  const { states, toggle } = favorites
  const [view, setView] = useState<ViewState>({ status: 'loading' })
  const [data, setData] = useState<FavoritesResponse | null>(null)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(6)
  const [removed, setRemoved] = useState<FavoriteVehicle | null>(null)
  const [actionError, setActionError] = useState(false)
  const [matches, setMatches] = useState<Recommendation[]>([])
  const request = useRef(0)
  const load = useCallback(() => {
    const id = ++request.current
    setView({ status: 'loading' })
    createFavoritesApi(authFetch).listFavorites({ page, perPage: size }).then((response) => {
      if (id !== request.current) return
      const last = Math.max(1, response.meta.last_page)
      if (page > last) { setPage(last); return }
      setData(response)
      setView({ status: 'ready' })
      setMatches([])
      if (response.data.length === 0) return
      // Matching is optional: a slow or unavailable ranking never hides saved vehicles.
      fetchRecommendations(authFetch).then((ranking) => {
        if (id === request.current) setMatches(ranking.status === 'ready' ? ranking.results : [])
      }).catch(() => { if (id === request.current) setMatches([]) })
    }).catch((error: unknown) => {
      if (id === request.current) setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
    })
  }, [authFetch, page, size])
  useFocusEffect(useCallback(() => {
    if (Object.values(favorites.states).some((state) => state.pending)) setView({ status: 'loading' })
    else load()
    return () => { request.current += 1 }
  }, [load, favorites]))

  const runAction = async (vehicle: FavoriteVehicle, saved: boolean) => {
    setActionError(false)
    const success = await toggle(vehicle.id, !saved)
    if (success === true) setRemoved(saved ? null : vehicle)
    if (success === false) setActionError(true)
  }
  const response = view.status === 'ready' ? data : null
  const total = data?.meta.total
  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>FAVORITOS</Text>
        <Text accessibilityRole="header" style={styles.title}>Vehículos guardados</Text>
        {total !== undefined ? <Text style={styles.subtitle}>{total === 0 ? 'Sin vehículos guardados'
          : `${total} ${total === 1 ? 'vehículo guardado' : 'vehículos guardados'}`}</Text> : null}
      </View>
      {actionError ? <Alert variant="error">No pudimos actualizar tus favoritos. Intentá nuevamente.</Alert> : null}
      {removed ? <View style={styles.notice}>
        <Text accessibilityLiveRegion="polite" style={styles.subtitle}>Quitaste {vehicleTitle(removed)} de tus favoritos.</Text>
        <Button label="DESHACER" disabled={states[removed.id]?.pending} onPress={() => { void runAction(removed, true) }} />
      </View> : null}
      <ScrollView key={`${page}-${size}`} style={styles.list} contentContainerStyle={styles.content}>
        {view.status === 'loading' ? <Loader /> : null}
        {view.status === 'error' ? <>
          <LoadError kind={view.kind} />
          <Button label="REINTENTAR" onPress={() => { setView({ status: 'loading' }); load() }} />
        </> : null}
        {view.status === 'ready' && total === 0 ? <View style={styles.empty}>
          <Text accessibilityRole="header" style={styles.emptyTitle}>Todavía no guardaste vehículos</Text>
          <Text style={styles.subtitle}>Guardá los que te interesen desde Recomendaciones y encontralos acá.</Text>
        </View> : null}
        {response?.data.map((vehicle) => <FavoriteCard key={vehicle.id} vehicle={vehicle}
          pending={states[vehicle.id]?.pending ?? false} onRemove={() => { void runAction(vehicle, false) }}
          match={matches.find((match) => match.listing_id === vehicle.id)} best={matches[0]?.listing_id === vehicle.id} />)}
      </ScrollView>
      <View style={styles.footer}>
        {total !== undefined && total > 6 ? <FavoritesPager page={page} lastPage={Math.max(1, data?.meta.last_page ?? 1)}
          size={size} onPage={setPage} onSize={(value) => {
            if (value === size) return
            setPage(1)
            setSize(value)
          }} /> : null}
        <Button label="VER RECOMENDADOS" onPress={() => router.navigate('/recomendados')} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 16, backgroundColor: colors.background },
  heading: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '600', color: colors.charcoal },
  title: { fontSize: 32, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  list: { flex: 1 },
  content: { flexGrow: 1, gap: 16, paddingBottom: 8 },
  empty: { gap: 12, paddingVertical: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  footer: { alignItems: 'flex-end', gap: 12 },
  notice: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: colors.surfaceRaised },
})
