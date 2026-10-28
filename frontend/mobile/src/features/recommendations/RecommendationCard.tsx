import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import { colors, radii, shadows } from '../../theme/tokens'
import {
  budgetPenaltyNote,
  compatibilityLabel,
  componentsSummary,
  equivalentPriceLabel,
  formatKilometers,
  formatPrice,
  recommendationTitle,
  warningMessages,
} from '@shared/recommendations/format'
import type { Recommendation } from '@shared/recommendations/matching'

type Props = { result: Recommendation; best: boolean }

// Figma "02 - Recomendaciones" (2373:9914) card with the web matching content. VER FICHA opens the vehicle sheet;
// COMPARAR is not rendered: the comparison screen does not exist on mobile yet.
export default function RecommendationCard({ result, best }: Readonly<Props>) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const { vehicle, dealer } = result
  const title = recommendationTitle(result)
  const meta = [formatPrice(result.published_price, result.published_currency), formatKilometers(vehicle.kilometraje), vehicle.ubicacion]

  return (
    <View accessibilityLabel={`Recomendación: ${title}`} style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.meta}>{meta.join(' · ')}</Text>
      </View>
      <View style={styles.image}>
        {vehicle.image_url ? (
          <Image source={{ uri: vehicle.image_url }} accessibilityLabel={`Foto de ${title}`} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={styles.meta}>Sin imagen</Text>
        )}
        {best ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MEJOR COINCIDENCIA</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.score}>{compatibilityLabel(result)}</Text>
      <Text style={styles.meta}>{equivalentPriceLabel(result)}</Text>
      <Text style={styles.meta}>{[dealer.nombre, dealer.provincia].filter(Boolean).join(' · ')}</Text>
      {warningMessages(result).map((message) => (
        <Alert key={message} variant="warning">
          {message}
        </Alert>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver atributos y motivos"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>{expanded ? 'Ocultar atributos y motivos' : 'Ver atributos y motivos'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          <Text style={styles.meta}>{componentsSummary(result)}</Text>
          <Text style={styles.meta}>{budgetPenaltyNote(result)}</Text>
        </View>
      ) : null}
      <Button label="VER FICHA" variant="primary" onPress={() => router.push(`/vehiculos/${result.listing_id}`)} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  heading: { gap: 4 },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: 13 },
  // 16:10 image area, as on web (docs/design.md "Lists and tables").
  image: {
    aspectRatio: 16 / 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.field,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ffe01b',
  },
  badgeText: { color: colors.textPrimary, fontSize: 10, fontWeight: '700' },
  score: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  toggle: { alignSelf: 'flex-start', paddingVertical: 4 },
  toggleText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  details: { gap: 6 },
})
