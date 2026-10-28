import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import Pagination from '../../components/Pagination'
import { NetworkError } from '../../lib/http'
import { colors, radii, shadows } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { appliedFilterChips, filterRecommendations, type RecommendationFilters } from '@shared/recommendations/filters'
import { emptyStateCopy, exchangeRateNotice, vehicleCount } from '@shared/recommendations/format'
import { RECOMMENDATIONS_PER_PAGE, type RecommendationsResponse } from '@shared/recommendations/matching'
import { fetchRecommendations } from './api'
import FiltersSheet from './FiltersSheet'
import RecommendationCard from './RecommendationCard'

type ScreenState = { status: 'loading' } | { status: 'error'; kind: LoadErrorKind } | { status: 'ready'; response: RecommendationsResponse }

// Vehicle recommendations (HU05-MOBILE, RF04, CU of the web MatchingRecommendationsPage): the backend ranking for the
// saved diagnosis, refined client-side by the HU07 filters and paged nine at a time.
export default function RecommendationsScreen() {
  const router = useRouter()
  const { authFetch } = useAuth()
  const [view, setView] = useState<ScreenState>({ status: 'loading' })
  const [filters, setFilters] = useState<RecommendationFilters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  // Only the latest request may update the screen.
  const request = useRef(0)

  const load = useCallback(() => {
    const id = ++request.current
    fetchRecommendations(authFetch)
      .then((response) => {
        if (id !== request.current) return
        setView({ status: 'ready', response })
        setPage(1)
      })
      .catch((error: unknown) => {
        if (id === request.current) setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
      })
  }, [authFetch])

  // The tab stays mounted: every visit asks again, so a changed diagnosis brings a new ranking (TC-17). The current
  // list stays visible meanwhile; leaving the tab drops an answer still in flight.
  useFocusEffect(
    useCallback(() => {
      load()
      return () => {
        request.current += 1
      }
    }, [load]),
  )

  const goToDiagnosis = () => router.navigate('/')
  const changeFilters = (next: RecommendationFilters) => {
    setFilters(next)
    setPage(1)
  }

  const response = view.status === 'ready' ? view.response : null
  const isReady = response?.status === 'ready'
  const all = response?.results ?? []
  const results = filterRecommendations(all, filters)
  const chips = appliedFilterChips(filters)
  const lastPage = Math.ceil(results.length / RECOMMENDATIONS_PER_PAGE)
  const notice = exchangeRateNotice(response?.exchange_rate)
  const empty = response && results.length === 0 ? emptyStateCopy(response.status, chips.length > 0) : null
  const filteredEmpty = isReady && chips.length > 0

  return (
    <View style={styles.screen}>
      {/* Keyed by page so every page starts scrolled to the top. */}
      <ScrollView key={page} style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AUTOS RECOMENDADOS</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Mejores opciones para vos
          </Text>
          {isReady ? <Text style={styles.subtitle}>{vehicleCount(results.length)}</Text> : null}
        </View>
        <Button label="AJUSTAR DIAGNÓSTICO" onPress={goToDiagnosis} />

        {isReady && all.length > 0 ? (
          <View style={styles.filterRow}>
            <View style={styles.chips}>
              {chips.length === 0 ? <Text style={styles.subtitle}>Sin filtros aplicados</Text> : null}
              {chips.map(({ key, label }) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${label}`}
                  onPress={() => changeFilters({ ...filters, [key]: undefined })}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{label}</Text>
                  <Ionicons name="close" size={14} color={colors.textSecondary} />
                </Pressable>
              ))}
              {chips.length > 0 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="LIMPIAR FILTROS" onPress={() => changeFilters({})} style={styles.chip}>
                  <Text style={styles.chipText}>LIMPIAR FILTROS</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Filtros" onPress={() => setFiltersOpen(true)} style={styles.filterButton}>
              <Ionicons name="options-outline" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
        ) : null}

        {isReady && (notice.summary || notice.warning) ? (
          <View style={styles.notice}>
            {notice.summary ? <Text style={styles.subtitle}>{notice.summary}</Text> : null}
            {notice.warning ? <Alert variant="warning">{notice.warning}</Alert> : null}
          </View>
        ) : null}

        {view.status === 'loading' ? (
          <View style={styles.section}>
            <Loader />
          </View>
        ) : null}
        {view.status === 'error' ? (
          <View style={styles.section}>
            <LoadError kind={view.kind} />
            <Button
              label="REINTENTAR"
              variant="primary"
              onPress={() => {
                setView({ status: 'loading' })
                load()
              }}
            />
          </View>
        ) : null}

        {empty ? (
          <View style={styles.empty}>
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              {empty.title}
            </Text>
            <Text style={styles.subtitle}>{empty.hint}</Text>
            {filteredEmpty ? <Button label="LIMPIAR FILTROS" onPress={() => changeFilters({})} /> : null}
            {response?.status === 'diagnosis_incomplete' ? (
              <Button label="IR AL DIAGNÓSTICO" variant="primary" onPress={goToDiagnosis} />
            ) : null}
          </View>
        ) : null}

        {results.slice((page - 1) * RECOMMENDATIONS_PER_PAGE, page * RECOMMENDATIONS_PER_PAGE).map((result) => (
          <RecommendationCard key={result.listing_id} result={result} best={result.listing_id === all[0]?.listing_id} />
        ))}
      </ScrollView>

      {lastPage > 1 ? (
        <View style={styles.pager}>
          <Pagination page={page} lastPage={lastPage} onChange={setPage} />
        </View>
      ) : null}

      {filtersOpen ? (
        <FiltersSheet
          applied={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            changeFilters(next)
            setFiltersOpen(false)
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  header: { gap: 8 },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 999,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  // Figma square icon button beside the (removed) search field.
  filterButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  notice: { gap: 8 },
  // Loading and errors stay inside the list area (docs/design.md "Feedback").
  section: { minHeight: 240, gap: 16 },
  empty: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  pager: { paddingHorizontal: 16, paddingVertical: 12 },
})
