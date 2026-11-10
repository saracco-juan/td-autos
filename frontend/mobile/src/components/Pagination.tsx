import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { buildPageItems } from '@shared/pagination/pageItems'
import { colors, radii, shadows } from '../theme/tokens'

type Props = { page: number; lastPage: number; onChange: (page: number) => void }

// Figma pager (‹ 1 2 3 … N ›): one segmented group, the current page in the table header tone (docs/design.md).
export default function Pagination({ page, lastPage, onChange }: Readonly<Props>) {
  const items = buildPageItems(page, lastPage, 1)
  return (
    <View accessibilityLabel="Paginación" style={styles.group}>
      <Arrow name="chevron-back" label="Página anterior" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      {items.map((item) =>
        typeof item === 'number' ? (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityLabel={`Página ${item}`}
            accessibilityState={{ selected: item === page }}
            onPress={() => {
              if (item !== page) onChange(item)
            }}
            style={[styles.item, item === page && styles.current]}
          >
            <Text style={[styles.text, item === page && styles.currentText]}>{item}</Text>
          </Pressable>
        ) : (
          <View key={item} style={styles.item}>
            <Text style={styles.text}>…</Text>
          </View>
        ),
      )}
      <Arrow name="chevron-forward" label="Página siguiente" disabled={page >= lastPage} onPress={() => onChange(page + 1)} />
    </View>
  )
}

function Arrow({ name, label, disabled, onPress }: Readonly<{
  name: 'chevron-back' | 'chevron-forward'; label: string; disabled: boolean; onPress: () => void
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.item}
    >
      <Ionicons name={name} size={16} color={disabled ? colors.borderInput : colors.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.soft,
  },
  item: {
    minWidth: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderDefault,
  },
  current: { backgroundColor: colors.surfaceRaised },
  text: { color: colors.textSecondary, fontSize: 14 },
  currentText: { color: colors.textPrimary, fontWeight: '600' },
})
