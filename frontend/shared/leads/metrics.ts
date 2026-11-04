import type { LeadSummary } from './types'

const percentage = (part: number, total: number) => total > 0 ? Math.round(part / total * 100) : 0

export function calculateLeadMetrics({ total, vehicles }: Pick<LeadSummary, 'total' | 'vehicles'>) {
  const contactedVehicles = vehicles.filter(({ leads }) => leads > 0)
  const byBrand = new Map<string, number>()
  for (const vehicle of contactedVehicles) {
    const brand = vehicle.brand?.trim() || 'Sin marca'
    byBrand.set(brand, (byBrand.get(brand) ?? 0) + vehicle.leads)
  }
  const brands = Array.from(byBrand, ([label, leads]) => ({ label, leads }))
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label, 'es'))
  const top = [...contactedVehicles].sort((a, b) => b.leads - a.leads).slice(0, 3)

  return {
    contacted: contactedVehicles.length,
    inventory: vehicles.length,
    coverage: percentage(contactedVehicles.length, vehicles.length),
    topCount: top.length,
    concentration: percentage(top.reduce((sum, vehicle) => sum + vehicle.leads, 0), total),
    brands: brands.length > 6 ? [
      ...brands.slice(0, 5),
      { label: 'Otras', leads: brands.slice(5).reduce((sum, brand) => sum + brand.leads, 0) },
    ] : brands,
  }
}
