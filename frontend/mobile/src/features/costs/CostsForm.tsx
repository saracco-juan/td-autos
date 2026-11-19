import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import Button from '../../components/Button'
import TextField from '../../components/TextField'
import { colors, radii } from '../../theme/tokens'
import { archivo } from '../../theme/archivo'
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
  onCancel: () => void
}

const COVERAGES: readonly { value: Coverage; label: string }[] = [
  { value: 'terceros_completo', label: 'Terceros completo' },
  { value: 'todo_riesgo', label: 'Todo riesgo' },
]

export default function CostsForm({ km, coverage, kmHint, errors, busy, onKmChange, onCoverageChange, onSubmit, onCancel }: Readonly<Props>) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View style={styles.card}>
      <TextField
        label="Kilómetros por mes"
        keyboardType="number-pad"
        value={km}
        errors={errors.km}
        readOnly={busy}
        onChangeText={onKmChange}
        hint={kmHint ? <Text style={styles.hint}>Usamos un valor estimado.</Text> : undefined}
      />
      <View style={styles.field}>
        <Text style={[styles.label, archivo()]}>Cobertura del seguro</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cobertura del seguro"
          accessibilityState={{ expanded, disabled: busy }} disabled={busy} onPress={() => setExpanded(!expanded)}
          style={({ pressed }) => [styles.trigger, pressed && styles.checked]}>
          <Text style={[styles.optionText, archivo()]}>{COVERAGES.find((item) => item.value === coverage)?.label}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.charcoal} />
        </Pressable>
        {expanded ? <View accessibilityRole="radiogroup" style={styles.options}>
          {COVERAGES.map(({ value, label }) => {
            const checked = coverage === value
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked, disabled: busy }}
                disabled={busy}
                onPress={() => { onCoverageChange(value); setExpanded(false) }}
                style={[styles.option, checked && styles.checked]}
              >
                <Text style={[styles.optionText, archivo(checked)]}>{label}</Text>
              </Pressable>
            )
          })}
        </View> : null}
        {errors.coverage?.map((message) => (
          <Text key={message} style={styles.error}>
            {message}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
        <View style={styles.action}><Button label="CANCELAR" disabled={busy} onPress={onCancel} /></View>
        <View style={styles.action}><Button label="RECALCULAR" variant="primary" busy={busy} onPress={onSubmit} /></View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, paddingVertical: 2 },
  field: { gap: 4 },
  label: { color: colors.textPrimary, fontSize: 12, fontWeight: '500' },
  hint: { color: colors.textSecondary, fontSize: 12 },
  trigger: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12, borderWidth: 1, borderColor: colors.borderInput, borderRadius: radii.field, backgroundColor: colors.controlBackground },
  options: { marginTop: 6, padding: 4, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radii.field, backgroundColor: colors.surface },
  option: { minHeight: 44, justifyContent: 'center', padding: 10, borderRadius: 6 },
  checked: { backgroundColor: colors.surfaceRaised },
  optionText: { flexShrink: 1, color: colors.charcoal, fontSize: 14 },
  error: { color: colors.red, fontSize: 12 },
})
