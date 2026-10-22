import { HttpError } from '../../lib/http'
import { formatDay, retentionReached } from '../admin/format'

export const SUBSCRIPTION_PATH = '/concesionaria/suscripcion'

// `code` of the 403 that blocks the inventory of an inactive subscription (RF21).
// The other 403s of these routes (pending dealer, no permission) keep their generic handling.
const INACTIVE_CODE = 'subscription_inactive'

export type InactiveSubscription = {
  message: string
  // yyyy-mm-dd
  vigenteHasta: string | null
  retencionHasta: string | null
  // Vehicles hidden by the inactivation and kept until `retencionHasta`.
  vehiculosConservados: number
}

type InactiveBody = {
  message?: unknown
  code?: unknown
  suscripcion?: { vigente_hasta?: unknown; retencion_hasta?: unknown } | null
  vehiculos_conservados?: unknown
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

// What the 403 says about the inactive subscription, or null when the error is anything else.
export function inactiveSubscription(error: unknown): InactiveSubscription | null {
  if (!(error instanceof HttpError) || error.status !== 403) return null
  const body = error.body as InactiveBody | null | undefined
  if (body?.code !== INACTIVE_CODE) return null
  return {
    message: text(body.message) ?? '',
    vigenteHasta: text(body.suscripcion?.vigente_hasta),
    retencionHasta: text(body.suscripcion?.retencion_hasta),
    vehiculosConservados: typeof body.vehiculos_conservados === 'number' ? body.vehiculos_conservados : 0,
  }
}

// Body of the paused-inventory card: why it is paused and what happens to the vehicles.
export function pausedInventoryText({ vigenteHasta, retencionHasta, vehiculosConservados }: InactiveSubscription): string {
  const expired = vigenteHasta ? `Tu suscripción venció el ${formatDay(vigenteHasta)}` : 'Tu suscripción venció'
  const base = `${expired} y terminó el período de gracia.`
  if (vehiculosConservados === 0 && retentionReached(retencionHasta)) {
    return `${base} Tus vehículos se eliminaron porque pasaron 30 días sin renovación; cuando se apruebe la renovación vas a poder volver a cargar vehículos.`
  }
  if (vehiculosConservados === 0) return `${base} Cuando se apruebe la renovación vas a poder volver a cargar vehículos.`
  const until = retencionHasta ? `hasta el ${formatDay(retencionHasta)}` : 'por tiempo limitado'
  return vehiculosConservados === 1
    ? `${base} Tu vehículo no se publica, pero lo conservamos ${until}; después se elimina definitivamente.`
    : `${base} Tus ${vehiculosConservados} vehículos no se publican, pero los conservamos ${until}; después se eliminan definitivamente.`
}
