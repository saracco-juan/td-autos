import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { G, Path } from 'react-native-svg'

import { colors } from '../theme/tokens'

// White rounded tile with the TD monogram in the brand red (the favicon, inverted), as in the web navbar.
function LogoMark() {
  return (
    <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg viewBox="8 18 48 28" width={20} height={12}>
        <G fill={colors.red} fillRule="evenodd">
          <Path d="M8 18H30V25H22.5V46H15.5V25H8Z" />
          <Path d="M34 18H42A14 14 0 0 1 42 46H34ZM41 25V39H42A7 7 0 0 0 42 25Z" />
        </G>
      </Svg>
    </View>
  )
}

// Figma "Nav/Top": red bar, 56 high below the status bar. The monogram reads as "TD", so the wordmark only adds
// "Autos"; the header keeps the full brand name.
export default function AppBar() {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: 56 + insets.top }]}>
      <View accessible accessibilityRole="header" accessibilityLabel="TD Autos" style={styles.brand}>
        <LogoMark />
        <Text style={styles.title}>Autos</Text>
      </View>
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { color: colors.onColor, fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
})
