import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import Pagination from '../../components/Pagination'
import { colors, radii, shadows } from '../../theme/tokens'

type Props = { page: number; lastPage: number; size: number;
  onPage: (page: number) => void; onSize: (size: number) => void }

export default function FavoritesPager({ page, lastPage, size, onPage, onSize }: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.row}>
      <Pagination page={page} lastPage={lastPage} onChange={onPage} />
      <Text style={styles.label}>Mostrar</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Mostrar ${size}`} accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)} style={styles.select}>
        <Text style={styles.label}>{size}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>
      {open ? <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar opciones de cantidad"
            style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.menu}>
            {[6, 12, 24].map((value) => <Pressable key={value} accessibilityRole="button"
              accessibilityLabel={`Mostrar ${value} vehículos`} accessibilityState={{ selected: value === size }}
              style={styles.option} onPress={() => { setOpen(false); onSize(value) }}>
              <Text style={styles.label}>{value}</Text>
            </Pressable>)}
          </View>
        </View>
      </Modal> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  label: { color: colors.textSecondary, fontSize: 14 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    height: 34, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radii.button, backgroundColor: colors.surface, ...shadows.soft },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: { width: '70%', maxWidth: 280, padding: 8, borderRadius: radii.card, backgroundColor: colors.surface },
  option: { minHeight: 44, padding: 12, justifyContent: 'center' },
})
