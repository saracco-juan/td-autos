import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, radii, shadows } from '../theme/tokens'
import AppBar from './AppBar'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
}

// Guest screens (Figma 01-03b): red top bar and a white card with the heading, scrolling above the keyboard.
export default function AuthScreen({ title, subtitle, children }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <View style={styles.screen}>
      <AppBar />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        >
          <View style={styles.card}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 24 },
  card: {
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  heading: { gap: 10 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
})
