import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../theme/tokens'

type Props = {
  variant: 'error' | 'success'
  children: string
}

// Message box: tinted background, dark text. The tint carries the meaning (DESIGN.md "Feedback").
export default function Alert({ variant, children }: Readonly<Props>) {
  return (
    <View accessible accessibilityRole="alert" style={[styles.box, variant === 'error' ? styles.error : styles.success]}>
      <Text style={styles.text}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8 },
  error: { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
  success: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  text: { color: colors.textPrimary, fontSize: 13 },
})
