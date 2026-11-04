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
import { clearPendingContact, pendingContactAttempt } from './pendingContact'

// HU25 / TC-65/66: the shared backend commits the lead before the app handoff.
export default function VehicleContact({ vehicleId, available }: Readonly<{ vehicleId: number; available: boolean }>) {
  const { authFetch, user } = useAuth()
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
    if (pending.current || !available || user === null) return
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      if (destination.current === null) {
        attempt.current ??= await pendingContactAttempt(user.id, vehicleId)
        const { url } = await contactVehicle(authFetch, vehicleId, attempt.current)
        const link = new URL(url)
        // Keep the server's recipient and encoded message, with no browser fallback.
        destination.current = `whatsapp://send?phone=${link.pathname.slice(1)}&${link.search.slice(1)}`
      }
      if (!active.current) return
      try {
        await Linking.openURL(destination.current)
      } catch {
        // Retain the committed contact so reopening never records a second lead.
        if (active.current) setError('No pudimos abrir WhatsApp. Verificá que esté instalado e intentá nuevamente.')
        return
      }
      try {
        await clearPendingContact(user.id, vehicleId)
      } catch {
        // Keep the saved attempt if cleanup fails after the OS has opened WhatsApp.
        if (active.current) setError('WhatsApp se abrió. Si reintentás, se abrirá el mismo contacto.')
        return
      }
      destination.current = null
      attempt.current = null
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
