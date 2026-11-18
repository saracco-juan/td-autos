import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, useAnimatedValue, View } from 'react-native'

import type { StepProgress } from '@shared/checklist/progress'
import { archivo } from '../../theme/archivo'
import { colors } from '../../theme/tokens'

type Props = {
  step: StepProgress
  open: boolean
  reduceMotion: boolean
  pendingLabel: string
  onPress: () => void
  children: ReactNode
}

export default function StepSection({ step, open, reduceMotion, pendingLabel, onPress, children }: Readonly<Props>) {
  const [height, setHeight] = useState(0)
  const position = useAnimatedValue(open ? 1 : 0)
  useEffect(() => {
    const target = open ? 1 : 0
    if (reduceMotion) { position.setValue(target); return }
    const motion = Animated.timing(position, {
      toValue: target, duration: open ? 440 : 280, easing: Easing.bezier(.35, .12, .27, 1), useNativeDriver: false,
    })
    motion.start()
    return () => motion.stop()
  }, [open, position, reduceMotion])

  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onPress}
        accessibilityLabel={`${step.numero}. ${step.titulo}, ${step.completed} de ${step.total}${pendingLabel && ', ' + pendingLabel}`}
        style={styles.heading}>
        <Text style={[styles.title, archivo(true)]}>{step.titulo}</Text>
        {pendingLabel ? <View testID={`pending-dot-${step.numero}`} style={styles.dot} /> : null}
        <Text style={styles.count}>{step.completed} / {step.total}</Text>
        <Animated.View style={{ transform: [{ rotate: position.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </Animated.View>
      </Pressable>
      <Animated.View aria-hidden={!open} pointerEvents={open ? 'auto' : 'none'}
        style={{ overflow: 'hidden', height: Animated.multiply(position, height) }}>
        <View style={styles.body} onLayout={e => setHeight(e.nativeEvent.layout.height)}>{children}</View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 58, paddingVertical: 10 },
  title: { flex: 1, fontSize: 17, color: colors.textPrimary },
  count: { color: colors.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
  body: { position: 'absolute', top: 0, left: 0, right: 0 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red },
})
