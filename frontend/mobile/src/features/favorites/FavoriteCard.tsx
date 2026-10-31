import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

import type { FavoriteVehicle } from '@shared/favorites/types'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { compatibilityLabel, formatKilometers, formatPrice } from '@shared/recommendations/format'
import type { Recommendation } from '@shared/recommendations/matching'
import Button from '../../components/Button'
import { colors, radii, shadows } from '../../theme/tokens'

export default function FavoriteCard({ vehicle, match, best, pending, onRemove }: Readonly<{
  vehicle: FavoriteVehicle; match?: Recommendation; best: boolean; pending: boolean; onRemove: () => void
}>) {
  const router = useRouter()
  const title = vehicleTitle(vehicle)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const fuels = { nafta: 'Nafta', diesel: 'Diésel', gnc: 'GNC', hibrido: 'Híbrido', electrico: 'Eléctrico' }
  const details = [vehicle.transmision && (vehicle.transmision === 'automatica' ? 'Automática' : 'Manual'),
    vehicle.combustible && fuels[vehicle.combustible], vehicle.kilometraje === null
      ? 'Kilometraje no disponible' : formatKilometers(vehicle.kilometraje)]

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <View>
        <Text style={styles.meta}>{vehicle.precio === null || vehicle.moneda === null
          ? 'Precio no disponible' : formatPrice(vehicle.precio, vehicle.moneda)}</Text>
        <Text style={styles.meta}>{match ? compatibilityLabel(match) : 'Compatibilidad no disponible'}</Text>
      </View>
      <View style={styles.image}>
        {vehicle.image_url && failedImage !== vehicle.image_url
          ? <Image source={{ uri: vehicle.image_url }} accessibilityLabel={`Foto de ${title}`}
              onError={() => setFailedImage(vehicle.image_url)} style={StyleSheet.absoluteFill} />
          : <Text style={styles.meta}>Imagen no disponible</Text>}
        {best ? <Text style={styles.badge}>MEJOR COINCIDENCIA</Text> : null}
      </View>
      <Text style={styles.meta}>{details.filter(Boolean).join(' · ')}</Text>
      <View style={styles.actions}>
        <Button label="QUITAR" disabled={pending} onPress={onRemove} />
        <Button label="VER FICHA" onPress={() => router.push(`/vehiculos/${vehicle.id}?from=favoritos`)} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 8, borderRadius: radii.card, borderWidth: 1,
    borderColor: colors.borderDefault, backgroundColor: colors.surface, ...shadows.card },
  title: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  image: { aspectRatio: 16 / 10, backgroundColor: colors.surfaceRaised, borderWidth: 1,
    borderColor: colors.borderDefault, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  badge: { position: 'absolute', left: 12, top: 0, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#ffea00', fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
})
