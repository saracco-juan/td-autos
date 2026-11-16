import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, StyleSheet, useAnimatedValue, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { colors } from '../theme/tokens'

export const TAB_BAR_HEIGHT = 64
const NOTCH_WIDTH = 80
type Icon = keyof typeof Ionicons.glyphMap

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(true)

  useEffect(() => {
    let current = true
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      current = false
      setReduceMotion(enabled)
    })
    async function readPreference() {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled()
        if (current && typeof enabled === 'boolean') setReduceMotion(enabled)
      } catch {
        // Keep motion reduced until the system preference is available.
      }
    }
    void readPreference()
    return () => {
      current = false
      subscription?.remove()
    }
  }, [])
  return reduceMotion
}

function useTabMotion(target: number, reduceMotion: boolean) {
  const value = useAnimatedValue(target)
  useEffect(() => {
    if (reduceMotion) {
      value.setValue(target)
      return
    }
    Animated.spring(value, {
      toValue: target, stiffness: 280, damping: 34, mass: 1,
      overshootClamping: true, useNativeDriver: true, isInteraction: false,
    }).start()
  }, [target, value, reduceMotion])
  return value
}

function Marker({ center, reduceMotion }: { center: number; reduceMotion: boolean }) {
  const position = useTabMotion(center, reduceMotion)
  return (
    <Animated.View style={[styles.marker, { transform: [{ translateX: position }] }]}>
      <Svg width={NOTCH_WIDTH} height={46} viewBox="0 0 80 46">
        <Path fill={colors.background} d="M0 0H80V16C63 16 66 43 40 43S17 16 0 16Z" />
      </Svg>
      <View style={styles.disc} />
    </Animated.View>
  )
}

function TabGlyph({ icon, selected, reduceMotion }: { icon: Icon; selected: boolean; reduceMotion: boolean }) {
  const focus = useTabMotion(selected ? 1 : 0, reduceMotion)
  const lift = focus.interpolate({ inputRange: [0, 1], outputRange: [0, -19] })
  return (
    <Animated.View style={[styles.glyph, { transform: [{ translateY: lift }] }]}>
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
      <Animated.View style={[styles.tint, { opacity: focus }]}>
        <Ionicons name={icon} size={22} color={colors.red} />
      </Animated.View>
    </Animated.View>
  )
}

// Each glyph stays in its own slot as the disc slides underneath it.
export default function BuyerTabIndicator({ index, tabs }: { index: number; tabs: readonly { icon: Icon }[] }) {
  const [width, setWidth] = useState(0)
  const reduceMotion = useReduceMotion()
  const { left, right } = useSafeAreaInsets()
  const inset = Math.max(left, right)
  const center = inset + ((width - 2 * inset) / tabs.length) * (index + 0.5)

  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)} style={styles.background}>
      <View style={styles.surface} />
      {width > 0 && index >= 0 && <Marker center={center} reduceMotion={reduceMotion} />}
      <View style={[styles.icons, { left: inset, right: inset }]}>
        {tabs.map(({ icon }, slot) => (
          <TabGlyph key={icon} icon={icon} selected={slot === index} reduceMotion={reduceMotion} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  background: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  surface: { flex: 1, marginTop: 16, backgroundColor: colors.surface },
  icons: { position: 'absolute', top: 20, height: 38, flexDirection: 'row' },
  glyph: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tint: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  marker: { position: 'absolute', top: 0, left: -NOTCH_WIDTH / 2, alignItems: 'center' },
  disc: {
    position: 'absolute', top: 1, width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault,
  },
})
