import { Ionicons } from '@expo/vector-icons'
import { useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import Button from '../../components/Button'
import { colors, radii, shadows } from '../../theme/tokens'

// The Figma info action opens a dismissible explanation without moving the list.
export default function PortalInfo({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} hitSlop={12}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
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
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#00000066' },
  dialog: { maxHeight: '80%', padding: 20, gap: 16, backgroundColor: colors.surface, borderRadius: radii.card, ...shadows.card },
  content: { gap: 12 },
})
