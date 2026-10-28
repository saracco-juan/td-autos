import { StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import { colors, radii, shadows } from '../../theme/tokens'
import { explainConcept, type Concept } from '@shared/costs/explainConcept'
import { formatDate } from '@shared/costs/format'
import type { OwnershipCosts } from '@shared/costs/types'
import { formatPrice } from '@shared/recommendations/format'
import CostRow from './CostRow'

const perMonth = (value: number) => `${formatPrice(value)} por mes`

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
  const { monthly, yearly, breakdown } = data
  const info = (name: string, concept: Concept, amount: number | null) => ({ name, text: explainConcept(concept, breakdown, amount) })
  // Electric cars have no fuel to price yet: charging costs are announced, not estimated.
  const electric = data.vehicle.fuel === 'electrico'
  const fuelValue = monthly.fuel === null ? (electric ? 'Próximamente' : 'No podemos estimarlo') : perMonth(monthly.fuel)
  return (
    <Panel title="PARA MANTENERLO" testID="costs-monthly">
      <CostRow
        label="Combustible"
        value={fuelValue}
        info={info('Combustible', electric && monthly.fuel === null ? 'charging' : 'fuel', monthly.fuel)}
      />
      <CostRow label="Seguro" value={perMonth(monthly.insurance)} info={info('Seguro', 'insurance', monthly.insurance)} />
      <CostRow label="Patente" value={perMonth(monthly.patente)} info={info('Patente', 'patente', monthly.patente)} />
      <CostRow label="Total por mes" value={formatPrice(monthly.total)} strong />
      <CostRow label="Service (por año)" value={formatPrice(yearly.service)} info={info('Service', 'service', yearly.service)} />
      <CostRow label="Total por año" value={formatPrice(yearly.total)} strong />
      {monthly.not_estimated.includes('fuel') ? (
        <Text style={styles.note}>{electric ? 'El total no incluye la carga del auto.' : 'El total no incluye el combustible.'}</Text>
      ) : null}
    </Panel>
  )
}

// "Para comprarlo" (Figma 06 / 06b): the big total, the published price and the transfer, and the budget message.
export function PurchasePanel({ data }: Readonly<{ data: OwnershipCosts }>) {
  const { purchase, vehicle, exchange_rate: rate, breakdown } = data
  const budget = purchase.budget
  const usd = vehicle.published_currency === 'USD' && rate ? { published: vehicle.published_price, rate: rate.sell } : undefined
  return (
    <Panel title="PARA COMPRARLO" testID="costs-purchase">
      <View style={styles.total}>
        <Text style={styles.totalAmount}>{formatPrice(purchase.total)}</Text>
        <Text style={styles.note}>Precio más transferencia</Text>
      </View>
      <CostRow
        label="Precio publicado"
        value={formatPrice(purchase.price)}
        info={usd ? { name: 'Precio publicado', text: explainConcept('price', breakdown, purchase.price, usd) } : undefined}
      />
      {usd && rate ? (
        <Text style={styles.note}>
          Publicado en {formatPrice(vehicle.published_price, 'USD')}, al dólar oficial venta de {formatPrice(rate.sell)} ({formatDate(rate.updated_at)}).
        </Text>
      ) : null}
      <CostRow
        label="Transferencia"
        value={formatPrice(purchase.transfer)}
        info={{ name: 'Transferencia', text: explainConcept('transfer', breakdown, purchase.transfer) }}
      />
      {budget ? (
        <Alert variant={budget.fits ? 'success' : 'warning'}>
          {budget.fits
            ? `Entra en tu presupuesto (te sobran ${formatPrice(budget.difference)}).`
            : `Supera tu presupuesto por ${formatPrice(Math.abs(budget.difference))}.`}
        </Alert>
      ) : null}
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
