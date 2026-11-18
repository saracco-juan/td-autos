import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { BACK_TO_SHEET, reviewedCounter } from '@shared/checklist/inspection/copy'
import BackLink from '../../components/BackLink'
import ChecklistProgress from '../../components/checklist/ChecklistProgress'
import { archivo } from '../../theme/archivo'
import { colors } from '../../theme/tokens'

type Props = {
  vehicleId: number
  title: string
  completed: number
  total: number
}

// "Volver a la ficha": opens the sheet of this vehicle. Not `router.back()`: the tabs navigator goes back to its first
// tab, not to the previous screen, so the target is explicit (it also covers a deep link into the checklist).
export function useBackToSheet(vehicleId: number) {
  const router = useRouter()
  return () => router.navigate(`/vehiculos/${vehicleId}`)
}

// The checklist and summary identify the same vehicle.
export default function InspectionHeader({ vehicleId, title, completed, total }: Readonly<Props>) {
  const goBack = useBackToSheet(vehicleId)

  return (
    <View style={styles.header}>
      <BackLink label={BACK_TO_SHEET} onPress={goBack} />
      <View style={styles.titles}>
        <Text accessibilityRole="header" style={[styles.title, archivo(true)]}>Inspección del auto</Text>
        <Text style={[styles.subtitle, archivo()]}>{title}</Text>
        <ChecklistProgress completed={completed} total={total} label={reviewedCounter(completed, total)} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { gap: 8, paddingBottom: 18 },
  titles: { gap: 8 },
  subtitle: { color: colors.textSecondary, fontSize: 15 },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
})
