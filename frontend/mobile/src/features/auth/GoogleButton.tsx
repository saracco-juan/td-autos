import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import Button from '../../components/Button'
import { colors } from '../../theme/tokens'

// Figma "Google G icon" (18 x 18), kept in its brand colors.
function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" accessibilityElementsHidden>
      <Path
        d="M9 3.5625C10.3275 3.5625 11.5162 4.02 12.4537 4.9125L15.0225 2.34375C13.4625 0.8925 11.4263 0 9 0C5.4825 0 2.44125 2.0175 0.96 4.9575L3.9525 7.27875C4.66125 5.145 6.6525 3.5625 9 3.5625Z"
        fill="#EA4335"
      />
      <Path
        d="M17.6175 9.20625C17.6175 8.6175 17.5612 8.0475 17.475 7.5H9V10.8825H13.8525C13.635 11.9925 13.005 12.9375 12.06 13.575L14.9588 15.825C16.65 14.2575 17.6175 11.94 17.6175 9.20625Z"
        fill="#4285F4"
      />
      <Path
        d="M3.94875 10.7213C3.76875 10.1775 3.66375 9.6 3.66375 9C3.66375 8.4 3.765 7.8225 3.94875 7.27875L0.95625 4.9575C0.345 6.1725 0 7.545 0 9C0 10.455 0.345 11.8275 0.96 13.0425L3.94875 10.7213Z"
        fill="#FBBC05"
      />
      <Path
        d="M9 18C11.43 18 13.4737 17.2012 14.9588 15.8212L12.06 13.5712C11.2538 14.115 10.215 14.4338 9 14.4338C6.6525 14.4338 4.66125 12.8512 3.94875 10.7175L0.95625 13.0387C2.44125 15.9825 5.4825 18 9 18Z"
        fill="#34A853"
      />
    </Svg>
  )
}

type Props = {
  busy: boolean
  onPress: () => void
}

// Figma "Auth/Social · Google": divider "o" plus the CONTINUAR CON GOOGLE button.
export default function GoogleButton({ busy, onPress }: Readonly<Props>) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>o</Text>
        <View style={styles.line} />
      </View>
      <Button
        label="CONTINUAR CON GOOGLE"
        busyLabel="ABRIENDO GOOGLE…"
        busy={busy}
        variant="primary"
        icon={<GoogleIcon />}
        onPress={onPress}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.borderDefault },
  or: { color: colors.textSecondary, fontSize: 12 },
})
