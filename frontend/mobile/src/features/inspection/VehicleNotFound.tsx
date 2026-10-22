import { StyleSheet, Text, View } from 'react-native'

import TextLink from '../../components/TextLink'
import { NOT_FOUND_LINK, NOT_FOUND_TITLE } from '@shared/checklist/inspection/copy'
import { colors } from '../../theme/tokens'

// Unknown vehicle, or an id that cannot be one (Figma 07h).
export default function VehicleNotFound() {
  return (
    <View style={styles.state}>
      <View style={styles.group}>
        <Text accessibilityRole="header" style={styles.title}>
          {NOT_FOUND_TITLE}
        </Text>
        <TextLink href="/">{NOT_FOUND_LINK}</TextLink>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Centered in the screen, the link under the start of the title (Figma 07h).
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  group: { alignItems: 'flex-start', gap: 8 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
})
