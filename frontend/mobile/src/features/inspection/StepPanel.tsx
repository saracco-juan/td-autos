import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import type { ChecklistStep } from '@shared/checklist/types'
import { FLAG_LABEL, SAVE_ERROR } from '@shared/checklist/inspection/copy'
import { colors, radii, shadows } from '../../theme/tokens'
import FlagBadge from './FlagBadge'

type Props = {
  step: ChecklistStep
  completedCodes: ReadonlySet<string>
  saveFailed: boolean
  onToggle: (code: string, value: boolean) => void
}

// The card of the selected step (Figma 07): title, hint, one checkbox row per item and the save error (07i).
export default function StepPanel({ step, completedCodes, saveFailed, onToggle }: Readonly<Props>) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {step.numero}. {step.titulo}
      </Text>
      {step.ayuda ? <Text style={styles.hint}>{step.ayuda}</Text> : null}
      <View style={styles.items}>
        {step.items.map((item) => {
          const checked = completedCodes.has(item.codigo)
          return (
            <Pressable
              key={item.codigo}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={item.flagged ? `${item.texto}, ${FLAG_LABEL.toLowerCase()}` : item.texto}
              onPress={() => onToggle(item.codigo, !checked)}
              style={styles.row}
            >
              <View style={[styles.box, checked && styles.boxChecked]}>
                {checked ? <Ionicons name="checkmark" size={16} color={colors.onColor} /> : null}
              </View>
              <Text style={[styles.text, checked && styles.textChecked]}>{item.texto}</Text>
              {item.flagged ? <FlagBadge /> : null}
            </Pressable>
          )
        })}
      </View>
      {saveFailed ? <Alert variant="error">{SAVE_ERROR}</Alert> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  hint: { color: colors.textSecondary, fontSize: 12 },
  items: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  box: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    borderRadius: 3,
  },
  boxChecked: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  text: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  textChecked: { color: colors.textSecondary },
})
