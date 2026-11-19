import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { G, Path } from 'react-native-svg'

import { colors } from '../theme/tokens'
import { archivo } from '../theme/archivo'

// Shared TD monogram on a compact brand-red tile.
function LogoMark() {
  return (
    <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg viewBox="8 18 48 28" width={23} height={14}>
        <G fill={colors.onColor} fillRule="evenodd">
          <Path d="M8 18H30V25H22.5V46H15.5V25H8Z" />
          <Path d="M34 18H42A14 14 0 0 1 42 46H34ZM41 25V39H42A7 7 0 0 0 42 25Z" />
        </G>
      </Svg>
    </View>
  )
}

// The monogram reads as TD; accessibility keeps the full brand name.
export default function AppBar() {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: 56 + insets.top }]}>
      <View accessible accessibilityRole="header" accessibilityLabel="TD Autos" style={styles.brand}>
        <LogoMark />
        <Text style={[styles.title, archivo(true)]}>Autos</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
  },
  title: { color: colors.textPrimary, fontSize: 19, letterSpacing: -0.2 },
})
