import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii } from '../../theme/tokens'
import type { StepOption } from '@shared/diagnosis/steps'
import { diagnosisType } from './typography'

type Props = {
  options: readonly StepOption[]
  value: string | null
  onSelect: (code: StepOption['code']) => void
}

export default function ChoiceList({ options, value, onSelect }: Readonly<Props>) {
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {options.map((option) => {
        const checked = option.code === value
        return (
          <Pressable
            key={option.code}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked }}
            onPress={() => onSelect(option.code)}
            style={({ pressed }) => [styles.row, checked && styles.checked, pressed && styles.pressed]}
          >
            <View style={[styles.radio, checked && styles.radioChecked]}>
              {checked && <View style={styles.dot} />}
            </View>
            <Text style={[styles.label, diagnosisType(checked), checked && styles.checkedLabel]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  checked: { borderColor: colors.charcoal, backgroundColor: colors.charcoal },
  pressed: { opacity: 0.8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  radioChecked: { borderColor: colors.onColor },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onColor },
  label: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22 },
  checkedLabel: { color: colors.onColor },
})
