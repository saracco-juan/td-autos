import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, shadows } from '../theme/tokens'

type Props = {
  title: string
  /** Accessible name of the dimmed area that closes the sheet. */
  backdropLabel: string
  /** Accessible name and icon of the round button at the right of the title. */
  closeLabel: string
  closeIcon: 'close' | 'chevron-back'
  onClose: () => void
  children: ReactNode
}

// Shell of the bottom sheets (FILTROS, TU DIAGNÓSTICO): dimmed backdrop, rounded sheet with a handle, and a header
// with the title and a round close button. The content goes below, usually in its own ScrollView.
export default function BottomSheet({ title, backdropLabel, closeLabel, closeIcon, onClose, children }: Readonly<Props>) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel={backdropLabel} style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={styles.close}>
            <Ionicons name={closeIcon} size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        {children}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 17, 17, 0.35)' },
  sheet: {
    maxHeight: '85%',
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginVertical: 8,
    borderRadius: 2,
    backgroundColor: colors.borderDefault,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
})
