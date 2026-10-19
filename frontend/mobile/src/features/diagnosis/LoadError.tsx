import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../../theme/tokens'

export type LoadErrorKind = 'network' | 'server'

// Same copy as the web ErrorState.
const COPY: Record<LoadErrorKind, { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = {
  network: {
    icon: 'cloud-offline-outline',
    title: 'Sin conexión con el servidor',
    body: 'No pudimos conectarnos. Revisá tu conexión a internet e intentá de nuevo.',
  },
  server: {
    icon: 'warning-outline',
    title: 'Algo salió mal',
    body: 'No pudimos cargar la información. Intentá de nuevo en unos minutos.',
  },
}

// Figma "Sin conexión" state (2373:10198): icon, title and text centered at the top of the screen.
export default function LoadError({ kind }: Readonly<{ kind: LoadErrorKind }>) {
  const { icon, title, body } = COPY[kind]
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.red} />
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 24 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
})
