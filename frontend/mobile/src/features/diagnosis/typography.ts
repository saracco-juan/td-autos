import { isLoaded } from 'expo-font'
import type { TextStyle } from 'react-native'

// The two native faces come from the same licensed Archivo font as the web.
export const diagnosisFonts = {
  ArchivoRegular: require('../../../assets/fonts/Archivo-Regular.ttf'),
  ArchivoSemiBold: require('../../../assets/fonts/Archivo-SemiBold.ttf'),
}

export function diagnosisType(strong = false): TextStyle {
  const family = strong ? 'ArchivoSemiBold' : 'ArchivoRegular'
  return isLoaded(family) ? { fontFamily: family } : { fontWeight: strong ? '600' : '400' }
}
