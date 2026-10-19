import { StyleSheet, Text } from 'react-native'

import { FLAG_LABEL } from '@shared/checklist/inspection/copy'
import { colors } from '../../theme/tokens'

// Red "CRÍTICO" pill of a critical item (Figma 07).
export default function FlagBadge() {
  return <Text style={styles.badge}>{FLAG_LABEL}</Text>
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
