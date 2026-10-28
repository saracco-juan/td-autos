import { StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import { colors, radii, shadows } from '../../theme/tokens'
import { formatDate } from '@shared/costs/format'
import { monthlyLines, purchaseLines } from '@shared/costs/summary'
import type { OwnershipCosts } from '@shared/costs/types'
import { formatPrice } from '@shared/recommendations/format'
import CostRow from './CostRow'

function Panel({ title, testID, children }: Readonly<{ title: string; testID: string; children: React.ReactNode }>) {
  return (
    <View testID={testID} style={styles.panel}>
      <Text accessibilityRole="header" style={styles.panelTitle}>
        {title}
      </Text>
      {children}
    </View>
  )
}

// "Para mantenerlo" (Figma 06): monthly concepts, the monthly total, the yearly service and the yearly total.
export function MonthlyPanel({ data }: Readonly<{ data: OwnershipCosts }>) {
  const { lines, note } = monthlyLines(data)
  return (
    <Panel title="PARA MANTENERLO" testID="costs-monthly">
      {lines.map((line) => <CostRow key={line.label} {...line} />)}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Panel>
  )
}

// "Para comprarlo" (Figma 06 / 06b): the big total, the published price and the transfer, and the budget message.
export function PurchasePanel({ data }: Readonly<{ data: OwnershipCosts }>) {
  const { lines, usdNote, budget } = purchaseLines(data, 'Precio publicado')
  return (
    <Panel title="PARA COMPRARLO" testID="costs-purchase">
      <View style={styles.total}>
        <Text style={styles.totalAmount}>{formatPrice(data.purchase.total)}</Text>
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
  panel: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  panelTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  total: { gap: 2 },
  totalAmount: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },
  note: { color: colors.textSecondary, fontSize: 13 },
  disclaimer: { color: colors.textSecondary, fontSize: 12 },
})
