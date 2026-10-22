import { useLocalSearchParams } from 'expo-router'

import InspectionScreen from '../../../../features/inspection/InspectionScreen'

// tdautos://vehiculos/{id}/inspeccion. Lives inside (tabs), hidden from the tab bar, so the bottom navigation stays.
export default function InspectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <InspectionScreen rawId={id} />
}
