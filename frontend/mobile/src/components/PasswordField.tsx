import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'

import { colors } from '../theme/tokens'
import TextField, { type TextFieldProps } from './TextField'

// A text field that hides its value, with the Figma eye toggle to show it.
export default function PasswordField(props: Omit<TextFieldProps, 'secureTextEntry' | 'trailing'>) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      {...props}
      autoCapitalize="none"
      secureTextEntry={!visible}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          hitSlop={8}
          onPress={() => setVisible((current) => !current)}
          style={styles.toggle}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
        </Pressable>
      }
    />
  )
}

const styles = StyleSheet.create({
  toggle: { width: 44, height: '100%', alignItems: 'center', justifyContent: 'center' },
})
