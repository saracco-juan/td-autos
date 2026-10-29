export type LeadPeriod = 'week' | 'month' | 'all'

export type LeadSummary = {
  period: LeadPeriod
  total: number
  vehicles: { id: number; label: string; leads: number; brand?: string | null }[]
}
