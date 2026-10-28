import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { BACK_TO_SHEET, EYEBROW, reviewedCounter } from '@shared/checklist/inspection/copy'
import { colors, radii } from '../../theme/tokens'

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

// Shared by the checklist and the summary (Figma 07 / 07c): back link, eyebrow, vehicle title and counter.
export default function InspectionHeader({ vehicleId, title, completed, total }: Readonly<Props>) {
  const goBack = useBackToSheet(vehicleId)

  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="link" accessibilityLabel={BACK_TO_SHEET} onPress={goBack} style={styles.back}>
        <View style={styles.chevron}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </View>
        <Text style={styles.backLabel}>{BACK_TO_SHEET}</Text>
      </Pressable>
      <View style={styles.titles}>
        <Text style={styles.eyebrow}>{EYEBROW}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.counter}>
          {reviewedCounter(completed, total)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { gap: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  chevron: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  backLabel: { color: colors.textPrimary, fontSize: 13 },
  titles: { gap: 8 },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  counter: { color: colors.textSecondary, fontSize: 14 },
})
