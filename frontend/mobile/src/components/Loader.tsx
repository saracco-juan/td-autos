import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { colors } from '../theme/tokens'

// Loading is shown on the component that waits, centered inside it (DESIGN.md "Feedback").
export default function Loader() {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel="Cargando">
      <ActivityIndicator size="large" color={colors.textSecondary} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
})
