import { Pressable, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import { colors } from '../../theme/tokens'
import { formatDate } from '@shared/costs/format'
import { monthlyLines, purchaseLines } from '@shared/costs/summary'
import type { OwnershipCosts } from '@shared/costs/types'
import { formatPrice } from '@shared/recommendations/format'
import CostRow from './CostRow'
import { archivo } from '../../theme/archivo'

function Panel({ title, testID, children }: Readonly<{ title: string; testID: string; children: React.ReactNode }>) {
  return (
    <View testID={testID} style={styles.panel}>
      <Text accessibilityRole="header" style={[styles.panelTitle, archivo(true)]}>
        {title}
      </Text>
      {children}
    </View>
  )
}

export function MonthlyPanel({ data, onAdjust }: Readonly<{ data: OwnershipCosts; onAdjust: () => void }>) {
  const { lines, note } = monthlyLines(data)
  const coverage = data.inputs.coverage === 'todo_riesgo' ? 'Todo riesgo' : 'Terceros completo'
  return (
    <View testID="costs-monthly" style={styles.panel}>
      <View style={styles.total}>
        <Text style={[styles.note, archivo()]}>Para mantenerlo</Text>
        <Text style={[styles.monthlyAmount, archivo(true)]}>{formatPrice(data.monthly.total)} <Text style={styles.note}>/ mes</Text></Text>
        <Text style={[styles.note, archivo()]}>{data.inputs.km_per_month.toLocaleString('es-AR')} km al mes · {coverage}</Text>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Pressable accessibilityRole="button" onPress={onAdjust} style={({ pressed }) => [styles.adjust, { opacity: pressed ? 0.65 : 1 }]}>
        <Text style={[styles.adjustText, archivo(true)]}>Ajustar estimación</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.panelTitle, archivo(true)]}>Desglose de mantenimiento</Text>
      {lines.filter((line) => line.label !== 'Total por mes').map((line) => <CostRow key={line.label} {...line} />)}
    </View>
  )
}

// "Para comprarlo" (Figma 06 / 06b): the big total, the published price and the transfer, and the budget message.
export function PurchasePanel({ data }: Readonly<{ data: OwnershipCosts }>) {
  const { lines, usdNote, budget } = purchaseLines(data, 'Precio publicado')
  return (
    <Panel title="Para comprarlo" testID="costs-purchase">
      <View style={styles.total}>
        <Text style={[styles.totalAmount, archivo(true)]}>{formatPrice(data.purchase.total)}</Text>
        <Text style={styles.note}>Precio más transferencia</Text>
      </View>
      {lines.filter((line) => !line.strong).map((line) => <CostRow key={line.label} {...line} />)}
      {usdNote ? <Text style={styles.note}>{usdNote}</Text> : null}
      {budget ? <Alert variant={budget.fits ? 'success' : 'warning'}>{budget.message}</Alert> : null}
    </Panel>
  )
}

export function Disclaimer({ data }: Readonly<{ data: OwnershipCosts }>) {
  const province = data.vehicle.province ? `, en la provincia de ${data.vehicle.province}` : ''
  return (
    <Text style={styles.disclaimer}>
      {`Estimación orientativa con valores actualizados al ${formatDate(data.rates_updated_at)}${province}. Es un estimativo aproximado.`}
    </Text>
  )
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  panelTitle: { color: colors.charcoal, fontSize: 21 },
  monthlyAmount: { color: colors.charcoal, fontSize: 38 },
  adjust: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 12 },
  adjustText: { color: colors.charcoal, fontSize: 14 },
  total: { gap: 2 },
  totalAmount: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },
  note: { color: colors.textSecondary, fontSize: 13 },
  disclaimer: { color: colors.textSecondary, fontSize: 12 },
})
