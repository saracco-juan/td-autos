import type { User } from './types'

// Values of `users.rol` and `concesionaria.estado_alta` the web app decides on.
export const ROLE_DEALER = 'concesionaria'
export const DEALER_STATE_PENDING = 'pendiente'
export const DEALER_STATE_ACTIVE = 'activa'

export function isDealer(user: User | null): boolean {
  return user?.rol === ROLE_DEALER
}

// Only an approved dealer may manage its inventory (HU17 scenario 3).
export function isActiveDealer(user: User | null): boolean {
  return isDealer(user) && user?.concesionaria?.estado_alta === DEALER_STATE_ACTIVE
}
