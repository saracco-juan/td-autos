import type { InspectionItem, InspectionStep, InspectionVehicle } from './types'

export const VEHICLE_FALLBACK_TITLE = 'Vehículo'

export type StepProgress = {
  numero: number
  titulo: string
  completed: number
  total: number
}

export type InspectionSummary = {
  total: number
  completed: number
  // Every catalog item is ticked (false for an empty catalog).
  complete: boolean
  steps: StepProgress[]
  // Unticked items in catalog order.
  pending: InspectionItem[]
  // Same items, critical ones first; catalog order kept inside each group.
  pendingCriticalFirst: InspectionItem[]
  pendingCritical: number
}

// Everything the counter, the step card and the summary cards render. Codes that are not in the
// catalog are ignored, so the counts never exceed the total.
export function summarizeInspection(
  steps: InspectionStep[],
  completedCodes: string[],
): InspectionSummary {
  const ticked = new Set(completedCodes)

  const stepProgress = steps.map((step) => ({
    numero: step.numero,
    titulo: step.titulo,
    completed: step.items.filter((item) => ticked.has(item.codigo)).length,
    total: step.items.length,
  }))
  const pending = steps.flatMap((step) => step.items).filter((item) => !ticked.has(item.codigo))
  const critical = pending.filter((item) => item.critico)

  const total = stepProgress.reduce((sum, step) => sum + step.total, 0)
  const completed = total - pending.length

  return {
    total,
    completed,
    complete: total > 0 && pending.length === 0,
    steps: stepProgress,
    pending,
    pendingCriticalFirst: [...critical, ...pending.filter((item) => !item.critico)],
    pendingCritical: critical.length,
  }
}

// `Toyota Corolla XEI 2021`; any part may be missing.
export function vehicleTitle(vehicle: Omit<InspectionVehicle, 'id'>): string {
  const title = [vehicle.marca, vehicle.modelo, vehicle.version, vehicle.anio]
    .map((part) => (part === null ? '' : String(part).trim()))
    .filter((part) => part !== '')
    .join(' ')

  return title === '' ? VEHICLE_FALLBACK_TITLE : title
}
