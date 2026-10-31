import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { createFavoritesApi } from '@shared/favorites/api'
import Alert from '../../components/Alert'
import { colors, radii, shadows } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'

type State = { saved: boolean; pending: boolean; error: boolean }
const Context = createContext<{
  states: Record<number, State>; toggle: (id: number, saved: boolean) => Promise<boolean | undefined>
} | null>(null)

// Buyer navigation owns mutations so both hearts share pending, success and rollback.
export function FavoriteProvider({ children }: { children: ReactNode }) {
  const { authFetch } = useAuth()
  const [states, setStates] = useState<Record<number, State>>({})
  const active = useRef(new Set<number>())
  const update = (id: number, saved: boolean, pending: boolean, error: boolean) => {
    setStates((previous) => ({ ...previous, [id]: { saved, pending, error } }))
  }
  const toggle = async (id: number, saved: boolean) => {
    if (active.current.has(id)) return
    active.current.add(id)
    update(id, !saved, true, false)
    try {
      await createFavoritesApi(authFetch).setFavorite(id, !saved)
      update(id, !saved, false, false)
      return true
    } catch {
      update(id, saved, false, true)
      return false
    } finally {
      active.current.delete(id)
    }
  }
  return <Context.Provider value={{ states, toggle }}>{children}</Context.Provider>
}

export function useFavoriteState() {
  const store = useContext(Context)
  if (!store) throw new Error('Favorite controls require the buyer navigation provider')
  return store
}

// Shared by the recommendation card and sheet; Figma FavoriteButton 2506:10157.
export default function FavoriteButton({ vehicleId, vehicleName, isFavorite = false }: Readonly<{
  vehicleId: number; vehicleName: string; isFavorite?: boolean
}>) {
  const store = useFavoriteState()
  const { saved, pending, error } = store.states[vehicleId] ?? { saved: isFavorite, pending: false, error: false }

  return (
    <View style={styles.control}>
      <Pressable accessibilityRole="button" accessibilityLabel={saved
        ? `Quitar ${vehicleName} de favoritos` : `Guardar ${vehicleName} en favoritos`}
      accessibilityState={{ selected: saved, disabled: pending }} disabled={pending}
      onPress={() => { void store.toggle(vehicleId, saved) }} style={styles.button}>
        <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden>
          <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
            fill={saved ? colors.errorBorder : 'none'} stroke={saved ? colors.errorBorder : colors.textSecondary} strokeWidth={1.8} />
        </Svg>
      </Pressable>
      {error ? <Alert variant="error">No se pudo actualizar el favorito. Intentá de nuevo.</Alert> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  control: { gap: 8 },
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radii.button,
    backgroundColor: colors.surface, ...shadows.soft },
})
