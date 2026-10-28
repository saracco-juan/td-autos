import { useLocalSearchParams } from 'expo-router'

import CostsScreen from '../../../../features/costs/CostsScreen'

// tdautos://vehiculos/{id}/costos. Lives inside (tabs), hidden from the tab bar, so the bottom navigation stays.
export default function CostsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <CostsScreen rawId={id} />
}
