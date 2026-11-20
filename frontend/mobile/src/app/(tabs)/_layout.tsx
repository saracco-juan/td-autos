import type { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs, usePathname } from 'expo-router'
import { type ReactNode, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AppBar from '../../components/AppBar'
import BuyerTabIndicator, { TAB_BAR_HEIGHT, useBuyerTabBarSpace } from '../../components/BuyerTabIndicator'
import { ComparisonSelectionProvider } from '../../features/comparison/ComparisonSelection'
import { FavoriteProvider } from '../../features/favorites/FavoriteButton'
import { useAuth } from '../../features/auth/useAuth'
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

// No tab button. Not `href: null`: Expo Router 58 redirects a focused hidden tab to the first one.
// The item wrapper keeps `flex: 1` even without a button, so it must not be laid out at all.
const HIDDEN = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } }

function StartupDestination({ children }: Readonly<{ children: ReactNode }>) {
  const { user } = useAuth()
  const pathname = usePathname()
  // Only the initial entry changes; explicit visits to diagnosis remain available.
  const [openRecommendations, setOpenRecommendations] = useState(() => pathname === '/' && user?.tiene_diagnostico === true)
  if (openRecommendations && pathname !== '/') setOpenRecommendations(false)
  return openRecommendations && pathname === '/' ? <Redirect href="/recomendados" /> : children
}

export default function TabsLayout() {
  const { width } = useWindowDimensions()
  const { left, right } = useSafeAreaInsets()
  const barSpace = useBuyerTabBarSpace()
  const sideMargin = Math.max(16 + Math.max(left, right), (width - 400) / 2)
  return (
    <StartupDestination><FavoriteProvider><ComparisonSelectionProvider><Tabs
      screenOptions={({ route }) => ({
        header: renderHeader,
        sceneStyle: { backgroundColor: colors.background },
        tabBarShowLabel: false,
        tabBarIcon: () => null,
        tabBarBackground: () => <BuyerTabIndicator tabs={TABS} index={TABS.findIndex(tab => tab.name === route.name)} />,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarStyle: { position: 'absolute', height: TAB_BAR_HEIGHT, bottom: barSpace - TAB_BAR_HEIGHT,
          marginHorizontal: sideMargin, paddingHorizontal: 0, paddingBottom: 0,
          backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
      })}
    >
      {TABS.map(({ name, title }, index) => (
        <Tabs.Screen key={name} name={name} options={{
          title, tabBarAccessibilityLabel: `${title}, pestaña ${index + 1} de ${TABS.length}`,
        }} />
      ))}
      {/* Vehicle sheet and inspection checklist: screens of the tabs (the bottom bar stays) without a tab of their own. */}
      <Tabs.Screen name="vehiculos/[id]/index" options={HIDDEN} />
      <Tabs.Screen name="vehiculos/[id]/inspeccion" options={HIDDEN} />
      <Tabs.Screen name="vehiculos/[id]/costos" options={HIDDEN} />
      <Tabs.Screen name="vehiculos/[id]/depreciacion" options={HIDDEN} />
      <Tabs.Screen name="comparar" options={HIDDEN} />
    </Tabs></ComparisonSelectionProvider></FavoriteProvider></StartupDestination>
  )
}
