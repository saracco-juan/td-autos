import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'

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

// Defined at module level so the tab bar does not get new component identities on every render.
function renderHeader() {
  return <AppBar />
}

const TAB_SCREENS = TABS.map(({ name, title, icon }) => ({
  name,
  options: {
    title,
    tabBarIcon: ({ color }: { color: ColorValue }) => <Ionicons name={icon} size={24} color={color} />,
  },
}))

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: renderHeader,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.charcoal,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.borderDefault },
      }}
    >
      {TAB_SCREENS.map(({ name, options }) => (
        <Tabs.Screen key={name} name={name} options={options} />
      ))}
    </Tabs>
  )
}
