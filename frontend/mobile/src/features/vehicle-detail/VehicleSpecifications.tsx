import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { detailSections } from '@shared/vehicles/detail'
import { colors, radii, shadows } from '../../theme/tokens'
import type { BuyerVehicle } from './types'

// Four section tabs (general, engine, safety, comfort); only the selected section's rows are listed. React Native
// has no hover, so each explanation is printed under its label. The dealer description is always shown below.
export default function VehicleSpecifications({ vehicle }: Readonly<{ vehicle: BuyerVehicle }>) {
  const sections = detailSections(vehicle)
  const [selected, setSelected] = useState(sections[0].title)
  const section = sections.find(({ title }) => title === selected) ?? sections[0]

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
        Especificaciones técnicas
      </Text>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {sections.map(({ title }) => (
          <Pressable
            key={title}
            accessibilityRole="tab"
            accessibilityLabel={title}
            accessibilityState={{ selected: title === section.title }}
            onPress={() => setSelected(title)}
            style={[styles.tab, title === section.title && styles.tabSelected]}
          >
            <Text style={[styles.tabLabel, title === section.title && styles.tabLabelSelected]}>{title}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.rows}>
        {section.rows.map(({ label, value, explanation }) => (
          <View key={label} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{label}</Text>
              {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
            </View>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.description}>
        <Text accessibilityRole="header" style={styles.descriptionTitle}>
          Descripción de la concesionaria
        </Text>
        <Text style={styles.explanation}>{vehicle.descripcion?.trim() || 'Descripción no disponible.'}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  heading: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  // Tabs wrap onto a second line at narrow widths.
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  tabSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  tabLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  tabLabelSelected: { color: colors.onColor },
  rows: { gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  label: { color: colors.textPrimary, fontSize: 14 },
  explanation: { color: colors.textSecondary, fontSize: 12 },
  value: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', textAlign: 'right', maxWidth: '40%' },
  description: { gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderDefault },
  descriptionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
})
