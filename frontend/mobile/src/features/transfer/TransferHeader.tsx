import { StyleSheet, Text, View } from 'react-native'

import { EYEBROW, TITLE, completedCounter } from '@shared/checklist/transfer/copy'
import { colors } from '../../theme/tokens'

type Props = {
  completed: number
  total: number
}

// Shared by the checklist and the summary: eyebrow, title and counter. Transferencia is a tab, so no back link.
export default function TransferHeader({ completed, total }: Readonly<Props>) {
  return (
    <View style={styles.titles}>
      <Text style={styles.eyebrow}>{EYEBROW}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {TITLE}
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.counter}>
        {completedCounter(completed, total)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  titles: { gap: 8 },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  counter: { color: colors.textSecondary, fontSize: 14 },
})
