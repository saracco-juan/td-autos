import { useFonts } from 'expo-font'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import BackLink from '../../components/BackLink'
import { useBuyerTabBarSpace } from '../../components/BuyerTabIndicator'
import { archivo, archivoFonts } from '../../theme/archivo'
import { colors } from '../../theme/tokens'

export default function ComparisonLayout({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const bottom = useBuyerTabBarSpace()
  useFonts(archivoFonts)
  return <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: bottom + 16 }}>
    <View style={styles.content}>
      <BackLink label="Volver a recomendados" onPress={() => router.navigate('/recomendados')} />
      <Text accessibilityRole="header" style={[styles.title, archivo(true)]}>Comparar vehículos</Text>
      {children}
    </View>
  </ScrollView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 18, paddingTop: 5 },
  title: { fontSize: 32, letterSpacing: -1.1, marginBottom: 18, color: colors.textPrimary },
})
