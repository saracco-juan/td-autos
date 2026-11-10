import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import { colors, radii, shadows } from '../../theme/tokens'
import {
  PORTAL_FILTERS_HEADING, PORTAL_KAVAK_NOTE, PORTAL_REASONS_HEADING, portalButtonLabel,
  portalInfoLabel, portalModelTitle, portalPriceRange, portalPriceYear, portalYearsLabel,
} from '@shared/portals/format'
import type { PortalModel } from '@shared/portals/models'
import PortalInfo from './PortalInfo'

// HU06 Figma 2521:11027. The backend owns URL/filter construction; the OS chooses app or browser.
export default function PortalModelCard({ model }: Readonly<{ model: PortalModel }>) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const [linkError, setLinkError] = useState(false)
  const title = portalModelTitle(model)
  const openPortal = async (url: string) => {
    setLinkError(false)
    try {
      await Linking.openURL(url)
    } catch {
      setLinkError(true)
    }
  }

  return (
    <View accessibilityLabel={`Modelo recomendado: ${title}`} style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <PortalInfo label={portalInfoLabel(model)}>
          <Text style={styles.title}>{PORTAL_REASONS_HEADING}</Text>
          {model.motivos.map((reason) => <Text key={reason} style={styles.meta}>{reason}</Text>)}
          <Text style={styles.title}>{PORTAL_FILTERS_HEADING}</Text>
          {model.filtros.map((filter) => <Text key={filter} style={styles.meta}>{filter}</Text>)}
          <Text style={styles.meta}>{PORTAL_KAVAK_NOTE}</Text>
        </PortalInfo>
      </View>
      <Text style={styles.meta}>{portalYearsLabel(model.anios)}</Text>
      <View style={styles.image}>
        {model.imagen_url && failedPhoto !== model.imagen_url ? (
          <Image source={{ uri: model.imagen_url }} accessibilityLabel={`Foto de ${title}`}
            style={StyleSheet.absoluteFill} onError={() => setFailedPhoto(model.imagen_url)} />
        ) : <Text style={styles.meta}>Sin fotos</Text>}
      </View>
      <Text style={styles.price}>{portalPriceRange(model.precio)}</Text>
      <Text style={styles.priceYear}>{portalPriceYear(model.precio)}</Text>
      {model.carroceria ? <Text style={styles.body}>{model.carroceria}</Text> : null}
      <View style={styles.actions}>
        {model.links.map((link) => (
          <View key={link.portal} style={styles.action}>
            <Button label={portalButtonLabel(link)} onPress={() => { void openPortal(link.url) }} />
          </View>
        ))}
      </View>
      {linkError ? <Alert variant="error">No pudimos abrir el portal. Intentá de nuevo.</Alert> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 16, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.card },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: 12 },
  image: { aspectRatio: 16 / 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  price: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  priceYear: { color: colors.textSecondary, fontSize: 11 },
  body: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: colors.surfaceRaised, color: colors.textSecondary, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
})
