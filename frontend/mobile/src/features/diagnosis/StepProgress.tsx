import { useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'

import { colors } from '../../theme/tokens'
import { diagnosisType } from './typography'
import VehicleSilhouette from './VehicleSilhouette'

type Props = {
  current: number
  total: number
  position: Animated.Value
}

export default function StepProgress({ current, total, position }: Readonly<Props>) {
  const [width, setWidth] = useState(0)
  const range = [0, total - 1]
  const carX = position.interpolate({ inputRange: range, outputRange: [0, Math.max(0, width - 88)] })
  const fillX = position.interpolate({ inputRange: range, outputRange: [-width, 0] })
  const label = `PASO ${current} DE ${total}`
  return (
    <View style={styles.group}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Progreso del diagnóstico"
        accessibilityValue={{ min: 1, max: total, now: current, text: label }}
        style={styles.track}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View style={{ transform: [{ translateX: carX }] }}>
          <VehicleSilhouette shape="sport" color={colors.red} />
        </Animated.View>
        <View style={styles.road}>
          <Animated.View style={[styles.fill, { opacity: width ? 1 : 0, transform: [{ translateX: fillX }] }]} />
        </View>
      </View>
      <View style={styles.caption}>
        <Text style={[styles.label, diagnosisType(true)]}>{label}</Text>
        <Text style={[styles.label, diagnosisType()]}>DIAGNÓSTICO DE NECESIDADES</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  caption: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  label: { color: colors.textSecondary, fontSize: 12 },
  track: { overflow: 'hidden' },
  road: { height: 4, overflow: 'hidden', backgroundColor: colors.borderDefault, borderRadius: 1 },
  fill: { height: '100%', backgroundColor: colors.charcoal },
})
