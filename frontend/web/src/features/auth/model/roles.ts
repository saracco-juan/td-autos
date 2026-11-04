import type { User } from './types'

// Values of `users.rol` and `concesionaria.estado_alta` the web app decides on.
export const ROLE_BUYER = 'comprador'
export const ROLE_DEALER = 'concesionaria'
export const ROLE_ADMIN = 'administrador'
export const DEALER_STATE_PENDING = 'pendiente'
export const DEALER_STATE_ACTIVE = 'activa'

export function isBuyer(user: User | null): boolean {
  return user?.rol === ROLE_BUYER
}

export function isDealer(user: User | null): boolean {
  return user?.rol === ROLE_DEALER
}

// Platform administrators (UH19): created with `php artisan admin:create`, never through sign-up.
export function isAdmin(user: User | null): boolean {
  return user?.rol === ROLE_ADMIN
}

// Only an approved dealer may manage its inventory (HU17 scenario 3).
export function isActiveDealer(user: User | null): boolean {
  return isDealer(user) && user?.concesionaria?.estado_alta === DEALER_STATE_ACTIVE
}
