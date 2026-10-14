import type { AdminDealer, AdminDealerRow } from './types'

export type DealerTone = 'pending' | 'active' | 'inactive' | 'unknown'

// Figma 38:1037 "Estado" labels; HU20 brings `inactiva`.
const DEALER_STATES: Record<string, { label: string; tone: DealerTone }> = {
  pendiente: { label: 'Pendiente de aprobación', tone: 'pending' },
  activa: { label: 'Activa', tone: 'active' },
  inactiva: { label: 'Inactiva', tone: 'inactive' },
}

export function dealerState(estado: string | null): { label: string; tone: DealerTone } {
  if (estado === null) return { label: 'Sin estado', tone: 'unknown' }
  return DEALER_STATES[estado] ?? { label: estado, tone: 'unknown' }
}

// "Rosario, Santa Fe"; the province is skipped when it repeats the locality (CABA, Córdoba).
export function dealerLocation({ localidad, provincia }: Pick<AdminDealer, 'localidad' | 'provincia'>): string {
  const parts = [localidad, provincia].filter((part): part is string => Boolean(part?.trim()))
  return [...new Set(parts)].join(', ')
}

// VER COMPROBANTE opens the receipt waiting for review, else the latest decided one.
export function receiptTarget(dealer: AdminDealerRow): number | null {
  return dealer.comprobante_pendiente_id ?? dealer.ultimo_comprobante_id
}
