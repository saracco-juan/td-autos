import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, useAnimatedValue, View } from 'react-native'
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'

import { chartGeometry, depreciationCopy, formatPercent, yearLabel } from '@shared/depreciation/presentation'
import type { DepreciationProjection } from '@shared/depreciation/types'
import { formatPrice } from '@shared/recommendations/format'
import useReduceMotion from '../../lib/useReduceMotion'
import { archivo } from '../../theme/archivo'
import { colors } from '../../theme/tokens'

function YearChoice({ label, selected, before, after, first, last, onPress }: Readonly<{
  label: string; selected: boolean; before: boolean; after: boolean; first: boolean; last: boolean; onPress: () => void
}>) {
  const reduce = useReduceMotion()
  const position = useAnimatedValue(selected ? 1 : 0)
  useEffect(() => {
    const motion = Animated.timing(position, { toValue: selected ? 1 : 0, duration: reduce ? 0 : 550,
      easing: Easing.bezier(.22, 1, .36, 1), useNativeDriver: false })
    motion.start()
    return () => motion.stop()
  }, [position, selected, reduce])
  return <Animated.View style={{ flex: 1, marginHorizontal: position.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} hitSlop={{ top: 8, bottom: 8 }}>
      <Animated.View style={[styles.choice, { borderTopLeftRadius: first || selected || after ? 7 : 0,
        borderBottomLeftRadius: first || selected || after ? 7 : 0, borderTopRightRadius: last || selected || before ? 7 : 0,
        borderBottomRightRadius: last || selected || before ? 7 : 0,
        backgroundColor: position.interpolate({ inputRange: [0, 1], outputRange: [colors.controlBackground, colors.red] }) }]}>
        <Animated.Text style={[styles.choiceText, archivo(selected), { color: position.interpolate({ inputRange: [0, 1], outputRange: [colors.charcoal, colors.onColor] }) }]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  </Animated.View>
}

export default function ProjectionChart({ projection }: Readonly<{ projection: DepreciationProjection }>) {
  const reduce = useReduceMotion()
  const [width, setWidth] = useState(350)
  const { values, coordinates } = chartGeometry(projection, width, 200)
  const [selected, setSelected] = useState(() => Math.max(0, values.findIndex(point => point.years === 3)))
  const current = values[selected]
  const point = coordinates[selected]
  const x = useAnimatedValue(point.x)
  const y = useAnimatedValue(point.y)
  const reveal = useAnimatedValue(0)
  const readout = useAnimatedValue(1)
  const selectedRef = useRef(selected)
  const touch = useRef({ x: 0, y: 0 })
  const baseline = 200 * 200 / 240
  const maximum = Math.max(...values.map(value => value.value))
  const retained = selected === 0 ? 100 : projection.points[selected - 1].retained_percent
  // Interpolate the supplied points with bounded tangents; never calculate another forecast.
  const slopes = coordinates.slice(1).map((p, i) => (p.y - coordinates[i].y) / (p.x - coordinates[i].x))
  const tangent = (i: number) => {
    const left = slopes[Math.max(0, i - 1)] ?? 0
    const right = slopes[Math.min(i, slopes.length - 1)] ?? 0
    return left * right <= 0 ? 0 : Math.sign(left) * Math.min(Math.abs(left), Math.abs(right))
  }
  const path = coordinates.reduce((line, p, index) => {
    if (index === 0) return `M${p.x},${p.y}`
    const previous = coordinates[index - 1]
    const handle = (p.x - previous.x) / 3
    return `${line} C${previous.x + handle},${previous.y + tangent(index - 1) * handle} ${p.x - handle},${p.y - tangent(index) * handle} ${p.x},${p.y}`
  }, '')
  useEffect(() => {
    const motion = Animated.parallel([x, y].map((value, index) => Animated.timing(value, {
      toValue: index === 0 ? point.x : point.y, duration: reduce ? 0 : 280,
      easing: Easing.bezier(.77, 0, .175, 1), useNativeDriver: true,
    })))
    motion.start()
    return () => motion.stop()
  }, [x, y, point.x, point.y, reduce])
  useEffect(() => {
    reveal.setValue(reduce ? 1 : 0)
    const motion = Animated.timing(reveal, { toValue: 1, duration: reduce ? 0 : 1600,
      easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true })
    motion.start()
    return () => motion.stop()
  }, [reveal, reduce])
  useEffect(() => {
    readout.setValue(reduce ? 1 : .65)
    const motion = Animated.timing(readout, { toValue: 1, duration: reduce ? 0 : 200, useNativeDriver: true })
    motion.start()
    return () => motion.stop()
  }, [readout, selected, reduce])
  const choose = (index: number) => {
    if (selectedRef.current === index) return
    selectedRef.current = index
    setSelected(index)
  }
  const selectAt = (location: number) => choose(coordinates.reduce((best, p, index) =>
    Math.abs(p.x - location) < Math.abs(coordinates[best].x - location) ? index : best, 0))
  return <>
    <Animated.View testID="projection-selection" accessibilityLiveRegion="polite" style={[styles.readout, { opacity: readout }]}>
      <Text style={[styles.note, archivo()]}>{current.years === 0 ? 'Valor actual' : `En ${yearLabel(current.years)}`}</Text>
      <Text style={[styles.amount, archivo(true)]}>{formatPrice(current.value, projection.currency)}</Text>
      <Text style={styles.note}>Conserva el {formatPercent(retained)} del valor publicado</Text>
    </Animated.View>
    <View style={styles.chart} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View accessible accessibilityRole="image" accessibilityLabel={depreciationCopy.chartLabel}>
        <Svg width={width} height={200}>
          <Defs><LinearGradient id="projection-fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.red} stopOpacity={0.27} /><Stop offset="1" stopColor={colors.red} stopOpacity={0} />
          </LinearGradient></Defs>
          {[0, .5, 1].map(ratio => <G key={ratio}>
            <Path d={`M13,${baseline - ratio * 133.33} H${width - 13}`} stroke={colors.borderDefault} strokeWidth={0.7} />
            <SvgText x={width - 13} y={baseline - ratio * 133.33 - 7} textAnchor="end" fontSize={10} fill={colors.textSecondary}>{formatPrice(maximum * ratio, projection.currency)}</SvgText>
          </G>)}
          <Path d={`${path} L${coordinates.at(-1)!.x},${baseline} L${coordinates[0].x},${baseline} Z`} fill="url(#projection-fill)" />
          <Path d={path} fill="none" stroke={colors.red} strokeWidth={3} />
          {coordinates.map((p, index) => <G key={values[index].years}>
            <Circle cx={p.x} cy={p.y} r={3} fill={colors.surface} stroke={colors.red} strokeWidth={1.5} />
            <SvgText x={p.x} y={193} textAnchor={index === 0 ? 'start' : index === values.length - 1 ? 'end' : 'middle'} fontSize={11} fill={colors.textSecondary}>{values[index].years === 0 ? 'Hoy' : yearLabel(values[index].years)}</SvgText>
          </G>)}
        </Svg>
      </View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 1, height: baseline, backgroundColor: colors.red, opacity: .3,
        transform: [{ translateX: x }, { translateY: Animated.divide(y, 2) }, { scaleY: Animated.subtract(1, Animated.divide(y, baseline)) }] }} />
      <Animated.View pointerEvents="none" style={[styles.marker, { transform: [{ translateX: x }, { translateY: y }] }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover, { transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) }] }]} />
      <View style={StyleSheet.absoluteFill} testID="projection-touch" onTouchStart={event => { touch.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY } }}
        onMoveShouldSetResponder={event => Math.abs(event.nativeEvent.pageX - touch.current.x) > Math.abs(event.nativeEvent.pageY - touch.current.y) + 6}
        onResponderMove={event => selectAt(event.nativeEvent.locationX)} onResponderRelease={event => selectAt(event.nativeEvent.locationX)}
        onTouchEnd={event => { if (Math.abs(event.nativeEvent.pageY - touch.current.y) < 8) selectAt(event.nativeEvent.locationX) }} />
    </View>
    <View style={styles.years}>{values.map((value, index) => <YearChoice key={value.years} label={value.years === 0 ? 'Hoy' : yearLabel(value.years)}
      selected={selected === index} before={index === selected - 1} after={index === selected + 1} first={index === 0} last={index === values.length - 1} onPress={() => choose(index)} />)}</View>
    <Text style={styles.note}>Tocá un año o recorré el gráfico con el dedo.</Text>
  </>
}

const styles = StyleSheet.create({
  readout: { gap: 5, marginTop: 6 },
  amount: { color: colors.charcoal, fontSize: 34, fontVariant: ['tabular-nums'] },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  chart: { marginHorizontal: -12, overflow: 'hidden' },
  marker: { position: 'absolute', top: -9, left: -9, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.red },
  cover: { backgroundColor: colors.surface },
  years: { flexDirection: 'row', width: '100%', maxWidth: 280, alignSelf: 'center', marginVertical: 8 },
  choice: { minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  choiceText: { fontSize: 12 },
})
