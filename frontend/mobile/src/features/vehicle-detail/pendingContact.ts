import { uuid } from 'expo'
import * as SecureStore from 'expo-secure-store'

const loading = new Map<string, Promise<string>>()
const key = (buyerId: number, vehicleId: number) => `td-autos.whatsapp-contact.${buyerId}.${vehicleId}`

// Save before POST: a new app session can safely retry an uncertain server result.
export function pendingContactAttempt(buyerId: number, vehicleId: number): Promise<string> {
  const name = key(buyerId, vehicleId)
  const existing = loading.get(name)
  if (existing) return existing
  const request = (async () => {
    const saved = await SecureStore.getItemAsync(name)
    if (saved) return saved
    const attempt = uuid.v4()
    await SecureStore.setItemAsync(name, attempt)
    return attempt
  })().finally(() => { loading.delete(name) })
  // A remount during a local save must share the same attempt, not generate another.
  loading.set(name, request)
  return request
}

export function clearPendingContact(buyerId: number, vehicleId: number): Promise<void> {
  return SecureStore.deleteItemAsync(key(buyerId, vehicleId))
}
