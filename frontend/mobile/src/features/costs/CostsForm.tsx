import { Pressable, StyleSheet, Text, View } from 'react-native'

import Button from '../../components/Button'
import TextField from '../../components/TextField'
import { colors, radii, shadows } from '../../theme/tokens'
import type { Coverage } from '@shared/costs/types'

export type FieldErrors = { km?: string[]; coverage?: string[] }

type Props = {
  km: string
  coverage: Coverage
  kmHint: boolean
  errors: FieldErrors
  busy: boolean
  onKmChange: (value: string) => void
  onCoverageChange: (value: Coverage) => void
  onSubmit: () => void
}

// React Native has no native select: the coverage is a two-option segmented choice, like the transmission
// in the filters sheet (Figma 06 draws a select; see docs/design.md "HU10-MOBILE calculator").
const COVERAGES: readonly { value: Coverage; label: string }[] = [
  { value: 'terceros_completo', label: 'Terceros completo' },
  { value: 'todo_riesgo', label: 'Todo riesgo' },
]

export default function CostsForm({ km, coverage, kmHint, errors, busy, onKmChange, onCoverageChange, onSubmit }: Readonly<Props>) {
  return (
    <View style={styles.card}>
      <TextField
        label="Kilómetros por mes"
        keyboardType="number-pad"
        value={km}
        errors={errors.km}
        onChangeText={onKmChange}
        hint={kmHint ? <Text style={styles.hint}>Usamos un valor estimado.</Text> : undefined}
      />
      <View style={styles.field}>
        <Text style={styles.label}>Cobertura del seguro</Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {COVERAGES.map(({ value, label }) => {
            const checked = coverage === value
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked }}
                onPress={() => onCoverageChange(value)}
                style={[styles.option, checked && styles.checked]}
              >
                <Text style={[styles.optionText, checked && styles.checkedText]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
        {errors.coverage?.map((message) => (
          <Text key={message} style={styles.error}>
            {message}
          </Text>
        ))}
      </View>
      <Button label="RECALCULAR" variant="primary" busy={busy} onPress={onSubmit} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  field: { gap: 4 },
  label: { color: colors.textPrimary, fontSize: 12, fontWeight: '500' },
  hint: { color: colors.textSecondary, fontSize: 12 },
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.field,
    backgroundColor: colors.background,
  },
  checked: { borderWidth: 2, borderColor: colors.charcoal, backgroundColor: colors.surface },
  optionText: { color: colors.textPrimary, fontSize: 14 },
  checkedText: { fontWeight: '600' },
  error: { color: colors.red, fontSize: 12 },
})
