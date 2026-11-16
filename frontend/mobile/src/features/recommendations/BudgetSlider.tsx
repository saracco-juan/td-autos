import { useState } from 'react'
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'

import { formatPrice, groupThousands } from '@shared/recommendations/format'
import { archivo } from '../../theme/archivo'
import { colors } from '../../theme/tokens'
import VehicleSilhouette from '../diagnosis/VehicleSilhouette'

const CAR_WIDTH = 52

type Props = {
  value: string
  maximum: number
  onChange: (value: string) => void
  onDrag: (dragging: boolean) => void
}

export default function BudgetSlider({ value, maximum, onChange, onDrag }: Readonly<Props>) {
  const [width, setWidth] = useState(0)
  const track = Math.max(0, width - CAR_WIDTH)
  const number = Number(value.trim().replaceAll('.', ''))
  const hasPrice = value.trim() !== '' && Number.isFinite(number) && number >= 0
  const amount = hasPrice ? Math.min(number, maximum) : maximum
  const offset = track * amount / maximum
  const step = Math.max(1, 10 ** Math.floor(Math.log10(maximum / 100)))

  const move = (event: GestureResponderEvent) => {
    if (!track) return
    const fraction = Math.max(0, Math.min(1, (event.nativeEvent.locationX - CAR_WIDTH / 2) / track))
    const price = Math.min(maximum, Math.round(fraction * maximum / step) * step)
    onChange(fraction === 1 ? '' : groupThousands(price))
  }

  return (
    <View>
      <Text style={[styles.label, archivo(true)]}>Presupuesto (ARS)</Text>
      <View accessible accessibilityRole="adjustable" accessibilityLabel="Presupuesto máximo"
        accessibilityValue={{ min: 0, max: maximum, now: amount, text: hasPrice ? formatPrice(number) : 'Sin límite' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent: { actionName } }) => {
          if (actionName === 'increment') onChange(amount + step >= maximum ? '' : groupThousands(amount + step))
          if (actionName === 'decrement') onChange(groupThousands(Math.max(0, amount - step)))
        }}
        onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={event => { onDrag(true); move(event) }}
        onResponderMove={move}
        onResponderTerminationRequest={() => false}
        onResponderRelease={() => onDrag(false)} onResponderTerminate={() => onDrag(false)}
        style={styles.touch}>
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.fill, { width: offset }]} />
        </View>
        <View pointerEvents="none" style={[styles.car, { transform: [{ translateX: offset }] }]}>
          <VehicleSilhouette shape="sport" width={CAR_WIDTH} color={colors.red} />
        </View>
      </View>
      <View style={styles.limits}>
        <Text style={styles.note}>$ 0</Text><Text style={styles.note}>Sin límite</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { color: colors.textPrimary, fontSize: 16 },
  touch: { height: 46, justifyContent: 'center' },
  track: { position: 'absolute', left: CAR_WIDTH / 2, right: CAR_WIDTH / 2, top: 32, height: 3,
    borderRadius: 2, backgroundColor: colors.borderDefault },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.red },
  car: { position: 'absolute', top: 15, left: 0 },
  limits: { flexDirection: 'row', justifyContent: 'space-between' },
  note: { color: colors.textSecondary, fontSize: 12 },
})
