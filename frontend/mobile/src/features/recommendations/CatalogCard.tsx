import { Ionicons } from '@expo/vector-icons'
import { Children, useState, type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { archivo } from '../../theme/archivo'
import { colors, radii } from '../../theme/tokens'

export function CatalogGrid({ children }: { children: ReactNode }) {
  return (
    <View style={styles.grid}>
      {Children.map(children, child => <View style={styles.cell}>{child}</View>)}
    </View>
  )
}

type Props = {
  label: string
  title: string
  photo?: string | null
  overlay?: ReactNode
  children: ReactNode
}

export function CatalogCard({ label, title, photo, overlay, children }: Props) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  return (
    <View accessibilityLabel={label} style={styles.card}>
      <View style={styles.media}>
        {photo && failedPhoto !== photo ? (
          <Image key={photo} accessibilityLabel={`Foto de ${title}`} source={{ uri: photo }}
            resizeMode="cover" style={StyleSheet.absoluteFill} onError={() => setFailedPhoto(photo)} />
        ) : <Text style={[styles.placeholder, archivo()]}>Sin fotos</Text>}
        <View pointerEvents="none" aria-hidden style={styles.fade}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="shade" x1="0" y1="0" x2="0" y2="100%">
              <Stop offset="0" stopColor={colors.charcoal} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.charcoal} />
            </LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#shade)" />
          </Svg>
        </View>
        {overlay && <View style={styles.overlay}>{overlay}</View>}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  )
}

export function CatalogAction({ label, onPress, selected }: {
  label: string; onPress: () => void; selected?: boolean
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [styles.action, selected !== undefined && styles.compare, pressed && styles.pressed]}>
      {selected === undefined ? <Text style={[styles.actionLabel, archivo(true)]}>{label}</Text>
        : <Ionicons name={selected ? 'checkmark-circle' : 'git-compare-outline'} size={20} color={colors.onColor} />}
    </Pressable>
  )
}

export const catalog = StyleSheet.create({
  title: { color: colors.onColor, fontSize: 17, lineHeight: 21, letterSpacing: -0.3 },
  meta: { color: colors.surfaceRaised, fontSize: 12, lineHeight: 17 },
  price: { color: colors.onColor, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  dealerActions: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { marginTop: 'auto', gap: 5, paddingTop: 6 },
})

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginHorizontal: -4 },
  cell: { width: '50%', paddingHorizontal: 4 },
  card: { flexGrow: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.charcoal },
  media: { aspectRatio: 4 / 3, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },
  overlay: { position: 'absolute', top: 6, right: 6, maxWidth: '90%' },
  placeholder: { color: colors.textSecondary, fontSize: 12 },
  content: { flexGrow: 1, gap: 5, padding: 10, paddingTop: 3 },
  action: { flexGrow: 1, minHeight: 44, paddingHorizontal: 6, paddingVertical: 7, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.button, backgroundColor: colors.red },
  compare: { width: 44, flexGrow: 0, backgroundColor: 'transparent', borderColor: colors.borderDefault, borderWidth: 1 },
  pressed: { opacity: 0.78 },
  actionLabel: { color: colors.onColor, fontSize: 12, textAlign: 'center' },
})
