import { useFonts } from 'expo-font'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, type ScrollViewInstance, useAnimatedValue, StyleSheet, Text, View } from 'react-native'

import BackLink from '../../components/BackLink'
import { useBuyerTabBarSpace } from '../../components/BuyerTabIndicator'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { HttpError, NetworkError } from '../../lib/http'
import useReduceMotion from '../../lib/useReduceMotion'
import { archivo, archivoFonts } from '../../theme/archivo'
import { colors } from '../../theme/tokens'
import { parseVehicleId, vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { formatPrice } from '@shared/recommendations/format'
import { UNKNOWN_FACT, specificationGroups } from '@shared/vehicles/detail'
import { useAuth } from '../auth/useAuth'
import { useComparisonSelection } from '../comparison/ComparisonSelection'
import FavoriteButton from '../favorites/FavoriteButton'
import Alert from '../../components/Alert'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { fetchVehicleDetail } from './api'
import type { VehicleDetailResponse } from './types'
import VehicleGallery from './VehicleGallery'
import VehicleContact from './VehicleContact'
import VehicleSpecifications from './VehicleSpecifications'

type DetailState = { status: 'loading' | 'unavailable' } | { status: 'error'; kind: LoadErrorKind } | { status: 'ready'; response: VehicleDetailResponse }

const BACK_LABEL = 'Volver a recomendados'
const PANEL_OVERLAP = 20
// Facts of the one-line summary under the title, in reading order.
const SUBTITLE_LABELS = ['Transmisión', 'Combustible', 'Kilometraje', 'Ubicación']

// Vehicle sheet (HU09-MOBILE, RF08), Figma "Ficha técnica" 2373:9996. Same content as the web detail.
export default function VehicleDetailScreen({ rawId, fromFavorites = false }: Readonly<{
  rawId: string | undefined; fromFavorites?: boolean
}>) {
  const router = useRouter()
  // Hidden tabs need an explicit return destination instead of the navigator's first tab.
  const goBack = () => router.navigate(fromFavorites ? '/favoritos' : '/recomendados')
  return <>
    <BackLink style={styles.back} label={fromFavorites ? 'Volver a favoritos' : BACK_LABEL} onPress={goBack} />
    <Detail key={rawId} id={parseVehicleId(rawId)} fromFavorites={fromFavorites} />
  </>
}

// "Automática · Nafta · 62.000 km · CABA": unreported facts are left out of the line (they show in the sections).
function subtitle(vehicle: VehicleDetailResponse['vehicle']): string {
  const rows = specificationGroups(vehicle)[0].rows
  return SUBTITLE_LABELS.map((label) => rows.find((row) => row.label === label)?.value)
    .filter((value): value is string => value !== undefined && value !== UNKNOWN_FACT)
    .join(' · ')
}

function Detail({ id, fromFavorites }: Readonly<{ id: number | null; fromFavorites: boolean }>) {
  useFonts(archivoFonts)
  const { authFetch } = useAuth()
  const { ids, toggle, notice } = useComparisonSelection()
  const router = useRouter()
  const [view, setView] = useState<DetailState>({ status: id === null ? 'unavailable' : 'loading' })
  const [attempt, setAttempt] = useState(0)
  const reduceMotion = useReduceMotion()
  const barSpace = useBuyerTabBarSpace()
  const scroll = useRef<ScrollViewInstance>(null)
  const scrollY = useAnimatedValue(0)
  const [panelTop, setPanelTop] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [viewport, setViewport] = useState(0)

  useEffect(() => {
    if (id === null) return
    let active = true
    fetchVehicleDetail(authFetch, id)
      .then((response) => {
        if (active) setView({ status: 'ready', response })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof HttpError && error.status === 404) setView({ status: 'unavailable' })
        else setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
      })
    return () => {
      active = false
    }
  }, [authFetch, id, attempt])

  const retry = useCallback(() => {
    setView({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])
  const data = view.status === 'ready' ? view.response : null
  const title = data ? vehicleTitle(data.vehicle) : ''

  const compare = () => {
    if (!data) return
    const selected = ids.includes(data.vehicle.id)
    if (!selected) toggle(data.vehicle.id)
    if (selected || ids.length < 2) router.push('/comparar')
  }

  return (
    <Animated.ScrollView ref={scroll} testID="detail-scroll" style={styles.scroll} contentContainerStyle={styles.content}
      onLayout={({ nativeEvent }) => setViewport(nativeEvent.layout.height)}
      snapToOffsets={panelTop > 0 ? [0, panelTop] : undefined} snapToEnd={false} directionalLockEnabled
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      onScrollEndDrag={({ nativeEvent }) => setExpanded(nativeEvent.contentOffset.y >= panelTop / 2)}
      onMomentumScrollEnd={({ nativeEvent }) => setExpanded(nativeEvent.contentOffset.y >= panelTop / 2)}>

      {view.status === 'loading' ? (
        <View style={styles.section}>
          <Loader />
        </View>
      ) : null}
      {view.status === 'unavailable' ? (
        <View accessibilityRole="alert" style={styles.unavailable}>
          <Text accessibilityRole="header" style={styles.unavailableTitle}>
            Esta publicación ya no está disponible.
          </Text>
          <Text style={styles.muted}>{fromFavorites ? 'Volvé a tus favoritos para elegir otro vehículo.'
            : 'Volvé a tus recomendaciones para elegir otro vehículo.'}</Text>
        </View>
      ) : null}
      {view.status === 'error' ? (
        <View style={styles.section}>
          <LoadError kind={view.kind} />
          <Button label="REINTENTAR" variant="primary" onPress={retry} />
        </View>
      ) : null}

      {data ? (
        <View>
          <Animated.View style={!reduceMotion && panelTop > 0 && { transform: [{
            translateY: scrollY.interpolate({ inputRange: [0, panelTop], outputRange: [0, panelTop], extrapolate: 'clamp' }),
          }] }}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[styles.title, archivo(true)]}>{title}</Text>
              <FavoriteButton vehicleId={data.vehicle.id} vehicleName={title} isFavorite={data.is_favorite} animate={!reduceMotion} />
            </View>
            <View style={styles.photoFrame}>
              <VehicleGallery photos={data.vehicle.fotos} title={title} />
            </View>
          </Animated.View>
          <View testID="detail-panel" style={[styles.panel, { minHeight: viewport, paddingBottom: barSpace + 16 }]}
            onLayout={({ nativeEvent }) => setPanelTop(nativeEvent.layout.y)}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
              accessibilityLabel={expanded ? 'Contraer ficha técnica' : 'Expandir ficha técnica'} style={styles.handle}
              onPress={() => {
                scroll.current?.scrollTo({ y: expanded ? 0 : panelTop, animated: !reduceMotion })
                setExpanded(!expanded)
              }}>
              <View style={styles.grip} />
            </Pressable>
            <Text style={[styles.price, archivo(true)]}>
              {data.vehicle.precio === null || data.vehicle.moneda === null
                ? 'Precio no disponible.' : formatPrice(data.vehicle.precio, data.vehicle.moneda)}
            </Text>
            <Text style={[styles.muted, archivo()]}>{subtitle(data.vehicle)}</Text>
            <Text style={[styles.muted, archivo()]}>Concesionaria verificada · {data.dealer.nombre}</Text>
            <View style={styles.actions}>
              <View style={styles.contact}>
                <VehicleContact key={data.vehicle.id} vehicleId={data.vehicle.id} available={data.whatsapp_available === true} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="COMPARAR"
                style={({ pressed }) => [styles.compare, pressed && styles.pressed]} onPress={compare}>
                <Text style={[styles.compareLabel, archivo(true)]}>Comparar</Text>
              </Pressable>
            </View>
            {notice ? <Alert variant="warning">{notice}</Alert> : null}
            <Button label="CHECKLIST DE INSPECCIÓN" onPress={() => router.push(`/vehiculos/${data.vehicle.id}/inspeccion`)} />
            <Button label="CALCULAR COSTOS" onPress={() => router.push(`/vehiculos/${data.vehicle.id}/costos`)} />
            <Button label="VER DEPRECIACIÓN" onPress={() => router.push(`/vehiculos/${data.vehicle.id}/depreciacion`)} />
            <VehicleSpecifications vehicle={data.vehicle} />
          </View>
        </View>
      ) : null}
    </Animated.ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  back: { marginHorizontal: 16 },
  content: { paddingHorizontal: 16, gap: 16 },
  // Loading and errors stay inside the screen content (docs/design.md "Feedback").
  section: { minHeight: 240, gap: 16 },
  unavailable: { gap: 8 },
  unavailableTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  photoFrame: { paddingBottom: PANEL_OVERLAP, backgroundColor: colors.charcoal, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header: { paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, color: colors.textPrimary, fontSize: 29, lineHeight: 34 },
  muted: { color: colors.textSecondary, fontSize: 14 },
  panel: { marginTop: -PANEL_OVERLAP, paddingHorizontal: 16, gap: 10, borderRadius: 24, backgroundColor: colors.surface },
  handle: { height: 44, alignItems: 'center', justifyContent: 'center' },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderInput },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  contact: { flexGrow: 1, flexBasis: 195 },
  compare: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  compareLabel: { color: colors.textPrimary, fontSize: 14 },
  pressed: { opacity: 0.65 },
  price: { color: colors.textPrimary, fontSize: 28 },
})
