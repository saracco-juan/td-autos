import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import BackChip from '../../components/BackChip'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { HttpError, NetworkError } from '../../lib/http'
import { colors, radii, shadows } from '../../theme/tokens'
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
import VehicleSpecifications from './VehicleSpecifications'

type DetailState = { status: 'loading' | 'unavailable' } | { status: 'error'; kind: LoadErrorKind } | { status: 'ready'; response: VehicleDetailResponse }

const BACK_LABEL = 'Volver a recomendados'
// Facts of the one-line summary under the title, in reading order.
const SUBTITLE_LABELS = ['Transmisión', 'Combustible', 'Kilometraje', 'Ubicación']

// Vehicle sheet (HU09-MOBILE, RF08), Figma "Ficha técnica" 2373:9996. Same content as the web detail.
export default function VehicleDetailScreen({ rawId, fromFavorites = false }: Readonly<{
  rawId: string | undefined; fromFavorites?: boolean
}>) {
  // The key restarts the whole screen when the route points to another vehicle.
  return <Detail key={rawId} id={parseVehicleId(rawId)} fromFavorites={fromFavorites} />
}

// "Automática · Nafta · 62.000 km · CABA": unreported facts are left out of the line (they show in the sections).
function subtitle(vehicle: VehicleDetailResponse['vehicle']): string {
  const rows = specificationGroups(vehicle)[0].rows
  return SUBTITLE_LABELS.map((label) => rows.find((row) => row.label === label)?.value)
    .filter((value): value is string => value !== undefined && value !== UNKNOWN_FACT)
    .join(' · ')
}

function Detail({ id, fromFavorites }: Readonly<{ id: number | null; fromFavorites: boolean }>) {
  const { authFetch } = useAuth()
  const { ids, toggle, notice } = useComparisonSelection()
  const router = useRouter()
  const [view, setView] = useState<DetailState>({ status: id === null ? 'unavailable' : 'loading' })
  const [attempt, setAttempt] = useState(0)

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
  // Hidden tabs need an explicit return destination instead of the navigator's first tab.
  const goBack = () => router.navigate(fromFavorites ? '/favoritos' : '/recomendados')
  const data = view.status === 'ready' ? view.response : null
  const title = data ? vehicleTitle(data.vehicle) : ''

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BackChip label={fromFavorites ? 'Volver a favoritos' : BACK_LABEL} onPress={goBack} />

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
        <>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>FICHA TÉCNICA</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.muted}>{subtitle(data.vehicle)}</Text>
          </View>
          <VehicleGallery photos={data.vehicle.fotos} title={title} />
          <View style={styles.summary}>
            <View style={styles.summaryHeading}>
              <Text style={styles.price}>
                {data.vehicle.precio === null || data.vehicle.moneda === null
                  ? 'Precio no disponible.'
                  : formatPrice(data.vehicle.precio, data.vehicle.moneda)}
              </Text>
              <FavoriteButton vehicleId={data.vehicle.id} vehicleName={title} isFavorite={data.is_favorite} />
            </View>
            <Text style={styles.muted}>Concesionaria verificada · {data.dealer.nombre}</Text>
            <Button label="CHECKLIST DE INSPECCIÓN" onPress={() => router.push(`/vehiculos/${data.vehicle.id}/inspeccion`)} />
            <Button label="CALCULAR COSTOS" onPress={() => router.push(`/vehiculos/${data.vehicle.id}/costos`)} />
            <Button label="VER DEPRECIACIÓN" onPress={() => router.push(`/vehiculos/${data.vehicle.id}/depreciacion`)} />
            <Button label="COMPARAR" onPress={() => {
              if (!ids.includes(data.vehicle.id) && ids.length === 2) {
                toggle(data.vehicle.id)
                return
              }
              if (!ids.includes(data.vehicle.id)) toggle(data.vehicle.id)
              router.push('/comparar')
            }} />
            {notice ? <Alert variant="warning">{notice}</Alert> : null}
          </View>
          <VehicleSpecifications vehicle={data.vehicle} />
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  // Loading and errors stay inside the screen content (docs/design.md "Feedback").
  section: { minHeight: 240, gap: 16 },
  unavailable: { gap: 8 },
  unavailableTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  header: { gap: 8 },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 14 },
  summary: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  summaryHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  price: { flex: 1, color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
})
