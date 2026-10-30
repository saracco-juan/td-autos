import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg'

import { chartGeometry, depreciationCopy, formatPercent, mileageDescription, referenceLines, yearLabel } from '@shared/depreciation/presentation'
import type { DepreciationProjection, DepreciationReference } from '@shared/depreciation/types'
import { formatPrice } from '@shared/recommendations/format'
import { colors, radii, shadows } from '../../theme/tokens'

type Props = { projection: DepreciationProjection; reference: DepreciationReference; kilometers: number | null }

function ProjectionChart({ projection }: Readonly<{ projection: DepreciationProjection }>) {
  const { values, coordinates, path } = chartGeometry(projection, 316, 190)
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={depreciationCopy.chartLabel}>
      <Svg width="100%" height={190} viewBox="0 0 316 190">
        <Path d={`${path} L303,158 L13,158 Z`} fill={colors.textSecondary} fillOpacity={0.12} />
        <Path d="M13,158 H303" stroke={colors.borderDefault} />
        <Path d={path} fill="none" stroke={colors.charcoal} strokeWidth={2.5} />
        {values.map((point, index) => {
          const { x, y } = coordinates[index]
          const anchor = index === 0 ? 'start' : index === values.length - 1 ? 'end' : 'middle'
          return <G key={point.years}>
            <Circle cx={x} cy={y} r={3.5} fill={colors.charcoal} />
            <SvgText x={x} y={182} textAnchor={anchor} fontSize={11} fill={colors.textSecondary}>
              {point.years === 0 ? 'Hoy' : yearLabel(point.years)}
            </SvgText>
          </G>
        })}
      </Svg>
    </View>
  )
}

export default function DepreciationResult({ projection, reference, kilometers }: Readonly<Props>) {
  const rows = [
    { label: 'Valor actual', value: formatPrice(projection.current_value, projection.currency) },
    ...projection.points.map(point => ({ label: `En ${yearLabel(point.years)}`,
      value: `${formatPrice(point.value, projection.currency)} · ${formatPercent(point.retained_percent)}` })),
  ]
  return (
    <View style={styles.body}>
      <View style={styles.chartCard}>
        <Text accessibilityRole="header" style={styles.chartTitle}>Valor proyectado en el tiempo</Text>
        <ProjectionChart projection={projection} />
        <View style={styles.legend}>
          <View style={styles.swatch} />
          <Text style={[styles.note, styles.flex]}>{depreciationCopy.legend}</Text>
        </View>
      </View>
      <View accessibilityLabel="Valor proyectado" style={styles.card}>
        <Text accessibilityRole="header" style={styles.summaryTitle}>VALOR PROYECTADO</Text>
        {rows.map((row, index) => <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, index === 0 && styles.strong]}>{row.value}</Text>
        </View>)}
        <Text style={styles.summaryNote}>{depreciationCopy.retained}</Text>
      </View>
      <View style={styles.explanation}>
        <Text accessibilityRole="header" style={styles.caption}>CÓMO SE CALCULA</Text>
        <View style={styles.infoCard}>
          <Text accessibilityRole="header" style={styles.infoTitle}>Referencias del vehículo</Text>
          {referenceLines(reference).map(line => <Text key={line} style={styles.note}>{line}</Text>)}
        </View>
        <View style={styles.infoCard}>
          <Text accessibilityRole="header" style={styles.infoTitle}>Estado de la unidad</Text>
          <Text style={styles.note}>{mileageDescription(kilometers)}</Text>
          <Text style={styles.note}>{depreciationCopy.condition}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Depreciación anual estimada</Text>
          <Text style={[styles.value, styles.strong]}>{formatPercent(projection.annual_depreciation_percent)} anual</Text>
        </View>
        {projection.annual_depreciation_percent < 0 ? <Text style={styles.note}>{depreciationCopy.appreciation}</Text> : null}
        {reference.stale ? <Text accessibilityLiveRegion="polite" style={styles.note}>{depreciationCopy.stale}</Text> : null}
        <Text style={styles.note}>{depreciationCopy.caveat}</Text>
      </View>
    </View>
  )
}

const card = {
  borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radii.card,
  backgroundColor: colors.surface, ...shadows.card,
}

const styles = StyleSheet.create({
  body: { gap: 32 },
  card,
  chartCard: { ...card, padding: 20, gap: 16 },
  infoCard: { ...card, padding: 16, gap: 8 },
  chartTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  infoTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  summaryTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', padding: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
    gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.borderDefault },
  label: { color: colors.textSecondary, fontSize: 13, flexShrink: 1 },
  value: { color: colors.textPrimary, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  strong: { fontWeight: '700' },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  summaryNote: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, padding: 16 },
  explanation: { gap: 24 },
  caption: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 16, height: 3, backgroundColor: colors.charcoal },
  flex: { flex: 1 },
})
