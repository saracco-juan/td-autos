import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii } from '../theme/tokens'

type Props = { label: string; onPress: () => void }

// The back link of the detail screens: a chevron chip and its label.
export default function BackChip({ label, onPress }: Readonly<Props>) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={styles.back}>
      <View style={styles.chevron}>
        <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  chevron: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  label: { color: colors.textPrimary, fontSize: 13 },
})
