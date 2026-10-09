import type { InspectionSummary } from './progress'

export type SummaryMessage = { tone: 'success' | 'warning'; text: string }

// The box under the header of the summary (Figma 2287:4651 for the incomplete case; D5 and D6 for the rest).
export function summaryMessage(progress: InspectionSummary): SummaryMessage {
  const pending = progress.pending.length
  const critical = progress.pendingCritical

  if (pending === 0) {
    const points = progress.total === 1 ? 'el punto' : `los ${progress.total} puntos`
    return { tone: 'success', text: `Inspección completa: revisaste ${points}.` }
  }

  const prefix = 'Inspección incompleta:'
  if (critical === 0) {
    return {
      tone: 'warning',
      text: pending === 1 ? `${prefix} te queda 1 punto sin revisar.` : `${prefix} te quedan ${pending} puntos sin revisar.`,
    }
  }
  // Every pending item is critical: say so instead of "2 de ellos críticos".
  if (critical === pending) {
    return {
      tone: 'warning',
      text:
        pending === 1
          ? `${prefix} te queda 1 punto crítico sin revisar.`
          : `${prefix} te quedan ${pending} puntos críticos sin revisar.`,
    }
  }
  const ofThem = critical === 1 ? '1 de ellos crítico' : `${critical} de ellos críticos`
  return { tone: 'warning', text: `${prefix} te quedan ${pending} puntos sin revisar, ${ofThem}.` }
}
