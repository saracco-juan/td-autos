import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../theme/tokens'

type Variant = 'error' | 'success' | 'warning'

type Props = {
  variant: Variant
  children: string
}

// Message box: tinted background, dark text. The tint carries the meaning (docs/design.md "Feedback");
// warning is for something pending on the user's side (e.g. an incomplete profile), not an error.
export default function Alert({ variant, children }: Readonly<Props>) {
  return (
    <View accessible accessibilityRole="alert" style={[styles.box, styles[variant]]}>
      <Text style={styles.text}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8 },
  error: { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
  success: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  warning: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
  text: { color: colors.textPrimary, fontSize: 13 },
})
