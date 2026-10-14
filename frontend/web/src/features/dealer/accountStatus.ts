import { DEALER_STATE_ACTIVE, DEALER_STATE_PENDING } from '../auth/roles'

// Wording of the account state (Figma 38:860 and 38:826 "Estado de la cuenta"), shared by the dealer screens.
export function accountStatusText(state: string | null | undefined): string {
  if (state === DEALER_STATE_PENDING) return 'Pendiente de aprobación inicial · inventario bloqueado'
  if (state === DEALER_STATE_ACTIVE) return 'Activa'
  return 'Sin información de estado'
}
