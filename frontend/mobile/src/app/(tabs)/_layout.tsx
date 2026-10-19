import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'

import AppBar from '../../components/AppBar'
import { colors } from '../../theme/tokens'

type IconName = keyof typeof Ionicons.glyphMap

// Figma "Nav/Bottom": the five buyer tabs, in that order.
const TABS: readonly { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Diagnóstico', icon: 'clipboard-outline' },
  { name: 'recomendados', title: 'Recomendados', icon: 'star-outline' },
  { name: 'favoritos', title: 'Favoritos', icon: 'heart-outline' },
  { name: 'transferencia', title: 'Transferencia', icon: 'swap-horizontal-outline' },
  { name: 'perfil', title: 'Perfil', icon: 'person-outline' },
]

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: () => <AppBar />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.charcoal,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.borderDefault },
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => <Ionicons name={icon} size={24} color={color} />,
          }}
        />
      ))}
    </Tabs>
  )
}
