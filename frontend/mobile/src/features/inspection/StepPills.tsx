import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { StepProgress } from '@shared/checklist/progress'
import { pendingMarkerLabel } from '@shared/checklist/inspection/copy'
import { colors, radii } from '../../theme/tokens'

type Props = {
  steps: StepProgress[]
  selected: number
  // Critical items pending per step; only filled while the warning is open.
  pendingFlagged: ReadonlyMap<number, number>
  onSelect: (numero: number) => void
}

// Horizontal strip of step pills (Figma 07): "n. Título" and "x de y", with a red dot on the steps that still
// have critical items pending while the warning is open (07b).
export default function StepPills({ steps, selected, pendingFlagged, onSelect }: Readonly<Props>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      contentContainerStyle={styles.strip}
    >
      {steps.map((step) => {
        const active = step.numero === selected
        const pending = pendingFlagged.get(step.numero) ?? 0
        const marker = pending > 0 ? `, ${pendingMarkerLabel(pending)}` : ''
        return (
          <Pressable
            key={step.numero}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${step.numero}. ${step.titulo}, ${step.completed} de ${step.total}${marker}`}
            onPress={() => onSelect(step.numero)}
            style={[styles.pill, active && styles.active]}
          >
            <Text style={[styles.title, active && styles.activeText]}>
              {step.numero}. {step.titulo}
            </Text>
            {pending > 0 ? <View testID={`pending-dot-${step.numero}`} style={styles.dot} /> : null}
            <Text style={styles.count}>
              {step.completed} de {step.total}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  strip: { gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.button,
  },
  active: { borderColor: colors.borderDefault, backgroundColor: colors.surface },
  title: { color: colors.textSecondary, fontSize: 13 },
  activeText: { color: colors.textPrimary, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  count: { color: colors.textSecondary, fontSize: 12 },
})
