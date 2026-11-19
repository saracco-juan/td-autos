import { Ionicons } from '@expo/vector-icons'
import { useBuyerTabBarSpace } from '../../components/BuyerTabIndicator'
import Svg, { Circle, Path } from 'react-native-svg'
import { useFonts } from 'expo-font'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { NetworkError } from '../../lib/http'
import { archivo, archivoFonts } from '../../theme/archivo'
import { catalog } from './CatalogCard'
import ComparisonControls from './ComparisonControls'
import useReduceMotion from '../../lib/useReduceMotion'
import { colors, radii, shadows } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import { useComparisonSelection } from '../comparison/ComparisonSelection'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { appliedFilterChips, filterRecommendations, type RecommendationFilters } from '@shared/recommendations/filters'
import { emptyStateCopy, exchangeRateNotice, vehicleCount } from '@shared/recommendations/format'
import type { RecommendationsResponse } from '@shared/recommendations/matching'
import { fetchRecommendations } from './api'
import FiltersSheet from './FiltersSheet'
import RecommendationCard from './RecommendationCard'
import PortalModelsPanel from './PortalModelsPanel'
import PortalTabs from './PortalTabs'
import { portalCountLabel } from '@shared/portals/format'

type ScreenState = { status: 'loading' } | { status: 'error'; kind: LoadErrorKind } | { status: 'ready'; response: RecommendationsResponse }

// Vehicle recommendations (HU05-MOBILE, RF04, CU of the web MatchingRecommendationsPage): the backend ranking for the
// saved diagnosis, refined client-side by the HU07 filters.
export default function RecommendationsScreen() {
  const barSpace = useBuyerTabBarSpace()
  useFonts(archivoFonts)
  const router = useRouter()
  const { authFetch } = useAuth()
  const reduceMotion = useReduceMotion()
  const { notice: selectionNotice } = useComparisonSelection()
  const [view, setView] = useState<ScreenState>({ status: 'loading' })
  const [filters, setFilters] = useState<RecommendationFilters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [portals, setPortals] = useState(false)
  const [modelCount, setModelCount] = useState<number | null>(null)
  // Only the latest request may update the screen.
  const request = useRef(0)

  const load = useCallback(() => {
    const id = ++request.current
    fetchRecommendations(authFetch)
      .then((response) => {
        if (id !== request.current) return
        setView({ status: 'ready', response })
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
  const response = view.status === 'ready' ? view.response : null
  const isReady = response?.status === 'ready'
  const all = response?.results ?? []
  const results = filterRecommendations(all, filters)
  const chips = appliedFilterChips(filters)
  const notice = exchangeRateNotice(response?.exchange_rate)
  const empty = response && results.length === 0 ? emptyStateCopy(response.status, chips.length > 0) : null
  const filteredEmpty = isReady && chips.length > 0

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: barSpace + 12 }]}
        data={portals ? [] : results}
        numColumns={2}
        columnWrapperStyle={styles.catalogRow}
        keyExtractor={result => String(result.listing_id)}
        renderItem={({ item }) => (
          <View style={catalog.cell}>
            <RecommendationCard result={item} best={item.listing_id === all[0]?.listing_id} motionEnabled={!reduceMotion} />
          </View>
        )}
        ListHeaderComponent={<View style={styles.listHeader}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, archivo(true)]}>AUTOS RECOMENDADOS</Text>
          <Text accessibilityRole="header" style={[styles.title, archivo(true)]}>
            Mejores opciones para vos
          </Text>
          <View style={styles.headerActions}>
            {portals ? (modelCount !== null ? <Text style={styles.subtitle}>{portalCountLabel(modelCount)}</Text> : null)
              : isReady ? <Text style={styles.subtitle}>{vehicleCount(results.length)}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Ajustar diagnóstico" onPress={goToDiagnosis}
              style={({ pressed }) => [styles.edit, pressed && styles.editPressed]}>
              <Ionicons name="pencil-outline" size={15} color={colors.textPrimary} />
              <Text style={[styles.editLabel, archivo(true)]}>Ajustar diagnóstico</Text>
            </Pressable>
          </View>
        </View>
        {!portals && isReady ? <ComparisonControls results={all} reduceMotion={reduceMotion} /> : null}
        <View style={styles.filters}>
          <View style={styles.filterRow}>
            <View style={styles.scroll}><PortalTabs portals={portals} count={modelCount} onChange={setPortals} /></View>
            {!portals && isReady && all.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Filtros" onPress={() => setFiltersOpen(true)} style={styles.filterButton}>
                <Svg aria-hidden width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={1.5}>
                  <Path d="M4 7h6m4 0h6M4 17h10m4 0h2" />
                  <Circle cx={12} cy={7} r={2} /><Circle cx={16} cy={17} r={2} />
                </Svg>
                <Text style={[styles.filterLabel, archivo(true)]}>Filtros</Text>
              </Pressable>
            )}
          </View>
          {!portals && isReady && chips.length > 0 ? (
            <View style={styles.chips}>
              {chips.map(({ key, label }) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${label}`}
                  onPress={() => setFilters({ ...filters, [key]: undefined })}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{label}</Text>
                  <Ionicons name="close" size={14} color={colors.textSecondary} />
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel="LIMPIAR FILTROS" onPress={() => setFilters({})} style={styles.chip}>
                <Text style={styles.chipText}>LIMPIAR FILTROS</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        {portals ? <PortalModelsPanel onCount={setModelCount} onDiagnosis={goToDiagnosis} /> : <>
        {selectionNotice ? <Alert variant="warning">{selectionNotice}</Alert> : null}

        {isReady && notice.warning ? <Alert variant="warning">{notice.warning}</Alert> : null}

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
            {filteredEmpty ? <Button label="LIMPIAR FILTROS" onPress={() => setFilters({})} /> : null}
            {response?.status === 'diagnosis_incomplete' ? (
              <Button label="IR AL DIAGNÓSTICO" variant="primary" onPress={goToDiagnosis} />
            ) : null}
          </View>
        ) : null}

        </>}
        </View>}
        ListFooterComponent={!portals && isReady && notice.summary ? <Text style={styles.subtitle}>{notice.summary}</Text> : undefined}
      />

      {!portals && filtersOpen ? (
        <FiltersSheet
          maximumPrice={all.reduce((max, item) => Number.isFinite(item.price_ars) ? Math.max(max, Math.ceil(item.price_ars)) : max, filters.maxPrice ?? 0)}
          applied={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setFilters(next)
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
  content: { padding: 12, gap: 12 },
  header: { gap: 8 },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  filters: { gap: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
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
  filterButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  filterLabel: { fontSize: 14, color: colors.textPrimary },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
  edit: { marginLeft: 'auto', maxWidth: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  editLabel: { flexShrink: 1, fontSize: 13, color: colors.textPrimary },
  editPressed: { opacity: 0.65 },
  listHeader: { gap: 12 },
  catalogRow: { marginHorizontal: -4 },
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
})
