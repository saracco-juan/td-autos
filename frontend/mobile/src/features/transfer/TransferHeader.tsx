import { StyleSheet, Text, View } from 'react-native'

import { TITLE, completedCounter } from '@shared/checklist/transfer/copy'
import ChecklistProgress from '../../components/checklist/ChecklistProgress'
import { archivo } from '../../theme/archivo'
import { colors } from '../../theme/tokens'

type Props = {
  completed: number
  total: number
}

// Transferencia has its own tab and needs no back link.
export default function TransferHeader({ completed, total }: Readonly<Props>) {
  return (
    <View style={styles.titles}>
      <Text accessibilityRole="header" style={[styles.title, archivo(true)]}>
        {TITLE}
      </Text>
      <ChecklistProgress completed={completed} total={total} label={completedCounter(completed, total)} />
    </View>
  )
}

const styles = StyleSheet.create({
  titles: { gap: 8, paddingVertical: 16 },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
})
