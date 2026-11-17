import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'

import { archivo } from '../theme/archivo'
import { colors } from '../theme/tokens'

type Props = { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }

export default function BackLink({ label, onPress, style }: Readonly<Props>) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.link, style, pressed && styles.pressed]}>
      <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
      <Text style={[styles.label, archivo(true)]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { flexShrink: 1, fontSize: 13, color: colors.textPrimary },
  pressed: { opacity: 0.65 },
})
