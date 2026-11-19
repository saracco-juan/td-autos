import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii } from '../../theme/tokens'
import { bodyTypeShapes } from '@shared/diagnosis/vehicleSilhouettes'
import VehicleSilhouette from './VehicleSilhouette'
import { diagnosisType } from './typography'
import type { BodyType } from '@shared/diagnosis/types'

type Props = {
  bodyTypes: readonly BodyType[]
  selected: readonly number[]
  onToggle: (id: number) => void
}

export default function BodyTypeChips({ bodyTypes, selected, onToggle }: Readonly<Props>) {
  return (
    <View style={styles.group}>
      {bodyTypes.map((bodyType) => {
        const checked = selected.includes(bodyType.id)
        const shape = bodyTypeShapes[bodyType.nombre]
        return (
          <Pressable
            key={bodyType.id}
            accessibilityRole="checkbox"
            accessibilityLabel={bodyType.nombre}
            accessibilityState={{ checked }}
            onPress={() => onToggle(bodyType.id)}
            style={[styles.chip, checked && styles.checked]}
          >
            {shape && <VehicleSilhouette shape={shape} color={checked ? colors.onColor : colors.charcoal} />}
            <Text style={[styles.label, diagnosisType(checked), checked && styles.checkedLabel]}>
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
    minHeight: 98,
    gap: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  checked: { borderColor: colors.charcoal, backgroundColor: colors.charcoal },
  label: { color: colors.textPrimary, fontSize: 14, textAlign: 'center' },
  checkedLabel: { color: colors.onColor },
})
