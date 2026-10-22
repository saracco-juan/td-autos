import * as Linking from 'expo-linking'
import { StyleSheet, Text, View } from 'react-native'

import { advisorUrl } from '@shared/checklist/transfer/advisor'
import { ADVISOR_COPY } from '@shared/checklist/transfer/copy'
import Button from '../../components/Button'
import { colors, radii, shadows } from '../../theme/tokens'

type Props = {
  // Digits only, as the API sends them.
  whatsapp: string
}

// RF36: the paperwork advisor who pays to appear here (Figma "Card/CTA · Asesor de trámites"). Opens the WhatsApp
// chat; if the device cannot open it nothing happens, the checklist keeps working.
export default function AdvisorCard({ whatsapp }: Readonly<Props>) {
  const url = advisorUrl(whatsapp)
  if (url === null) return null

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{ADVISOR_COPY.eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {ADVISOR_COPY.title}
      </Text>
      <Text style={styles.text}>{ADVISOR_COPY.text}</Text>
      <Button
        label={ADVISOR_COPY.action}
        variant="primary"
        onPress={() => {
          Linking.openURL(url).catch(() => undefined)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  eyebrow: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  text: { color: colors.textSecondary, fontSize: 14 },
})
