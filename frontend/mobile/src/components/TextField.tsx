import type { ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'

import { colors, radii } from '../theme/tokens'

export type TextFieldProps = Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoComplete'
  | 'keyboardType'
  | 'secureTextEntry'
  | 'textContentType'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'placeholder'
> & {
  label: string
  value: string
  onChangeText: (value: string) => void
  errors?: string[]
  // Content pinned inside the field, at its right edge (e.g. the password eye toggle).
  trailing?: ReactNode
  // Shown between the field and its errors (e.g. the password checklist).
  hint?: ReactNode
  // Shown for reference only (e.g. the login email): not editable, secondary text on a lighter border.
  readOnly?: boolean
}

// Figma "Input": 12 medium label above a 48 high field (radius 8) on the base background.
export default function TextField({ label, errors, trailing, hint, readOnly = false, ...input }: TextFieldProps) {
  const invalid = errors !== undefined && errors.length > 0
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, readOnly && styles.readOnlyField, invalid && styles.invalid]}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          editable={!readOnly}
          style={[styles.input, readOnly && styles.readOnlyInput]}
          placeholderTextColor={colors.textSecondary}
        />
        {trailing}
      </View>
      {hint}
      {invalid
        ? errors.map((message) => (
            <Text key={message} style={styles.error}>
              {message}
            </Text>
          ))
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: { color: colors.textPrimary, fontSize: 12, fontWeight: '500' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.field,
    backgroundColor: colors.background,
  },
  readOnlyField: { borderColor: colors.borderDefault },
  invalid: { borderColor: colors.red },
  input: { flex: 1, height: '100%', paddingRight: 12, color: colors.textPrimary, fontSize: 14 },
  readOnlyInput: { color: colors.textSecondary },
  error: { color: colors.red, fontSize: 12 },
})
