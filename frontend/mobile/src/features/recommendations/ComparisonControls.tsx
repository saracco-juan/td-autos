import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, Easing, Image, Pressable, StyleSheet, Text, useAnimatedValue, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { canCompare } from '@shared/comparison/selection'
import { recommendationTitle } from '@shared/recommendations/format'
import type { Recommendation } from '@shared/recommendations/matching'
import { archivo } from '../../theme/archivo'
import { colors, radii } from '../../theme/tokens'
import VehicleSilhouette from '../diagnosis/VehicleSilhouette'
import { useComparisonSelection } from '../comparison/ComparisonSelection'

const revealCurve = Easing.bezier(0.32, 0.72, 0, 1)

function useJoin(open: boolean, reduceMotion: boolean) {
  const join = useAnimatedValue(open ? 1 : 0)
  const last = useRef(open)
  useEffect(() => {
    const changed = last.current !== open
    last.current = open
    const toValue = open ? 1 : 0
    if (reduceMotion || !changed) {
      join.setValue(toValue)
      return
    }
    const animation = Animated.timing(join, { toValue, duration: 550, easing: revealCurve, useNativeDriver: true, isInteraction: false })
    animation.start()
    return () => animation.stop()
  }, [join, open, reduceMotion])
  return (closed: number, opened: number) => {
    if (reduceMotion) return open ? opened : closed
    return join.interpolate({ inputRange: [0, 1], outputRange: [closed, opened] })
  }
}

type SlotProps = {
  width: number
  opacity: number | Animated.AnimatedInterpolation<number>
  onMeasure?: (width: number) => void
  id?: number
  result?: Recommendation
  index: number
  reduceMotion: boolean
  onRemove: (id: number) => void
}

function ComparisonSlot({ id, result, index, width, opacity, onMeasure, reduceMotion, onRemove }: Readonly<SlotProps>) {
  const open = id !== undefined
  const progress = useAnimatedValue(open ? 1 : 0)
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const title = result ? recommendationTitle(result) : `Vehículo ${id}`
  const photo = result?.vehicle.image_urls?.[0] || result?.vehicle.image_url
  const [previous, setPrevious] = useState<{ title: string; photo?: string | null } | null>(null)

  // Keep the departing vehicle visible until its exit finishes.
  if (open && (previous?.title !== title || previous?.photo !== photo)) setPrevious({ title, photo })
  if (!open && reduceMotion && previous) setPrevious(null)
  const visible = open ? { title, photo } : previous
  const hasContent = visible !== null

  useEffect(() => {
    if (reduceMotion || !hasContent) {
      progress.setValue(open ? 1 : 0)
      return
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0, duration: 800, easing: revealCurve,
      useNativeDriver: true, isInteraction: false,
    })
    animation.start(({ finished }) => { if (finished && !open) setPrevious(null) })
    return () => animation.stop()
  }, [hasContent, open, progress, reduceMotion])

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [index === 0 ? width : -width, 0] })
  return (
    <View style={[styles.slot, index === 0 ? styles.left : styles.right]} aria-hidden={!open} pointerEvents={open ? 'auto' : 'none'}
      onLayout={onMeasure && (event => onMeasure(event.nativeEvent.layout.width))}>
      {visible && <Animated.View style={[styles.wing, { opacity, transform: [{ translateX: reduceMotion ? 0 : translateX }] }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${visible.title} de la comparación`}
          disabled={!open} onPress={() => { if (id !== undefined) onRemove(id) }} style={styles.vehicle}>
          {visible.photo && visible.photo !== failedPhoto ? (
            <Image source={{ uri: visible.photo }} style={styles.photo} onError={() => setFailedPhoto(visible.photo ?? null)} />
          ) : (
            <View style={[styles.photo, styles.fallback]}><VehicleSilhouette shape="sport" color={colors.charcoal} width={26} /></View>
          )}
          <Text numberOfLines={2} style={[styles.name, archivo()]}>{visible.title}</Text>
          <Ionicons name="close" size={14} color={colors.onColor} />
        </Pressable>
      </Animated.View>}
    </View>
  )
}

export default function ComparisonControls({ results, reduceMotion }: Readonly<{
  results: Recommendation[]; reduceMotion: boolean
}>) {
  const router = useRouter()
  const { ids, toggle } = useComparisonSelection()
  const [width, setWidth] = useState(0)
  // Keep the surviving car on its own side when its partner is removed.
  const [lastRight, setLastRight] = useState<number>()
  const right = lastRight !== undefined && ids.includes(lastRight) ? lastRight : ids[1]
  if (right !== lastRight) setLastRight(right)
  const left = ids.find(id => id !== right)
  const leftJoin = useJoin(left !== undefined, reduceMotion)
  const rightJoin = useJoin(right !== undefined, reduceMotion)
  const leftRadius = leftJoin(radii.button, 0)
  const rightRadius = rightJoin(radii.button, 0)
  const compare = () => {
    if (canCompare(ids)) router.push('/comparar')
    else Alert.alert('Comparar vehículos', 'Seleccioná exactamente dos vehículos para comparar.', [{ text: 'Entendido' }])
  }
  const slot = (id: number | undefined, index: number, opacity: SlotProps['opacity']) => (
    <ComparisonSlot id={id} index={index} width={width} opacity={opacity} onMeasure={index === 0 ? setWidth : undefined}
      result={results.find(item => item.listing_id === id)}
      reduceMotion={reduceMotion} onRemove={toggle} />
  )
  return (
    <View testID="comparison-control" style={styles.row}>
      {slot(left, 0, leftJoin(0, 1))}
      <Animated.View style={[styles.action, { borderTopLeftRadius: leftRadius, borderBottomLeftRadius: leftRadius,
          borderTopRightRadius: rightRadius, borderBottomRightRadius: rightRadius }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`COMPARAR (${ids.length}/2)`} onPress={compare}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={[styles.label, archivo(true)]}>Comparar</Text>
        </Pressable>
      </Animated.View>
      {slot(right, 1, rightJoin(0, 1))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  slot: { flex: 1, minWidth: 0, overflow: 'hidden' },
  left: { borderTopLeftRadius: radii.button, borderBottomLeftRadius: radii.button },
  right: { borderTopRightRadius: radii.button, borderBottomRightRadius: radii.button },
  wing: { flex: 1, backgroundColor: colors.charcoal },
  vehicle: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 6, gap: 4 },
  photo: { width: 26, height: 26, borderRadius: 5 },
  fallback: { justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  name: { flex: 1, color: colors.onColor, fontSize: 12 },
  action: { maxWidth: '45%', overflow: 'hidden', borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surface },
  button: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  pressed: { backgroundColor: colors.surfaceRaised },
  label: { color: colors.textPrimary, fontSize: 13 },
})
