import { StyleSheet, Text, View } from 'react-native'

import type { StepProgress } from '@shared/checklist/progress'
import type { ChecklistItem } from '@shared/checklist/types'
import { colors, radii, shadows } from '../../theme/tokens'
import FlagBadge from './FlagBadge'

type ProgressProps = {
  title: string
  steps: StepProgress[]
  completed: number
  total: number
}

// Progress per step with the total row (read-only).
export function ProgressCard({ title, steps, completed, total }: Readonly<ProgressProps>) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {title}
      </Text>
      {steps.map((step) => (
        <View key={step.numero} style={styles.row}>
          <Text style={styles.rowLabel}>
            {step.numero}. {step.titulo}
          </Text>
          <Text style={styles.rowValue}>
            {step.completed} de {step.total}
          </Text>
        </View>
      ))}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Total</Text>
        <Text style={[styles.rowValue, styles.total]}>
          {completed} de {total}
        </Text>
      </View>
    </View>
  )
}

type PendingProps = {
  title: string
  // Line under the title, shown when the list is only the flagged items.
  hint?: string
  flagLabel: string
  items: ChecklistItem[]
}

// The pending items (read-only), with the flag badge on the flagged ones.
export function PendingCard({ title, hint, flagLabel, items }: Readonly<PendingProps>) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {title}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {items.map((item) => (
        <View key={item.codigo} style={styles.row}>
          <Text style={[styles.rowLabel, styles.itemText]}>{item.texto}</Text>
          {item.flagged ? <FlagBadge label={flagLabel} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 4,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: 8 },
  hint: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  rowLabel: { color: colors.textSecondary, fontSize: 14 },
  itemText: { flex: 1, color: colors.textPrimary },
  rowValue: { color: colors.textPrimary, fontSize: 14 },
  total: { fontWeight: '700' },
})
