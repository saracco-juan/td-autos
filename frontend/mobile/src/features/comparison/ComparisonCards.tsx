import { useEffect, useState } from 'react'
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Switch, Text, useAnimatedValue, View } from 'react-native'

import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { comparisonGroups, type ComparisonEntry } from '@shared/comparison/groups'
import { formatPrice } from '@shared/recommendations/format'
import { UNKNOWN_FACT } from '@shared/vehicles/detail'
import useReduceMotion from '../../lib/useReduceMotion'
import { archivo } from '../../theme/archivo'
import { colors, radii } from '../../theme/tokens'
import PortalInfo from '../recommendations/PortalInfo'
import ComparisonLayout from './ComparisonLayout'

type Props = {
  entries: [ComparisonEntry, ComparisonEntry]
  onChangeVehicle: (id: number) => void
  onCosts: (id: number) => void
}

const sectionLabels: Record<string, string> = {
  'Información general': 'General', 'Motor y consumo': 'Motor',
  'Ventajas según tu diagnóstico': 'Diagnóstico', 'Costos estimados en ARS': 'Costos',
}

type TabPosition = { x: number; width: number }
const LINE_WIDTH = 48
const tabTiming = { duration: 400, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }

function TabUnderline({ x, width }: Readonly<TabPosition>) {
  const offset = x + (width - LINE_WIDTH) / 2
  const scale = width / LINE_WIDTH
  const translateX = useAnimatedValue(offset)
  const scaleX = useAnimatedValue(scale)
  const reduceMotion = useReduceMotion()
  useEffect(() => {
    if (reduceMotion) {
      translateX.setValue(offset)
      scaleX.setValue(scale)
      return
    }
    const motion = Animated.parallel([
      Animated.timing(translateX, { ...tabTiming, toValue: offset }),
      Animated.timing(scaleX, { ...tabTiming, toValue: scale }),
    ])
    motion.start()
    return () => motion.stop()
  }, [offset, scale, translateX, scaleX, reduceMotion])
  return <Animated.View pointerEvents="none" style={[styles.underline, { transform: [{ translateX }, { scaleX }] }]} />
}

function Photo({ url, title }: { url?: string; title: string }) {
  const [failed, setFailed] = useState(false)
  return url && !failed ? (
    <Image source={{ uri: url }} accessibilityLabel={`Foto de ${title}`} onError={() => setFailed(true)}
      resizeMode="contain" style={styles.photo} />
  ) : <View style={styles.photo}><Text style={styles.label}>Fotos no disponibles.</Text></View>
}

function modelName({ detail: { vehicle } }: ComparisonEntry) {
  return [vehicle.modelo, vehicle.version].filter(Boolean).join(' ') || vehicleTitle(vehicle)
}

