import { useRef, useState } from 'react'
import { setFavorite } from './api'

const UPDATE_ERROR = 'No se pudo actualizar el favorito. Intentá de nuevo.'

export function useFavorite(vehicleId: number, initialIsFavorite: boolean) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRequest = useRef(false)

  const toggle = async () => {
    if (pendingRequest.current) return
    pendingRequest.current = true
    setPending(true)
    setError(null)
    const next = !isFavorite
    setIsFavorite(next)
    try {
      await setFavorite(vehicleId, next)
    } catch {
      setIsFavorite(!next)
      setError(UPDATE_ERROR)
    } finally {
      pendingRequest.current = false
      setPending(false)
    }
  }

  return { isFavorite, pending, error, toggle }
}
