import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii } from '../../theme/tokens'
import type { StepOption } from './steps'

type Props = {
  options: readonly StepOption[]
  value: string | null
  onSelect: (code: StepOption['code']) => void
}

// Single-choice question: one 50 px row per option (Figma "Option"); the chosen row gets a 2 px charcoal border.
export default function ChoiceList({ options, value, onSelect }: Readonly<Props>) {
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {options.map((option) => {
        const checked = option.code === value
        return (
          <Pressable
            key={option.code}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            onPress={() => onSelect(option.code)}
            style={[styles.row, checked && styles.checked]}
          >
            <Text style={styles.label}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  row: {
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: radii.button,
    backgroundColor: colors.background,
  },
  // The padding absorbs the thicker border so the label does not move.
  checked: { paddingHorizontal: 15, borderWidth: 2, borderColor: colors.charcoal, backgroundColor: colors.surface },
  label: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
})
