import { Link, type Href } from 'expo-router'
import { StyleSheet, Text } from 'react-native'

import { colors } from '../theme/tokens'

type Props = {
  href: Href
  children: string
  // Muted, smaller link (e.g. "¿Olvidaste tu contraseña?").
  subtle?: boolean
}

export default function TextLink({ href, children, subtle = false }: Readonly<Props>) {
  return (
    <Link href={href} replace accessibilityRole="link" style={subtle ? styles.subtle : styles.link}>
      {children}
    </Link>
  )
}

// The prompt that precedes a link ("¿No tenés cuenta? ") keeps the link on the same line.
export function LinkPrompt({ prompt, children }: Readonly<{ prompt: string; children: React.ReactNode }>) {
  return (
    <Text style={styles.prompt}>
      {prompt} {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  link: { color: colors.textPrimary, fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },
  subtle: { color: colors.textSecondary, fontSize: 12 },
  prompt: { color: colors.textPrimary, fontSize: 13, fontWeight: '500', textAlign: 'center' },
})
