import type { ImportCounts } from './types'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export function previewSummary({ nuevos, actualizaciones }: ImportCounts): string {
  return `${plural(nuevos, 'vehículo nuevo', 'vehículos nuevos')} · ${plural(actualizaciones, 'actualización', 'actualizaciones')} · 0 errores. No se aplica ningún cambio hasta confirmar.`
}

// Success message the inventory shows after the import: the noun appears once, with the first part.
export function appliedNotice({ nuevos, actualizaciones }: ImportCounts): string {
  const created = nuevos > 0 ? plural(nuevos, 'vehículo nuevo', 'vehículos nuevos') : null
  const updated = actualizaciones > 0 ? plural(actualizaciones, 'actualizado', 'actualizados') : null
  if (created && updated) return `Importación aplicada: ${created} y ${updated}.`
  if (updated) return `Importación aplicada: ${plural(actualizaciones, 'vehículo actualizado', 'vehículos actualizados')}.`
  return created ? `Importación aplicada: ${created}.` : 'Importación aplicada.'
}
