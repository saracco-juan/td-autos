import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'

import AppBar from '../../components/AppBar'
import { ComparisonSelectionProvider } from '../../features/comparison/ComparisonSelection'
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
    // @expo/vector-icons 15 types predate React Native 0.88's ColorValue; the tab bar passes a plain color string.
    tabBarIcon: ({ color }: { color: ColorValue }) => <Ionicons name={icon} size={24} color={color as string} />,
  },
}))

// No tab button. Not `href: null`: Expo Router 58 redirects a focused hidden tab to the first one.
// The item wrapper keeps `flex: 1` even without a button, so it must not be laid out at all.
const HIDDEN = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } }

export default function TabsLayout() {
  return (
    <ComparisonSelectionProvider><Tabs
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
      {/* Vehicle sheet and inspection checklist: screens of the tabs (the bottom bar stays) without a tab of their own. */}
      <Tabs.Screen name="vehiculos/[id]/index" options={HIDDEN} />
      <Tabs.Screen name="vehiculos/[id]/inspeccion" options={HIDDEN} />
      <Tabs.Screen name="vehiculos/[id]/costos" options={HIDDEN} />
      <Tabs.Screen name="vehiculos/[id]/depreciacion" options={HIDDEN} />
      <Tabs.Screen name="comparar" options={HIDDEN} />
    </Tabs></ComparisonSelectionProvider>
  )
}
