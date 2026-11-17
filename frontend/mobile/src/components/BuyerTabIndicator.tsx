import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Animated, StyleSheet, useAnimatedValue, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import useReduceMotion from '../lib/useReduceMotion'
import { colors } from '../theme/tokens'

export const TAB_BAR_HEIGHT = 64
const DISC_LIFT = 16
const NOTCH_DEPTH = 28
type Icon = keyof typeof Ionicons.glyphMap

export function useBuyerTabBarSpace() {
  const { bottom } = useSafeAreaInsets()
  return TAB_BAR_HEIGHT + Math.max(bottom, 8)
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
  const center = (width / tabs.length) * (index + 0.5)
  // Initialize at the measured slot so the first paint doesn't slide in from the edge.
  const hasSelection = width > 0 && index >= 0

  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)} style={styles.background}>
      {hasSelection ? <PillSurface width={width} center={center} reduceMotion={reduceMotion} />
        : <View style={[styles.pill, styles.surface]} />}
      <View style={styles.icons}>
        {tabs.map(({ icon }, slot) => (
          <TabGlyph key={icon} icon={icon} selected={slot === index} reduceMotion={reduceMotion} />
        ))}
      </View>
    </View>
  )
}

function PillSurface({ width, center, reduceMotion }: { width: number; center: number; reduceMotion: boolean }) {
  const position = useTabMotion(center, reduceMotion)
  const transform = [{ translateX: position }]
  const height = TAB_BAR_HEIGHT - DISC_LIFT
  const outline = `M0 0 H${width - 40} c17 0 16 ${NOTCH_DEPTH} 40 ${NOTCH_DEPTH}
    s23 -${NOTCH_DEPTH} 40 -${NOTCH_DEPTH} H${2 * width} V${height} H0 Z`
  return (
    <>
      <View style={styles.pill}>
        <Animated.View style={{ left: -width, width: 2 * width, transform }}>
          <Svg width={2 * width} height={height}><Path d={outline} fill={colors.surface} /></Svg>
        </Animated.View>
      </View>
      <Animated.View style={[styles.disc, { transform }]} />
    </>
  )
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  pill: { ...StyleSheet.absoluteFill, top: DISC_LIFT, borderRadius: (TAB_BAR_HEIGHT - DISC_LIFT) / 2, overflow: 'hidden' },
  surface: { backgroundColor: colors.surface },
  icons: { position: 'absolute', left: 0, right: 0, top: 20, height: 38, flexDirection: 'row' },
  glyph: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tint: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  disc: {
    position: 'absolute', top: 1, left: -19, width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault,
  },
})
