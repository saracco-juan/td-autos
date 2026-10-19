import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '../theme/tokens'

// Figma "Nav/Top": red bar with the app name, 56 high below the status bar.
export default function AppBar() {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: 56 + insets.top }]}>
      <Text accessibilityRole="header" style={styles.title}>
        TD Autos
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.red,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  title: { color: colors.onColor, fontSize: 18, fontWeight: '700' },
})
