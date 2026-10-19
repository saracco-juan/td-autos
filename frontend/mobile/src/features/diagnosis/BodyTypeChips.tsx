import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '../../theme/tokens'
import type { BodyType } from '@shared/diagnosis/types'

type Props = {
  bodyTypes: readonly BodyType[]
  selected: readonly number[]
  max: number
  onToggle: (id: number) => void
}

// Multi-choice question: pill chips two per row (Figma "Chip"); a chosen chip shows a check before its name.
// Once the maximum is chosen, the other chips are disabled until one is released.
export default function BodyTypeChips({ bodyTypes, selected, max, onToggle }: Readonly<Props>) {
  const full = selected.length >= max
  return (
    <View style={styles.group}>
      {bodyTypes.map((bodyType) => {
        const checked = selected.includes(bodyType.id)
        const disabled = full && !checked
        return (
          <Pressable
            key={bodyType.id}
            accessibilityRole="checkbox"
            accessibilityLabel={bodyType.nombre}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => onToggle(bodyType.id)}
            style={[styles.chip, checked && styles.checked, disabled && styles.disabled]}
          >
            <Text style={[styles.label, checked && styles.checkedLabel]}>
              {checked ? '✓ ' : ''}
              {bodyType.nombre}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: {
    flexBasis: '45%',
    flexGrow: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  checked: { borderColor: colors.textPrimary },
  disabled: { opacity: 0.6 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  checkedLabel: { color: colors.textPrimary },
})
