import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { feedbackMotion, feedbackTimer, type FeedbackProps } from '@shared/feedback/feedback'
import useReduceMotion from '../lib/useReduceMotion'
import { archivo } from '../theme/archivo'

type Props = FeedbackProps & { bottom?: number }
export default function Feedback(props: Props) {
  return props.message ? <Notification {...props} /> : null
}
function Notification({ message, variant = 'success', onRetry, bottom = 0 }: Props) {
  const insets = useSafeAreaInsets()
  const reduced = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(0))
  const [closing, setClosing] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [previous, setPrevious] = useState({ message, variant })
  if (previous.message !== message || previous.variant !== variant) {
    setPrevious({ message, variant })
    setClosing(false)
    setHidden(false)
  }
  const [clock] = useState(() => feedbackTimer(() => setClosing(true)))
  useEffect(() => {
    clock.reset()
    let mounted = true
    let reader = true
    const sync = () => {
      if (variant === 'success' && !reader && AppState.currentState === 'active') clock.resume()
      else clock.pause()
    }
    void Promise.resolve(AccessibilityInfo.isScreenReaderEnabled()).then((enabled) => { if (mounted) { reader = typeof enabled === 'boolean' ? enabled : true; sync() } }).catch(() => {})
    const accessibility = AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => { reader = enabled; sync() })
    const app = AppState.addEventListener('change', sync)
    return () => { mounted = false; clock.pause(); app?.remove(); accessibility?.remove() }
  }, [clock, variant, message])
  useEffect(() => {
    if (closing) clock.pause()
    const animation = Animated.timing(progress, { toValue: closing ? 0 : 1, duration: feedbackMotion.duration,
      easing: Easing.bezier(...feedbackMotion.easing), useNativeDriver: true })
    animation.start(({ finished }) => { if (finished && closing) setHidden(true) })
    return () => animation.stop()
  }, [closing, clock, progress, message, variant])
  if (hidden) return null
  const accent = variant === 'success' ? '#1e7f45' : '#b42318'
  return <Animated.View style={[styles.toast, { bottom: Math.max(bottom, insets.bottom) + 12, opacity: progress,
    transform: reduced ? [] : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [.97, 1] }) }] }]}>
    <View style={[styles.icon, { backgroundColor: variant === 'success' ? '#e3f4ea' : '#fde8e4' }]}>
      <Ionicons name={variant === 'success' ? 'checkmark' : 'close'} size={20} color={accent} />
    </View>
    <View style={styles.content}>
      <Text accessibilityRole="alert" accessibilityLiveRegion={variant === 'error' ? 'assertive' : 'polite'} style={[styles.text, archivo()]}>{message}</Text>
      {variant === 'error' && onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={[archivo(true), { color: accent, fontSize: 11 }]}>REINTENTAR</Text></Pressable> : null}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar notificación" onPress={() => setClosing(true)} style={styles.close}>
      <Ionicons name="close" size={20} color="#666" />
    </Pressable>
  </Animated.View>
}
const styles = StyleSheet.create({
  toast: { position: 'absolute', left: 16, right: 16, zIndex: 100, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#e6e6e6', backgroundColor: '#fff', boxShadow: '0 8px 28px #00000014' },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  text: { color: '#242424', fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
