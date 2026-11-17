import * as Linking from 'expo-linking'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import { CatalogCard, CatalogAction, catalog } from './CatalogCard'
import { archivo } from '../../theme/archivo'
import { colors } from '../../theme/tokens'
import {
  PORTAL_FILTERS_HEADING, PORTAL_KAVAK_NOTE, PORTAL_REASONS_HEADING, portalButtonLabel,
  portalInfoLabel, portalModelTitle, portalPriceRange, portalPriceYear, portalYearsLabel,
} from '@shared/portals/format'
import type { PortalModel } from '@shared/portals/models'
import PortalInfo from './PortalInfo'

// HU06 Figma 2521:11027. The backend owns URL/filter construction; the OS chooses app or browser.
export default function PortalModelCard({ model }: Readonly<{ model: PortalModel }>) {
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
    <CatalogCard title={title} photo={model.imagen_url} label={`Modelo recomendado: ${title}`} overlay={
        <PortalInfo label={portalInfoLabel(model)}>
          <Text style={styles.title}>{PORTAL_REASONS_HEADING}</Text>
          {model.motivos.map((reason) => <Text key={reason} style={styles.meta}>{reason}</Text>)}
          <Text style={styles.title}>{PORTAL_FILTERS_HEADING}</Text>
          {model.filtros.map((filter) => <Text key={filter} style={styles.meta}>{filter}</Text>)}
          <Text style={styles.meta}>{PORTAL_KAVAK_NOTE}</Text>
        </PortalInfo>
    }>
      <Text accessibilityRole="header" style={[catalog.title, archivo(true)]}>{title}</Text>
      <Text style={[catalog.meta, archivo()]}>{portalYearsLabel(model.anios)}</Text>
      <Text style={[catalog.price, archivo(true)]}>{portalPriceRange(model.precio)}</Text>
      <Text style={[catalog.meta, archivo()]}>{portalPriceYear(model.precio)}</Text>
      {model.carroceria ? <Text style={[catalog.meta, archivo()]}>{model.carroceria}</Text> : null}
      <View style={catalog.actions}>
        {model.links.map((link) => (
          <CatalogAction key={link.portal} label={portalButtonLabel(link)} onPress={() => { void openPortal(link.url) }} />
        ))}
      </View>
      {linkError ? <Alert variant="error">No pudimos abrir el portal. Intentá de nuevo.</Alert> : null}
    </CatalogCard>
  )
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: 12 },
})
