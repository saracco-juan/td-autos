import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import { colors, radii, shadows } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'

const LOGOUT_ERROR = 'No se pudo cerrar la sesión. Intentá nuevamente.'

export default function ProfileScreen() {
  const { logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const handleLogout = async () => {
    setBusy(true)
    setError(false)
    try {
      await logout()
    } catch {
      // The session is still alive on the server: stay here so the user can try again.
      setBusy(false)
      setError(true)
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Perfil
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>PRIVACIDAD Y SESIÓN</Text>
        {error ? <Alert variant="error">{LOGOUT_ERROR}</Alert> : null}
        <Button label="CERRAR SESIÓN" busyLabel="CERRANDO SESIÓN…" busy={busy} onPress={() => void handleLogout()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 24, gap: 20 },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  card: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
})
