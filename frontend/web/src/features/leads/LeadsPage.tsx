import { useEffect, useState } from 'react'
import type { LeadPeriod, LeadSummary } from '@shared/leads/types'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import ListFooter from '../../components/ListFooter'
import Pagination from '../../components/Pagination'
import ScrollArea from '../../components/ScrollArea'
import buttonStyles from '../../components/button.module.css'
import screenStyles from '../../components/screen.module.css'
import { NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import { fetchLeads } from './api'
import MetricsOverview from './MetricsOverview'
import styles from './LeadsPage.module.css'

const PERIODS: { value: LeadPeriod; label: string }[] = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'all', label: 'Todo el período' },
]
type View = { status: 'loading' } | { status: 'ready'; data: LeadSummary } | { status: 'error'; kind: ErrorKind }

export default function LeadsPage() {
  const [period, setPeriod] = useState<LeadPeriod>('month')
  const [view, setView] = useState<View>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    let cancelled = false
    fetchLeads(period).then((data) => {
      if (!cancelled) setView({ status: 'ready', data })
    }).catch((error: unknown) => {
      if (!cancelled) setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
    })
    return () => { cancelled = true }
  }, [period, attempt])

  const selectPeriod = (value: LeadPeriod) => {
    if (value === period) return
    setPeriod(value)
    setPage(1)
    setView({ status: 'loading' })
  }
  const data = view.status === 'ready' ? view.data : null
  const vehicles = data?.vehicles ?? []
  const maximum = Math.max(1, vehicles[0]?.leads ?? 0)

  return (
    <section className={`${screenStyles.page} ${screenStyles.fill} ${styles.page}`}>
      <header className={styles.header}>
        <p className={screenStyles.eyebrow}>MÉTRICAS</p>
        <h1 className={screenStyles.title}>Métricas</h1>
        <p>Cada contacto es una solicitud para abrir el WhatsApp de uno de tus autos.</p>
        <p className={styles.hint}>No confirma mensajes enviados, compradores únicos ni ventas.</p>
      </header>
      <div role="group" aria-label="Período de consulta" className={styles.filters}>
        {PERIODS.map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={period === value} onClick={() => selectPeriod(value)}
            className={`${buttonStyles.button} ${period === value ? buttonStyles.primary : buttonStyles.secondary}`}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.results} aria-busy={view.status === 'loading'}>
        {view.status === 'loading' ? <SessionLoading /> : null}
        {view.status === 'error' ? <ErrorState kind={view.kind} onRetry={() => {
          setView({ status: 'loading' })
          setAttempt((value) => value + 1)
        }} /> : null}
        {data ? <div className={styles.dashboard} data-empty={data.total === 0 || undefined}>
          <MetricsOverview data={data} />
          {data.total === 0 ? <div className={styles.empty}>
            <h2>Sin contactos en este período</h2>
            <p>Cuando alguien solicite contactarte por un vehículo, lo vas a ver acá.</p>
          </div> : <section className={`${styles.card} ${styles.rankingPanel}`} aria-labelledby="ranking-title">
            <h2 id="ranking-title" className={styles.rankingTitle}>Vehículos por contactos</h2>
            <ScrollArea fill label="Ranking de vehículos" className={styles.ranking}>
              <ol aria-label="Vehículos por contactos" className={styles.list} start={(page - 1) * pageSize + 1}>
                {vehicles.slice((page - 1) * pageSize, page * pageSize).map((vehicle) => (
                  <li key={vehicle.id} className={styles.row}>
                    <div className={styles.rowHeading}>
                      <span>{vehicle.label}</span>
                      <strong>{vehicle.leads} {vehicle.leads === 1 ? 'contacto' : 'contactos'}</strong>
                    </div>
                    <meter className={styles.bar} min={0} max={maximum} value={vehicle.leads} aria-label={`Contactos de ${vehicle.label}`} />
                  </li>
                ))}
              </ol>
            </ScrollArea>
            {vehicles.length > 10 ? <ListFooter>
              <Pagination page={page} lastPage={Math.ceil(vehicles.length / pageSize)} onChange={setPage}
                pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
            </ListFooter> : null}
          </section>}
        </div> : null}
      </div>
    </section>
  )
}
