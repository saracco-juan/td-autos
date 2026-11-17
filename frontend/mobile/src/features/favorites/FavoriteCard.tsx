import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import type { FavoriteVehicle } from '@shared/favorites/types'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { compatibilityLabel, formatKilometers, formatPrice } from '@shared/recommendations/format'
import type { Recommendation } from '@shared/recommendations/matching'
import { archivo } from '../../theme/archivo'
import { CatalogAction, CatalogCard, catalog } from '../recommendations/CatalogCard'
import { FavoriteHeart } from './FavoriteButton'

export default function FavoriteCard({ vehicle, match, best, pending, onRemove }: Readonly<{
  vehicle: FavoriteVehicle; match?: Recommendation; best: boolean; pending: boolean; onRemove: () => void
}>) {
  const router = useRouter()
  const title = vehicleTitle(vehicle)
  const fuels = { nafta: 'Nafta', diesel: 'Diésel', gnc: 'GNC', hibrido: 'Híbrido', electrico: 'Eléctrico' }
  const details = [vehicle.transmision && (vehicle.transmision === 'automatica' ? 'Automática' : 'Manual'),
    vehicle.combustible && fuels[vehicle.combustible], vehicle.kilometraje === null
      ? 'Kilometraje no disponible' : formatKilometers(vehicle.kilometraje)]

  return (
    <CatalogCard label={`Favorito: ${title}`} title={title} photo={vehicle.image_url}
      overlay={<FavoriteHeart vehicleName={title} saved pending={pending} animate={false} onToggle={onRemove} />}>
      {best && <Text style={[catalog.meta, archivo(true)]}>MEJOR COINCIDENCIA</Text>}
      <Text accessibilityRole="header" style={[catalog.title, archivo(true)]}>{title}</Text>
      <Text style={[catalog.price, archivo(true)]}>{vehicle.precio === null || vehicle.moneda === null
        ? 'Precio no disponible' : formatPrice(vehicle.precio, vehicle.moneda)}</Text>
      <Text style={[catalog.meta, archivo()]}>{details.filter(Boolean).join(' · ')}</Text>
      <Text style={[catalog.meta, archivo()]}>{match ? compatibilityLabel(match) : 'Compatibilidad no disponible'}</Text>
      <View style={catalog.actions}>
        <CatalogAction label="VER FICHA" onPress={() => router.push(`/vehiculos/${vehicle.id}?from=favoritos`)} />
      </View>
    </CatalogCard>
  )
}
