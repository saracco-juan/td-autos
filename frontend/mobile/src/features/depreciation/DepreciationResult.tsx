import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, useAnimatedValue, View } from 'react-native'
import ProjectionChart from './ProjectionChart'
import useReduceMotion from '../../lib/useReduceMotion'
import { archivo } from '../../theme/archivo'

import { depreciationCopy, formatPercent, mileageDescription, referenceLines, yearLabel } from '@shared/depreciation/presentation'
import type { DepreciationProjection, DepreciationReference } from '@shared/depreciation/types'
import { formatPrice } from '@shared/recommendations/format'
import { colors } from '../../theme/tokens'

type Props = { projection: DepreciationProjection; reference: DepreciationReference; kilometers: number | null }

export default function DepreciationResult({ projection, reference, kilometers }: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(0)
  const reduce = useReduceMotion()
  const expansion = useAnimatedValue(0)
  useEffect(() => {
    const motion = Animated.timing(expansion, { toValue: open ? 1 : 0, duration: reduce ? 0 : 300,
      easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: false })
    motion.start()
    return () => motion.stop()
  }, [open, expansion, reduce])
  const rows = [
    { label: 'Valor actual', value: formatPrice(projection.current_value, projection.currency) },
    ...projection.points.map(point => ({ label: `En ${yearLabel(point.years)}`,
      value: `${formatPrice(point.value, projection.currency)} · ${formatPercent(point.retained_percent)}` })),
  ]
  return (
    <View style={styles.body}>
      <View style={styles.chartCard}>
        <Text accessibilityRole="header" style={[styles.chartTitle, archivo(true)]}>Valor proyectado en el tiempo</Text>
        <View style={styles.rate}>
          <Text style={styles.note}>Depreciación anual estimada</Text>
          <Text style={[styles.value, archivo(true)]}>{formatPercent(projection.annual_depreciation_percent)} anual</Text>
        </View>
        <ProjectionChart projection={projection} />
      </View>
      <View accessibilityLabel="Valor proyectado">
        <Text accessibilityRole="header" style={[styles.summaryTitle, archivo(true)]}>Valor proyectado</Text>
        {rows.map((row, index) => <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, index === 0 && styles.strong]}>{row.value}</Text>
        </View>)}
        <Text style={styles.summaryNote}>{depreciationCopy.retained}</Text>
      </View>
      <View style={styles.explanation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cómo se calcula" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.rate}>
          <Text style={[styles.chartTitle, archivo(true)]}>Cómo se calcula</Text>
          <Animated.View style={{ transform: [{ rotate: expansion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Ionicons name="chevron-down" size={18} color={colors.charcoal} />
          </Animated.View>
        </Pressable>
        <Animated.View aria-hidden={!open} pointerEvents={open ? 'auto' : 'none'} style={{ height: Animated.multiply(expansion, height), overflow: 'hidden' }}>
        <View style={styles.measured} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
        <View style={styles.infoCard}>
          <Text accessibilityRole="header" style={[styles.infoTitle, archivo(true)]}>Referencias del vehículo</Text>
          {referenceLines(reference).map(line => <Text key={line} style={styles.note}>{line}</Text>)}
        </View>
        <View style={styles.infoCard}>
          <Text accessibilityRole="header" style={[styles.infoTitle, archivo(true)]}>Estado de la unidad</Text>
          <Text style={styles.note}>{mileageDescription(kilometers)}</Text>
          <Text style={styles.note}>{depreciationCopy.condition}</Text>
        </View>
        </View>
        </Animated.View>
        {projection.annual_depreciation_percent < 0 ? <Text style={styles.note}>{depreciationCopy.appreciation}</Text> : null}
        {reference.stale ? <Text accessibilityLiveRegion="polite" style={styles.note}>{depreciationCopy.stale}</Text> : null}
        <Text style={styles.note}>{depreciationCopy.caveat}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { gap: 32 },
  chartCard: { gap: 16 },
  infoCard: { gap: 8 },
  chartTitle: { color: colors.charcoal, fontSize: 21 },
  infoTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  summaryTitle: { color: colors.charcoal, fontSize: 21, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
    gap: 8, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault },
  label: { color: colors.textSecondary, fontSize: 13, flexShrink: 1 },
  value: { color: colors.textPrimary, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  strong: { fontWeight: '700' },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  summaryNote: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12 },
  explanation: { gap: 24 },
  rate: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44 },
  measured: { position: 'absolute', top: 0, left: 0, right: 0, gap: 20 },
})
