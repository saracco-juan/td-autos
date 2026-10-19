import { StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import type { ChecklistSummary } from '@shared/checklist/progress'
import { SUMMARY_LABELS } from '@shared/checklist/inspection/copy'
import { summaryMessage, summaryPendingItems } from '@shared/checklist/inspection/summaryMessage'
import { colors, radii, shadows } from '../../theme/tokens'
import FlagBadge from './FlagBadge'

// Body of the summary view (Figma 07c / 07d / 07e): result message, progress per step, and the pending items.
// Everything here is read-only; ticking happens in the checklist. The screen draws the header and the buttons.
export default function InspectionSummary({ progress }: Readonly<{ progress: ChecklistSummary }>) {
  const message = summaryMessage(progress)
  const { critical, items } = summaryPendingItems(progress)

  return (
    <>
      <Alert variant={message.tone}>{message.text}</Alert>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {SUMMARY_LABELS.progressTitle}
        </Text>
        {progress.steps.map((step) => (
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
            {progress.completed} de {progress.total}
          </Text>
        </View>
      </View>

      {items.length > 0 ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {critical ? SUMMARY_LABELS.pendingCriticalTitle : SUMMARY_LABELS.pendingTitle}
          </Text>
          {critical ? <Text style={styles.hint}>{SUMMARY_LABELS.pendingCriticalHint}</Text> : null}
          {items.map((item) => (
            <View key={item.codigo} style={styles.row}>
              <Text style={[styles.rowLabel, styles.itemText]}>{item.texto}</Text>
              {item.flagged ? <FlagBadge /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </>
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
