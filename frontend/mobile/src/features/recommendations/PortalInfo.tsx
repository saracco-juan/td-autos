import { Ionicons } from '@expo/vector-icons'
import { useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { archivo } from '../../theme/archivo'
import Button from '../../components/Button'
import { colors, radii, shadows } from '../../theme/tokens'

// The Figma info action opens a dismissible explanation without moving the list.
export default function PortalInfo({ label, caption, warning, children }: Readonly<{ label: string; caption?: string; warning?: boolean; children: ReactNode }>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={warning ? `${caption}. Ver advertencias` : caption} onPress={() => setOpen(true)} style={caption ? styles.caption : styles.icon}>
        <Ionicons name={warning ? 'alert-circle' : 'information-circle-outline'} size={18} color={caption ? colors.onColor : colors.textSecondary} />
        {caption && <View style={styles.copy}><Text style={[styles.score, archivo()]}>{caption}</Text>
          {warning && <Text style={[styles.score, archivo(true)]}>Ver advertencias</Text>}</View>}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
            <Button label="CERRAR" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
  caption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  copy: { flexShrink: 1 },
  score: { color: colors.onColor, fontSize: 12 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#00000066' },
  dialog: { maxHeight: '80%', padding: 20, gap: 16, backgroundColor: colors.surface, borderRadius: radii.card, ...shadows.card },
  content: { gap: 12 },
})
