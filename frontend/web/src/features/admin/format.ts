import type { AdminDealer, AdminDealerRow, ReceiptState } from './types'

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

// The latest receipt was rejected and the dealer has not sent a new one yet.
export function hasRejectedReceipt(dealer: AdminDealerRow): boolean {
  return dealer.comprobante_pendiente_id === null && dealer.ultimo_comprobante_estado === 'rechazado'
}

export type ReceiptTone = 'pending' | 'approved' | 'rejected'

const RECEIPT_TONES: Record<ReceiptState, ReceiptTone> = {
  'pendiente de revisión': 'pending',
  aprobado: 'approved',
  rechazado: 'rejected',
}

export function receiptTone(estado: ReceiptState): ReceiptTone {
  return RECEIPT_TONES[estado] ?? 'pending'
}

const RECEIPT_STATES: Record<ReceiptState, string> = {
  'pendiente de revisión': 'Pendiente de revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

export function receiptState(estado: ReceiptState): string {
  return RECEIPT_STATES[estado] ?? estado
}

// A calendar day (yyyy-mm-dd) as dd/mm/aaaa; read as text so no time zone can move it.
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-')
  return `${date}/${month}/${year}`
}

// Same limit and messages as the backend (RejectComprobanteRequest).
export const MAX_REJECT_REASON = 500

export function validateRejectReason(reason: string): string | undefined {
  const trimmed = reason.trim()
  if (trimmed === '') return 'Ingresá el motivo del rechazo.'
  if (trimmed.length > MAX_REJECT_REASON) return `El motivo no puede superar los ${MAX_REJECT_REASON} caracteres.`
  return undefined
}
