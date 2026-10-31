import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { createFavoritesApi } from '@shared/favorites/api'
import Alert from '../../components/Alert'
import { colors, radii, shadows } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'

// Shared by the recommendation card and sheet; Figma FavoriteButton 2506:10157.
export default function FavoriteButton({ vehicleId, vehicleName, isFavorite = false }: Readonly<{
  vehicleId: number; vehicleName: string; isFavorite?: boolean
}>) {
  const { authFetch } = useAuth()
  const [saved, setSaved] = useState(isFavorite)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const active = useRef(false)
  const toggle = async () => {
    if (active.current) return
    active.current = true
    setPending(true)
    setError(false)
    setSaved(!saved)
    try {
      await createFavoritesApi(authFetch).setFavorite(vehicleId, !saved)
    } catch {
      setSaved(saved)
      setError(true)
    } finally {
      active.current = false
      setPending(false)
    }
  }

  return (
    <View style={styles.control}>
      <Pressable accessibilityRole="button" accessibilityLabel={saved
        ? `Quitar ${vehicleName} de favoritos` : `Guardar ${vehicleName} en favoritos`}
      accessibilityState={{ selected: saved, disabled: pending }} disabled={pending}
      onPress={() => { void toggle() }} style={styles.button}>
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
