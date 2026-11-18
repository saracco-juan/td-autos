import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, shadows } from '../theme/tokens'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'solidSuccess' | 'solidPrimary'

type Props = {
  label: string
  // Shown instead of `label` while `busy` (e.g. "INGRESANDO…").
  busyLabel?: string
  busy?: boolean
  disabled?: boolean
  variant?: Variant
  icon?: ReactNode
  onPress: () => void
}

const BORDER: Record<Variant, string> = {
  primary: colors.borderInput,
  secondary: colors.borderDefault,
  danger: colors.errorBorder,
  success: colors.successBorder,
  solidSuccess: colors.actionSuccess,
  solidPrimary: colors.red,
}

export default function Button({
  label,
  busyLabel,
  busy = false,
  disabled = false,
  variant = 'secondary',
  icon,
  onPress,
}: Readonly<Props>) {
  const inactive = busy || disabled
  const solid = variant === 'solidSuccess' || variant === 'solidPrimary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: BORDER[variant] }, solid && styles.solid, solid && { backgroundColor: BORDER[variant] },
        pressed && (solid ? styles.busy : styles.pressed), inactive && styles.busy]}
    >
      <View style={styles.content}>
        {busy ? <ActivityIndicator size="small" color={solid ? colors.onColor : colors.textPrimary} /> : icon}
        <Text
          style={[
            styles.label,
            variant !== 'secondary' && styles.strong,
            variant === 'danger' && { color: colors.actionDanger },
            variant === 'success' && { color: colors.actionSuccess },
            solid && { color: colors.onColor },
          ]}
        >
          {busy ? (busyLabel ?? label) : label}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 40,
    paddingHorizontal: 24,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  solid: { minHeight: 44, height: 'auto', paddingHorizontal: 12, paddingVertical: 8 },
  busy: { opacity: 0.6 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  strong: { fontWeight: '700' },
})
