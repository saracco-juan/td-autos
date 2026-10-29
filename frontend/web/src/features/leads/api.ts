import { apiFetch } from '../../lib/http'
import type { LeadPeriod, LeadSummary } from '@shared/leads/types'

export const fetchLeads = (period: LeadPeriod) =>
  apiFetch<LeadSummary>(`/api/concesionaria/leads?period=${period}`)
