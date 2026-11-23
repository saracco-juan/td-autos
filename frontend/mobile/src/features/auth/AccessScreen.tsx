import { useEffect, useState } from 'react'
import { Animated, Easing, Keyboard, Pressable, StyleSheet, Text, useAnimatedValue, useWindowDimensions, View } from 'react-native'

import AppBar from '../../components/AppBar'
import useReduceMotion from '../../lib/useReduceMotion'
import { archivo } from '../../theme/archivo'
import { colors } from '../../theme/tokens'
import LoginScreen from './LoginScreen'
import RegisterScreen from './RegisterScreen'

const modes = ['Iniciar sesión', 'Crear cuenta'] as const

// Keep both forms mounted so reversing the transition never discards a draft.
export default function AccessScreen({ initialMode = 0 }: Readonly<{ initialMode?: 0 | 1 }>) {
  const [mode, setMode] = useState(initialMode)
  const [loginBusy, setLoginBusy] = useState(false)
  const [registerBusy, setRegisterBusy] = useState(false)
  const { width: windowWidth } = useWindowDimensions()
  const [width, setWidth] = useState(windowWidth)
  const progress = useAnimatedValue(initialMode)
  const reduceMotion = useReduceMotion()
  const busy = loginBusy || registerBusy

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: mode,
      duration: reduceMotion ? 0 : 550,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [mode, progress, reduceMotion])

  const select = (next: 0 | 1) => {
    if (busy || mode === next) return
    Keyboard.dismiss()
    setMode(next)
  }

  return (
    <View style={styles.screen} onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      <AppBar />
      <View style={styles.selector}>
        <View style={styles.options}>
          {modes.map((label, index) => (
            <Pressable
              key={label}
              accessibilityRole="link"
              accessibilityState={{ selected: mode === index, disabled: busy }}
              disabled={busy}
              onPress={() => select(index as 0 | 1)}
              style={styles.option}
            >
              <Text style={[styles.label, archivo(mode === index), mode === index && styles.selected]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: (width - 48) / 2, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, (width - 48) / 2] }) }] }]}
        />
      </View>
      <View style={styles.viewport}>
        <Animated.View style={[styles.track, { width: width * 2, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }] }]}>
          {[0, 1].map((index) => (
            <View
              key={index}
              style={{ width }}
              pointerEvents={mode === index ? 'auto' : 'none'}
              accessibilityElementsHidden={mode !== index}
              importantForAccessibility={mode === index ? 'auto' : 'no-hide-descendants'}
            >
              {index === 0 ? <LoginScreen embedded onBusyChange={setLoginBusy} /> : <RegisterScreen embedded onBusyChange={setRegisterBusy} />}
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  selector: { marginHorizontal: 24, marginTop: 20 },
  options: { flexDirection: 'row' },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  label: { fontSize: 15, color: colors.textSecondary },
  selected: { color: colors.textPrimary },
  indicator: { height: 2, backgroundColor: colors.red },
  viewport: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
})
