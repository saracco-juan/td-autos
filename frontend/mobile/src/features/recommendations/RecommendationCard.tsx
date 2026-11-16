import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import Alert from '../../components/Alert'
import { archivo } from '../../theme/archivo'
import { CatalogAction, CatalogCard, catalog } from './CatalogCard'
import PortalInfo from './PortalInfo'
import { useComparisonSelection } from '../comparison/ComparisonSelection'
import FavoriteButton from '../favorites/FavoriteButton'
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

// Figma "02 - Recomendaciones" (2373:9914), with the same vehicle actions as web.
export default function RecommendationCard({ result, best }: Readonly<Props>) {
  const router = useRouter()
  const { ids, toggle } = useComparisonSelection()
  const { vehicle, dealer } = result
  const title = recommendationTitle(result)
  const warnings = warningMessages(result)
  const selected = ids.includes(result.listing_id)
  const favorite = <FavoriteButton vehicleId={result.listing_id} vehicleName={title} isFavorite={result.is_favorite} />
  return (
    <CatalogCard label={`Recomendación: ${title}`} title={title} photo={vehicle.image_urls?.[0] || vehicle.image_url} overlay={favorite}>
      {best && <Text style={[catalog.meta, archivo(true)]}>MEJOR COINCIDENCIA</Text>}
      <Text accessibilityRole="header" style={[catalog.title, archivo(true)]}>{title}</Text>
      <Text style={[catalog.price, archivo(true)]}>{formatPrice(result.published_price, result.published_currency)}</Text>
      <Text style={[catalog.meta, archivo()]}>{[formatKilometers(vehicle.kilometraje), vehicle.ubicacion].filter(Boolean).join(' · ')}</Text>
      <PortalInfo label="Ver atributos y motivos" caption={compatibilityLabel(result)} warning={warnings.length > 0}>
        <Text>{equivalentPriceLabel(result)}</Text>
        <Text>{[dealer.nombre, dealer.provincia].filter(Boolean).join(' · ')}</Text>
        {warnings.map(message => <Alert key={message} variant="warning">{message}</Alert>)}
        <Text>{componentsSummary(result)}</Text>
        <Text>{budgetPenaltyNote(result)}</Text>
      </PortalInfo>
      <View style={[catalog.actions, catalog.dealerActions]}>
        <CatalogAction label="VER FICHA" onPress={() => router.push(`/vehiculos/${result.listing_id}`)} />
        <CatalogAction selected={selected} label={selected ? 'QUITAR' : 'COMPARAR'} onPress={() => toggle(result.listing_id)} />
      </View>
    </CatalogCard>
  )
}
