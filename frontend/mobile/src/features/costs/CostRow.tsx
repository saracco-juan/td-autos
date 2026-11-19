import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { archivo } from '../../theme/archivo'
import { colors, radii } from '../../theme/tokens'

export type RowInfo = { name: string; text: string }

type Props = {
  label: string
  value: string
  strong?: boolean
  info?: RowInfo
}

// One line of a cost panel. React Native has no hover, so the explanation opens on tap of the info
// icon, under the row, and a second tap closes it (docs/design.md "HU10-MOBILE calculator").
export default function CostRow({ label, value, strong = false, info }: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <View style={styles.labelGroup}>
          <Text style={[styles.label, archivo(strong)]}>{label}</Text>
          {info ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cómo calculamos ${info.name}`}
              accessibilityState={{ expanded: open }}
              hitSlop={10}
              onPress={() => setOpen((current) => !current)}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.value, archivo(strong)]}>{value}</Text>
      </View>
      {info && open ? (
        <View style={styles.tip}>
          <Text style={styles.tipText}>{info.text}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  labelGroup: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flexShrink: 1, color: colors.textPrimary, fontSize: 14 },
  value: { flexShrink: 1, textAlign: 'right', color: colors.textPrimary, fontSize: 14 },
  tip: {
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.field,
    backgroundColor: colors.background,
  },
  tipText: { color: colors.textSecondary, fontSize: 13 },
})