function VehicleCard({ entry, onChangeVehicle }: Readonly<{ entry: ComparisonEntry; onChangeVehicle: (id: number) => void }>) {
  const { vehicle } = entry.detail
  const title = vehicleTitle(vehicle)
  return <View style={styles.column} accessibilityLabel={`Vehículo comparado: ${title}`}>
    <Photo key={vehicle.fotos[0]?.url} url={vehicle.fotos[0]?.url} title={title} />
    {vehicle.marca && <Text style={[styles.make, archivo()]}>{vehicle.marca}</Text>}
    <Text accessibilityRole="header" style={[styles.model, archivo(true)]}>{modelName(entry)}</Text>
    <Text style={[styles.price, archivo(true)]}>{vehicle.precio === null || vehicle.moneda === null
      ? UNKNOWN_FACT : formatPrice(vehicle.precio, vehicle.moneda)}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Cambiar ${title}`}
      style={styles.change} onPress={() => onChangeVehicle(entry.id)}>
      <Text style={[styles.name, archivo(true)]}>Cambiar</Text>
    </Pressable>
  </View>
}

export default function ComparisonCards({ entries, onChangeVehicle, onCosts }: Readonly<Props>) {
  const [section, setSection] = useState('Información general')
  const [hideSimilar, setHideSimilar] = useState(false)
  const [tabPositions, setTabPositions] = useState<Record<string, TabPosition>>({})
  const groups = entries.map(comparisonGroups)
  const sections = groups[0].slice(1)
  // The shared builder supplies the same labeled rows, in the same order, for both cars.
  const [left, right] = groups.map(column => {
    const rows = column.find(group => group.title === section)!.rows
    return section === 'Información general' ? [...column[0].rows.slice(1), ...rows] : rows
  })
  const rows = left.map((row, i) => ({ ...row, other: right[i].value }))
    .filter(({ value, other }) => !hideSimilar || value === UNKNOWN_FACT || value !== other)
  const facts = <View>
    {rows.map(({ label, value, other, explanation }) => <View key={label} style={styles.row}>
      <View style={styles.rowHeading}><Text style={[styles.label, archivo()]}>{label}</Text>
        {explanation && <PortalInfo label={`Sobre ${label}`}><Text>{explanation}</Text></PortalInfo>}
      </View>
      <View style={styles.pair}>{[value, other].map((fact, i) => <Text key={entries[i].id}
        accessibilityLabel={`${vehicleTitle(entries[i].detail.vehicle)}, ${label}: ${fact}`}
        style={[styles.column, styles.value, i === 1 && styles.right, archivo(true)]}>{fact}</Text>)}</View>
    </View>)}
    {!rows.length && <Text accessibilityLiveRegion="polite" style={styles.message}>Todos los datos disponibles de esta sección coinciden.</Text>}
    {section === 'Costos estimados en ARS' && <View style={styles.pair}>
      {entries.map((entry, i) => <Pressable key={entry.id} accessibilityRole="link"
        accessibilityLabel={`Ver cálculo completo de ${vehicleTitle(entry.detail.vehicle)}`}
        onPress={() => onCosts(entry.id)} style={[styles.column, styles.costLink]}>
        <Text style={[styles.price, i === 1 && styles.right, archivo(true)]}>Ver cálculo →</Text>
      </Pressable>)}
    </View>}
  </View>
  return <ComparisonLayout>
    <View style={styles.pair}>{entries.map(entry => <VehicleCard key={entry.id} entry={entry} onChangeVehicle={onChangeVehicle} />)}</View>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.model, archivo(true)]}>Especificaciones</Text>
      <PortalInfo label="Sobre la comparación y los costos">
        <Text>Los motivos reflejan tu diagnóstico, no una probabilidad de satisfacción. No indican un ganador absoluto.</Text>
        <Text>Costos orientativos de la calculadora, con sus valores predeterminados. Los totales parciales excluyen los conceptos indicados.</Text>
      </PortalInfo>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {sections.map(({ title }) => <Pressable key={title} accessibilityRole="tab" accessibilityLabel={title}
        accessibilityState={{ selected: section === title }} onPress={() => setSection(title)}
        onLayout={({ nativeEvent: { layout: { x, width } } }) => setTabPositions(current =>
          current[title]?.x === x && current[title]?.width === width ? current : { ...current, [title]: { x, width } })}
        style={styles.tab}>
        <Text style={[styles.name, section !== title && styles.inactive, archivo(true)]}>{sectionLabels[title] ?? title}</Text>
      </Pressable>)}
      {tabPositions[section] && <TabUnderline {...tabPositions[section]} />}
    </ScrollView>
    <View style={styles.filter}>
      <Text style={[styles.label, archivo()]}>Ocultar similitudes</Text>
      <Switch accessibilityLabel="Ocultar similitudes" value={hideSimilar} onValueChange={setHideSimilar}
        style={styles.switch} hitSlop={10} trackColor={{ true: colors.red }} />
    </View>
    {facts}
  </ComparisonLayout>
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: 12 },
  column: { flex: 1, minWidth: 0 },
  photo: { width: '100%', aspectRatio: 1.52, borderRadius: radii.card, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center' },
  change: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 'auto' },
  make: { fontSize: 12, marginTop: 8, color: colors.textSecondary },
  model: { fontSize: 21, letterSpacing: -0.6, color: colors.textPrimary },
  price: { fontSize: 15, marginTop: 4, color: colors.textPrimary },
  heading: { marginTop: 8, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabs: { gap: 20 },
  tab: { minHeight: 44, justifyContent: 'center' },
  underline: { position: 'absolute', bottom: 0, left: 0, height: 2, width: LINE_WIDTH, backgroundColor: colors.red },
  inactive: { color: colors.textSecondary },
  filter: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault },
  right: { textAlign: 'right' },
  switch: { alignSelf: 'center', transform: [{ scale: 0.85 }] },
  name: { fontSize: 14, color: colors.textPrimary },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault, gap: 4 },
  rowHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.textSecondary, fontSize: 13, flexShrink: 1 },
  value: { fontSize: 16, fontVariant: ['tabular-nums'], color: colors.textPrimary },
  message: { color: colors.textSecondary, paddingVertical: 16 },
  costLink: { minHeight: 48, justifyContent: 'center' },
})
