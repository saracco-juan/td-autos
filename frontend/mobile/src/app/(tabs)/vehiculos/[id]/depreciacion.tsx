import { useLocalSearchParams } from 'expo-router'

import DepreciationScreen from '../../../../features/depreciation/DepreciationScreen'

export default function DepreciationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <DepreciationScreen rawId={id} />
}
