import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme/tokens'

export default function ChecklistProgress({ completed, total, label }: Readonly<{ completed: number; total: number; label: string }>) {
  return (
    <View style={styles.row} accessible accessibilityRole="progressbar" accessibilityLiveRegion="polite"
      accessibilityLabel={label} accessibilityValue={{ min: 0, max: total, now: completed }}>
      <Text style={styles.caption}>{label}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${total ? 100 * completed / total : 0}%` }]} /></View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginVertical: 6 },
  caption: { fontSize: 13, color: colors.textSecondary },
  track: { flex: 1, minWidth: 40, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.borderDefault },
  fill: { height: '100%', backgroundColor: colors.red },
})
