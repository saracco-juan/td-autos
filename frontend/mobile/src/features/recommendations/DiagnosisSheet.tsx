import { ScrollView, StyleSheet, Text, View } from 'react-native'

import BottomSheet from '../../components/BottomSheet'
import { colors } from '../../theme/tokens'
import { diagnosisSummaryRows } from '@shared/diagnosis/diagnosisDraft'
import type { BodyType, SavedDiagnosis } from '@shared/diagnosis/types'

type Props = {
  diagnosis: SavedDiagnosis
  bodyTypes: BodyType[]
  onClose: () => void
}

// TU DIAGNÓSTICO: bottom sheet with one row per answered question.
export default function DiagnosisSheet({ diagnosis, bodyTypes, onClose }: Readonly<Props>) {
  return (
    <BottomSheet title="TU DIAGNÓSTICO" backdropLabel="Cerrar diagnóstico" closeLabel="Cerrar" closeIcon="close" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.rows}>
        {diagnosisSummaryRows(diagnosis, bodyTypes).map(({ label, value }) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  rows: { paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  label: { flex: 1, color: colors.textSecondary, fontSize: 14 },
  value: { flex: 1.25, color: colors.textPrimary, fontSize: 14, fontWeight: '500', textAlign: 'right' },
})
