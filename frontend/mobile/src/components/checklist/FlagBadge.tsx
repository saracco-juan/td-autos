import { StyleSheet, Text } from 'react-native'

import { colors } from '../../theme/tokens'

// Red pill of a flagged item ("CRÍTICO", "OBLIGATORIO"); the label comes from the feature.
export default function FlagBadge({ label }: Readonly<{ label: string }>) {
  return <Text style={styles.badge}>{label}</Text>
}

const styles = StyleSheet.create({
  badge: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.red,
    color: colors.onColor,
    fontSize: 10,
    fontWeight: '700',
  },
})
