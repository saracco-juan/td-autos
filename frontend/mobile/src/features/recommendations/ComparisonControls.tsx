import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Animated, Easing, Image, Pressable, StyleSheet, Text, useAnimatedValue, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { canCompare } from '@shared/comparison/selection'
import { recommendationTitle } from '@shared/recommendations/format'
import type { Recommendation } from '@shared/recommendations/matching'
import Button from '../../components/Button'
import { archivo } from '../../theme/archivo'
import { colors, radii } from '../../theme/tokens'
import { useComparisonSelection } from '../comparison/ComparisonSelection'

type SlotProps = {
  id?: number
  result?: Recommendation
  index: number
  reduceMotion: boolean
  onRemove: (id: number) => void
}

function ComparisonSlot({ id, result, index, reduceMotion, onRemove }: Readonly<SlotProps>) {
  const open = id !== undefined
  const progress = useAnimatedValue(open ? 1 : 0)
  const [width, setWidth] = useState(0)
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
      toValue: open ? 1 : 0, duration: 800, easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true, isInteraction: false,
    })
    animation.start(({ finished }) => { if (finished && !open) setPrevious(null) })
    return () => animation.stop()
  }, [hasContent, open, progress, reduceMotion])

  if (!visible) return null
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [index === 0 ? width : -width, 0] })
  return (
    <View style={styles.slot} aria-hidden={!open} pointerEvents={open ? 'auto' : 'none'}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      <Animated.View style={[styles.vehicle, { opacity: progress, transform: [{ translateX }] }]}>
        {visible.photo ? <Image source={{ uri: visible.photo }} style={styles.photo} /> : null}
        <Text numberOfLines={2} style={[styles.name, archivo()]}>{visible.title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${visible.title} de la comparación`}
          disabled={!open} onPress={() => { if (id !== undefined) onRemove(id) }} style={styles.remove}>
          <Ionicons name="close" size={18} color={colors.onColor} />
        </Pressable>
      </Animated.View>
    </View>
  )
}

export default function ComparisonControls({ results, reduceMotion }: Readonly<{
  results: Recommendation[]; reduceMotion: boolean
}>) {
  const router = useRouter()
  const { ids, toggle } = useComparisonSelection()
  const compare = () => {
    if (canCompare(ids)) router.push('/comparar')
    else Alert.alert('Comparar vehículos', 'Seleccioná exactamente dos vehículos para comparar.', [{ text: 'Entendido' }])
  }
  return (
    <View>
      <Button label={`COMPARAR (${ids.length}/2)`} onPress={compare} />
      <View style={styles.row}>
        {[0, 1].map(index => (
          <ComparisonSlot key={index} index={index} id={ids[index]} result={results.find(item => item.listing_id === ids[index])}
            reduceMotion={reduceMotion} onRemove={toggle} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  slot: { flex: 1, overflow: 'hidden', borderRadius: radii.button },
  vehicle: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 8, gap: 5, backgroundColor: colors.charcoal },
  photo: { width: 30, height: 30, borderRadius: 6 },
  name: { flex: 1, color: colors.onColor, fontSize: 12 },
  remove: { width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
})
