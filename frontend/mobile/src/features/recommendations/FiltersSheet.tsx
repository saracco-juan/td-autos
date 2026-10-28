import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import Button from '../../components/Button'
import TextField from '../../components/TextField'
import { colors, radii, shadows } from '../../theme/tokens'
import type { RecommendationFilters } from '@shared/recommendations/filters'
import { draftFromFilters, parseDraft, type FilterDraft, type NumericFilter, type Transmission } from './filterDraft'

type Props = {
  applied: RecommendationFilters
  onApply: (filters: RecommendationFilters) => void
  onClose: () => void
}

const NUMERIC_FIELDS: readonly { key: NumericFilter; label: string; placeholder: string }[] = [
  { key: 'maxPrice', label: 'Precio máximo', placeholder: 'Sin límite' },
  { key: 'minYear', label: 'Año desde', placeholder: 'Cualquiera' },
  { key: 'maxKilometers', label: 'Kilometraje máximo', placeholder: 'Sin límite' },
]

const TRANSMISSIONS: readonly { value: Transmission | null; label: string }[] = [
  { value: null, label: 'Cualquiera' },
  { value: 'manual', label: 'Manual' },
  { value: 'automatica', label: 'Automática' },
]

// Figma "filtros desplegados" (2373:9964 / 2373:9982): bottom sheet with the four HU07 criteria. Drafts start
// from the applied filters and only APLICAR changes the list; the back button discards them.
export default function FiltersSheet({ applied, onApply, onClose }: Readonly<Props>) {
  const [draft, setDraft] = useState<FilterDraft>(() => draftFromFilters(applied))
  const [errors, setErrors] = useState<Partial<Record<NumericFilter, string>>>({})

  const apply = () => {
    const result = parseDraft(draft)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    onApply(result.filters)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Cerrar filtros" style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            FILTROS
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onClose} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled">
          {NUMERIC_FIELDS.map(({ key, label, placeholder }) => (
            <TextField
              key={key}
              label={label}
              placeholder={placeholder}
              keyboardType="number-pad"
              value={draft[key]}
              errors={errors[key] ? [errors[key]] : undefined}
              onChangeText={(value) => {
                setDraft({ ...draft, [key]: value })
                setErrors({ ...errors, [key]: undefined })
              }}
            />
          ))}
          <View style={styles.field}>
            <Text style={styles.label}>Transmisión</Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {TRANSMISSIONS.map(({ value, label }) => {
                const checked = draft.transmission === value
                return (
                  <Pressable
                    key={label}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked }}
                    onPress={() => setDraft({ ...draft, transmission: value })}
                    style={[styles.option, checked && styles.checked]}
                  >
                    <Text style={[styles.optionText, checked && styles.checkedText]}>{label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
          <Button label="APLICAR" variant="primary" onPress={apply} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 17, 17, 0.35)' },
  sheet: {
    maxHeight: '85%',
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginVertical: 8,
    borderRadius: 2,
    backgroundColor: colors.borderDefault,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  fields: { gap: 16, paddingTop: 8 },
  field: { gap: 4 },
  label: { color: colors.textPrimary, fontSize: 12, fontWeight: '500' },
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
})
