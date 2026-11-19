import { Ionicons } from '@expo/vector-icons'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, useAnimatedValue, View } from 'react-native'

import type { ChecklistStep } from '@shared/checklist/types'
import Alert from '../Alert'
import { colors } from '../../theme/tokens'
import { archivo } from '../../theme/archivo'

type Props = {
  step: ChecklistStep
  completedCodes: ReadonlySet<string>
  reduceMotion?: boolean
  saveFailed: boolean
  flagLabel: string
  saveError: string
  onToggle: (code: string, value: boolean) => void
  // Extra content under the items, inside the card (e.g. a sources note).
  children?: ReactNode
}

export default function StepPanel({
  step,
  completedCodes,
  reduceMotion = true,
  saveFailed,
  flagLabel,
  saveError,
  onToggle,
  children,
}: Readonly<Props>) {
  const [front, setFront] = useState<string>()
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map())
  const itemsByCode = new Map(step.items.map(item => [item.codigo, item]))
  const sorted = [...step.items.filter(item => !completedCodes.has(item.codigo)),
    ...Array.from(completedCodes).flatMap(code => itemsByCode.get(code) ?? [])]
  const positions = new Map<string, number>()
  let listHeight = 0
  if (!reduceMotion && sorted.every(item => heights.has(item.codigo))) {
    for (const item of sorted) {
      positions.set(item.codigo, listHeight)
      listHeight += heights.get(item.codigo)!
    }
  }
  return (
    <View style={styles.card}>
      {step.ayuda ? <Text style={styles.hint}>{step.ayuda}</Text> : null}
      <View style={positions.size ? { height: listHeight } : undefined}>
        {sorted.map((item) => {
          const checked = completedCodes.has(item.codigo)
          return (
            <MovingRow key={item.codigo} code={item.codigo} top={positions.get(item.codigo)} front={front === item.codigo}
              onHeight={height => setHeights(current => current.get(item.codigo) === height ? current : new Map(current).set(item.codigo, height))}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={item.flagged ? `${item.texto}, ${flagLabel.toLowerCase()}` : item.texto}
                onPress={() => { setFront(item.codigo); onToggle(item.codigo, !checked) }}
                style={styles.row}
              >
                <View style={[styles.box, checked && styles.boxChecked]}>
                  {checked ? <Ionicons name="checkmark" size={16} color={colors.onColor} /> : null}
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.text, archivo(), checked && styles.textChecked]}>{item.texto}</Text>
                  {item.flagged ? <Text style={[styles.flag, archivo(true), checked && styles.muted]}>{flagLabel}</Text> : null}
                </View>
              </Pressable>
            </MovingRow>
          )
        })}
      </View>
      {children}
      {saveFailed ? <Alert variant="error">{saveError}</Alert> : null}
    </View>
  )
}

type RowProps = { code: string; top?: number; front: boolean; onHeight: (height: number) => void; children: ReactNode }

function MovingRow({ code, top, front, onHeight, children }: Readonly<RowProps>) {
  const position = useAnimatedValue(0)
  const placed = useRef(false)
  const moving = useRef(false)
  useLayoutEffect(() => {
    if (top === undefined) {
      placed.current = false
      moving.current = false
      return
    }
    if (!placed.current) {
      position.setValue(top)
      placed.current = true
      return
    }
    // Keep the native presentation position when a new destination interrupts a trip.
    const motion = Animated.timing(position, {
      toValue: top, delay: moving.current ? 0 : 480, duration: 900,
      easing: Easing.bezier(.42, 0, .24, 1), useNativeDriver: true,
    })
    moving.current = true
    motion.start(({ finished }) => { if (finished) moving.current = false })
    return () => motion.stop()
  }, [position, top])

  return (
    <Animated.View testID={`checklist-row-${code}`} onLayout={e => onHeight(e.nativeEvent.layout.height)}
      style={top === undefined ? undefined : [styles.movingRow, { zIndex: front ? 1 : 0, transform: [{ translateY: position }] }]}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  movingRow: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.surface },
  card: { gap: 6, paddingBottom: 8 },
  hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 48,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderDefault,
  },
  box: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    borderRadius: 6,
  },
  boxChecked: { backgroundColor: colors.red, borderColor: colors.red },
  copy: { flex: 1, gap: 4 },
  text: { color: colors.textPrimary, fontSize: 15, lineHeight: 20 },
  textChecked: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  flag: { fontSize: 11, color: colors.actionDanger },
  muted: { color: colors.textSecondary },
})
