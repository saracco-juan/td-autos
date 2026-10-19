import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../theme/tokens'

// Placeholder for the tabs that are not built yet.
export default function ComingSoon({ title }: Readonly<{ title: string }>) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.text}>Próximamente.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8, backgroundColor: colors.background },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  text: { color: colors.textSecondary, fontSize: 14 },
})
