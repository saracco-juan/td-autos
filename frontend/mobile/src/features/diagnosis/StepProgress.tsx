import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../../theme/tokens'

type Props = {
  current: number
  total: number
}

// "PASO N DE 7" over an 8 px bar (Figma "Progress group"); the bar exposes its value to assistive technology.
export default function StepProgress({ current, total }: Readonly<Props>) {
  const label = `PASO ${current} DE ${total}`
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Progreso del diagnóstico"
        accessibilityValue={{ min: 1, max: total, now: current, text: label }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${(current / total) * 100}%` }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  track: {
    height: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceRaised,
  },
  fill: { height: '100%', backgroundColor: colors.charcoal },
})
