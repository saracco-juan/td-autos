import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { comparisonGroups, type ComparisonEntry } from '@shared/comparison/groups'
import type { SpecificationRow } from '@shared/vehicles/detail'
import Button from '../../components/Button'
import { colors, radii, shadows } from '../../theme/tokens'

type Props = {
  entries: [ComparisonEntry, ComparisonEntry]
  onRemove: (id: number) => void
  onCosts: (id: number) => void
}

function Photo({ url, title }: { url?: string; title: string }) {
  const [failed, setFailed] = useState(false)
  return url && !failed ? (
    <Image source={{ uri: url }} accessibilityLabel={`Foto de ${title}`} onError={() => setFailed(true)} style={styles.photo} />
  ) : <View style={styles.photo}><Text style={styles.label}>Fotos no disponibles.</Text></View>
}

// Native rendering of the web comparison, using the same facts and calculator presentation.
export default function ComparisonCards({ entries, onRemove, onCosts }: Readonly<Props>) {
  const [section, setSection] = useState('Información general')
  const [notes, setNotes] = useState(false)
  const [heights, setHeights] = useState<Record<string, number>>({})
  const columns = entries.map(comparisonGroups)
  const measure = (key: string, height: number) => setHeights((current) =>
    (current[key] ?? 0) >= height ? current : { ...current, [key]: height })

  const facts = (rows: SpecificationRow[], prefix: string) => rows.map(({ label, value, explanation }) => (
    <View key={label} style={[styles.row, { minHeight: heights[`${prefix}:${label}`] ?? 40 }]}
      onLayout={({ nativeEvent }) => measure(`${prefix}:${label}`, nativeEvent.layout.height)}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  ))

  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: notes }}
      onPress={() => setNotes(!notes)}>
      <Text style={styles.label}>Sobre la comparación y los costos</Text>
    </Pressable>
    {notes ? <View style={styles.container}>
      <Text style={styles.label}>Los motivos reflejan tu diagnóstico, no una probabilidad de satisfacción. No indican un ganador absoluto.</Text>
      <Text style={styles.label}>Costos orientativos de la calculadora, con sus valores predeterminados. Los totales parciales excluyen los conceptos indicados.</Text>
    </View> : null}
    <ScrollView horizontal directionalLockEnabled accessibilityLabel="Comparación de vehículos"
      contentContainerStyle={styles.columns}>
      {entries.map(({ id, detail: { vehicle } }, index) => {
        const title = vehicleTitle(vehicle)
        const groups = columns[index]
        const selected = groups.find((group) => group.title === section) ?? groups[1]
        return <View key={id} accessibilityLabel={`Vehículo comparado: ${title}`} style={styles.card}>
          <Photo key={vehicle.fotos[0]?.url} url={vehicle.fotos[0]?.url} title={title} />
          <View style={[styles.intro, { minHeight: heights.intro ?? 120 }]}
            onLayout={({ nativeEvent }) => measure('intro', nativeEvent.layout.height)}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Button label="QUITAR" onPress={() => onRemove(id)} />
          </View>
          {facts(groups[0].rows, 'overview')}
          <View style={styles.sections}>
            <Text accessibilityRole="header" style={styles.heading}>Especificaciones técnicas</Text>
            <View accessibilityRole="tablist" style={styles.tabs}>
              {groups.slice(1).map(({ title: name }) => (
                <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name}
                  accessibilityState={{ selected: name === section }} onPress={() => setSection(name)}
                  style={[styles.tab, name === section && styles.selected]}>
                  <Text style={[styles.tabLabel, name === section && styles.strong]}>{name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {facts(selected.rows, selected.title)}
          <View style={styles.footer}><Button label="VER CÁLCULO COMPLETO" onPress={() => onCosts(id)} /></View>
        </View>
      })}
    </ScrollView>
  </View>
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  columns: { gap: 12, paddingBottom: 12, alignItems: 'stretch' },
  card: {
    width: 280, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radii.card,
    backgroundColor: colors.surface, overflow: 'hidden', ...shadows.card,
  },
  photo: { height: 160, width: '100%', backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  intro: { padding: 16, gap: 12, minHeight: 120 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderColor: colors.borderDefault },
  rowText: { flex: 1, gap: 4 },
  label: { color: colors.textSecondary, fontSize: 13 },
  explanation: { color: colors.textSecondary, fontSize: 11 },
  value: { flex: 1, color: colors.textPrimary, fontSize: 13, textAlign: 'right' },
  sections: { padding: 16, gap: 16 },
  heading: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { width: 118, minHeight: 44, padding: 10, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radii.button, justifyContent: 'center' },
  selected: { backgroundColor: colors.surfaceRaised },
  tabLabel: { color: colors.textPrimary, fontSize: 13, textAlign: 'center' },
  strong: { fontWeight: '600' },
  footer: { padding: 16, marginTop: 'auto' },
})
