import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PORTAL_MODELS_NOTICE, portalTabLabel } from '@shared/portals/format'
import { colors } from '../../theme/tokens'
import PortalInfo from './PortalInfo'

type Props = { portals: boolean; count: number | null; onChange: (portals: boolean) => void }

export default function PortalTabs({ portals, count, onChange }: Readonly<Props>) {
  return (
    <View style={styles.row}>
      {[{ label: 'Concesionarias', value: false }, { label: portalTabLabel(count), value: true }].map(({ label, value }) => (
        <Pressable key={String(value)} accessibilityRole="tab" accessibilityLabel={label}
          accessibilityState={{ selected: portals === value }} onPress={() => onChange(value)}
          style={[styles.tab, portals === value && styles.active]}>
          <Text style={[styles.label, portals === value && styles.selected]}>{label}</Text>
        </Pressable>
      ))}
      {portals && count !== null && count > 0 ? (
        <PortalInfo label="Sobre estos modelos"><Text style={styles.label}>{PORTAL_MODELS_NOTICE}</Text></PortalInfo>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: colors.borderDefault },
  tab: { flexShrink: 1, paddingVertical: 12, borderBottomWidth: 2, borderColor: 'transparent' },
  active: { borderColor: colors.textPrimary },
  label: { color: colors.textSecondary, fontSize: 14 },
  selected: { color: colors.textPrimary, fontWeight: '600' },
})
