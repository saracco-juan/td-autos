import { Ionicons } from '@expo/vector-icons'
import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useAnimatedValue, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { archivo } from '../../theme/archivo'
import { colors, radii } from '../../theme/tokens'

export function CatalogGrid({ children }: { children: ReactNode }) {
  return (
    <View style={styles.grid}>
      {Children.map(children, child => <View style={catalog.cell}>{child}</View>)}
    </View>
  )
}

type Props = {
  label: string
  title: string
  photo?: string | null
  overlay?: ReactNode
  children: ReactNode
}

export function CatalogCard({ label, title, photo, overlay, children }: Props) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  return (
    <View accessibilityLabel={label} style={styles.card}>
      <View style={styles.media}>
        {photo && failedPhoto !== photo ? (
          <Image key={photo} accessibilityLabel={`Foto de ${title}`} source={{ uri: photo }}
            resizeMode="cover" style={StyleSheet.absoluteFill} onError={() => setFailedPhoto(photo)} />
        ) : <Text style={[styles.placeholder, archivo()]}>Sin fotos</Text>}
        <View pointerEvents="none" aria-hidden style={styles.fade}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="shade" x1="0" y1="0" x2="0" y2="100%">
              <Stop offset="0" stopColor={colors.charcoal} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.charcoal} />
            </LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#shade)" />
          </Svg>
        </View>
        {overlay && <View style={styles.overlay}>{overlay}</View>}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  )
}

function CompareIcon({ selected, motionEnabled }: { selected: boolean; motionEnabled: boolean }) {
  const scale = useAnimatedValue(1)
  const previous = useRef(selected)
  useEffect(() => {
    const changed = selected !== previous.current
    previous.current = selected
    if (!motionEnabled || !changed) {
      scale.setValue(1)
      return
    }
    scale.setValue(0.85)
    const animation = Animated.timing(scale, {
      toValue: 1, duration: 160, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [selected, motionEnabled, scale])
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={selected ? 'checkmark-circle' : 'git-compare-outline'} size={20} color={selected ? colors.charcoal : colors.onColor} />
    </Animated.View>
  )
}

export function CatalogAction({ label, onPress, selected, motionEnabled = false }: {
  label: string; onPress: () => void; selected?: boolean; motionEnabled?: boolean
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [styles.action, selected !== undefined && styles.compare, selected && styles.selected, pressed && styles.pressed]}>
      {selected === undefined ? <Text style={[styles.actionLabel, archivo(true)]}>{label}</Text>
        : <CompareIcon selected={selected} motionEnabled={motionEnabled} />}
    </Pressable>
  )
}

export const catalog = StyleSheet.create({
  cell: { width: '50%', paddingHorizontal: 4 },
  title: { color: colors.onColor, fontSize: 17, lineHeight: 21, letterSpacing: -0.3 },
  meta: { color: colors.surfaceRaised, fontSize: 12, lineHeight: 17 },
  price: { color: colors.onColor, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  dealerActions: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { marginTop: 'auto', gap: 5, paddingTop: 6 },
})

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginHorizontal: -4 },
  card: { flexGrow: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.charcoal },
  media: { aspectRatio: 4 / 3, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },
  overlay: { position: 'absolute', top: 6, right: 6, maxWidth: '90%' },
  placeholder: { color: colors.textSecondary, fontSize: 12 },
  content: { flexGrow: 1, gap: 5, padding: 10, paddingTop: 3 },
  action: { flexGrow: 1, minHeight: 44, paddingHorizontal: 6, paddingVertical: 7, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.button, backgroundColor: colors.red },
  compare: { width: 44, flexGrow: 0, backgroundColor: 'transparent', borderColor: colors.borderDefault, borderWidth: 1 },
  selected: { backgroundColor: colors.surface },
  pressed: { opacity: 0.78 },
  actionLabel: { color: colors.onColor, fontSize: 12, textAlign: 'center' },
})
