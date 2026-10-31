import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { createFavoritesApi } from '@shared/favorites/api'
import type { FavoritesResponse } from '@shared/favorites/types'
import type { Recommendation } from '@shared/recommendations/matching'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { NetworkError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { fetchRecommendations } from '../recommendations/api'
import FavoriteCard from './FavoriteCard'
import { useFavoriteState } from './FavoriteButton'

type ViewState = { status: 'loading' } | { status: 'error'; kind: LoadErrorKind }
  | { status: 'ready'; response: FavoritesResponse }

// Figma 2373:10676 / 2373:10698: only the list scrolls between the heading and action.
export default function FavoritesScreen() {
  const router = useRouter()
  const { authFetch } = useAuth()
  const { states } = useFavoriteState()
  const pendingSave = Object.values(states).some((state) => state.pending)
  const [view, setView] = useState<ViewState>({ status: 'loading' })
  const [matches, setMatches] = useState<Recommendation[]>([])
  const request = useRef(0)
  const load = useCallback(() => {
    const id = ++request.current
    createFavoritesApi(authFetch).listFavorites({ page: 1, perPage: 6 }).then((response) => {
      if (id !== request.current) return
      setView({ status: 'ready', response })
      setMatches([])
      if (response.data.length === 0) return
      // Matching is optional: a slow or unavailable ranking never hides saved vehicles.
      fetchRecommendations(authFetch).then((ranking) => {
        if (id === request.current) setMatches(ranking.status === 'ready' ? ranking.results : [])
      }).catch(() => { if (id === request.current) setMatches([]) })
    }).catch((error: unknown) => {
      if (id === request.current) setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
    })
  }, [authFetch])
  useFocusEffect(useCallback(() => {
    if (pendingSave) setView({ status: 'loading' })
    else load()
    return () => { request.current += 1 }
  }, [load, pendingSave]))

  const response = view.status === 'ready' ? view.response : null
  const total = response?.meta.total
  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>FAVORITOS</Text>
        <Text accessibilityRole="header" style={styles.title}>Vehículos guardados</Text>
        {total !== undefined ? <Text style={styles.subtitle}>{total === 0 ? 'Sin vehículos guardados'
          : `${total} ${total === 1 ? 'vehículo guardado' : 'vehículos guardados'}`}</Text> : null}
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        {view.status === 'loading' ? <Loader /> : null}
        {view.status === 'error' ? <>
          <LoadError kind={view.kind} />
          <Button label="REINTENTAR" onPress={() => { setView({ status: 'loading' }); load() }} />
        </> : null}
        {total === 0 ? <View style={styles.empty}>
          <Text accessibilityRole="header" style={styles.emptyTitle}>Todavía no guardaste vehículos</Text>
          <Text style={styles.subtitle}>Guardá los que te interesen desde Recomendaciones y encontralos acá.</Text>
        </View> : null}
        {response?.data.map((vehicle) => <FavoriteCard key={vehicle.id} vehicle={vehicle}
          match={matches.find((match) => match.listing_id === vehicle.id)} best={matches[0]?.listing_id === vehicle.id} />)}
      </ScrollView>
      <View style={styles.footer}>
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
  content: { gap: 16, paddingBottom: 8 },
  empty: { gap: 12, paddingVertical: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  footer: { alignItems: 'flex-end' },
})
