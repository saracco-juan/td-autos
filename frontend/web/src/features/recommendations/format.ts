import { formatKilometers, groupThousands } from '../inventory/format'
import type { Listing } from './types'

// Without a brand and a model the structured parts say little: the marketplace title is the better name.
export function listingTitle({ titulo, marca, modelo, version, anio }: Listing): string {
  if (!marca || !modelo) return titulo
  return [marca, modelo, version, anio].filter((part) => part !== null && part !== '').join(' ')
}

function formatListingPrice(value: number, currency: string | null): string {
  return `${currency === 'USD' ? 'US$' : '$'} ${groupThousands(value)}`
}

// Second line of a card (Figma "$28.900.000 · 62.000 km · CABA"): a marketplace may omit any of the three.
export function listingMeta({ precio, moneda, kilometraje, ubicacion }: Listing): string {
  return [
    precio === null ? null : formatListingPrice(precio, moneda),
    kilometraje === null ? null : formatKilometers(kilometraje),
    ubicacion,
  ]
    .filter((part) => part !== null && part !== '')
    .join(' · ')
}
