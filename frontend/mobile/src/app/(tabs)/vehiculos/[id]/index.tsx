import { useLocalSearchParams } from 'expo-router'

import VehicleDetailScreen from '../../../../features/vehicle-detail/VehicleDetailScreen'

// tdautos://vehiculos/{id}. Lives inside (tabs), hidden from the tab bar, so the bottom navigation stays.
export default function VehicleDetailRoute() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  return <VehicleDetailScreen rawId={id} fromFavorites={from === 'favoritos'} />
}
