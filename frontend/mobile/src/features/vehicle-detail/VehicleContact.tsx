import { uuid } from 'expo'
import * as Linking from 'expo-linking'
import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Text } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import { HttpError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import { contactVehicle } from './api'

// HU25 / TC-65/66: the shared backend commits the lead before the app handoff.
export default function VehicleContact({ vehicleId, available }: Readonly<{ vehicleId: number; available: boolean }>) {
  const { authFetch } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef(true)
  const pending = useRef(false)
  const attempt = useRef<string | null>(null)
  const destination = useRef<string | null>(null)

  useFocusEffect(useCallback(() => {
    active.current = true
    setBusy(pending.current)
    return () => { active.current = false }
  }, []))

  async function contact() {
    if (pending.current || !available) return
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      if (destination.current === null) {
        attempt.current ??= uuid.v4()
        const { url } = await contactVehicle(authFetch, vehicleId, attempt.current)
        const link = new URL(url)
        // Keep the server's recipient and encoded message, with no browser fallback.
        destination.current = `whatsapp://send?phone=${link.pathname.slice(1)}&${link.search.slice(1)}`
      }
      if (!active.current) return
      try {
        await Linking.openURL(destination.current)
        destination.current = null
        attempt.current = null
      } catch {
        // Retain the committed contact so reopening never records a second lead.
        if (active.current) setError('No pudimos abrir WhatsApp. Verificá que esté instalado e intentá nuevamente.')
      }
    } catch (failure) {
      if (active.current) setError(failure instanceof HttpError && failure.status === 409
        ? 'WhatsApp no disponible'
        : failure instanceof HttpError && failure.status === 404
          ? 'Esta publicación ya no está disponible.'
          : 'No pudimos iniciar el contacto. Intentá nuevamente.')
    } finally {
      pending.current = false
      if (active.current) setBusy(false)
    }
  }

  if (!available) return <Text style={{ color: colors.textSecondary, fontSize: 14 }}>WhatsApp no disponible</Text>
  return <>
    <Button label="CONTACTAR POR WHATSAPP" variant="success" busy={busy}
      busyLabel="ABRIENDO WHATSAPP…" onPress={() => void contact()} />
    {error ? <Alert variant="error">{error}</Alert> : null}
  </>
}
