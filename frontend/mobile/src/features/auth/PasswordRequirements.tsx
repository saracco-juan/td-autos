import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../../theme/tokens'
import { PASSWORD_RULES } from './passwordRules'

// Always-visible checklist (Figma "Requisitos"): each requirement turns green as soon as it is met.
export default function PasswordRequirements({ password }: Readonly<{ password: string }>) {
  return (
    <View accessibilityLabel="Requisitos de la contraseña" style={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        const color = met ? colors.success : colors.textSecondary
        return (
          <View
            key={rule.id}
            accessible
            accessibilityLabel={`${rule.label} (${met ? 'cumplido' : 'pendiente'})`}
            style={styles.item}
          >
            <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={color} />
            <Text style={[styles.label, { color }]}>{rule.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 16, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '45%', flexGrow: 1 },
  label: { fontSize: 12 },
})
