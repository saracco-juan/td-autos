import { useEffect, useState, type CSSProperties } from 'react'
import { summarizeChecklist, type ChecklistSummary } from '@shared/checklist/progress'
import { toChecklistSteps as inspectionSteps } from '@shared/checklist/inspection/steps'
import { toChecklistSteps as transferSteps } from '@shared/checklist/transfer/steps'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import type { TransferResponse } from '@shared/checklist/transfer/types'
import Button from '../../../components/Buttons/Button'
import ButtonLink from '../../../components/Buttons/ButtonLink'
import { fetchInspections, type InspectionIndex } from '../../inspection/api/client'
import { fetchTransfer } from '../../transfer/api/client'
import styles from './PurchaseProgress.module.css'
import accessibility from '../../../styles/accessibility.module.css'

type Results = {
  inspections: PromiseSettledResult<InspectionIndex>
  transfer: PromiseSettledResult<TransferResponse>
}

function ChecklistResumeRow({ title, description, accessibleTitle = title, summary, to, action }: Readonly<{
  title: string
  description?: string | null
  accessibleTitle?: string
  summary: ChecklistSummary
  to: string
  action: string
}>) {
  const percentage = summary.total > 0 ? Math.round(summary.completed / summary.total * 100) : 0

  return (
    <div className={styles.row}>
      <div className={styles.content}>
        <div className={styles.label}>
          <h3>{title}</h3>
          <span>{percentage}%</span>
        </div>
        {description && <p className={styles.vehicleVersion}>{description}</p>}
        <div className={styles.track}>
          <progress className={accessibility.visuallyHidden} value={percentage} max={100}
            aria-label={accessibleTitle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}
            aria-valuetext={`${summary.completed} de ${summary.total} ítems marcados`} />
          <span className={styles.fill} style={{ '--checklist-progress': percentage / 100 } as CSSProperties} />
        </div>
        <p>{summary.completed} de {summary.total} ítems marcados</p>
      </div>
      <ButtonLink to={to} variant="secondary">{action}</ButtonLink>
    </div>
  )
}

export default function PurchaseProgress() {
  const [results, setResults] = useState<Results>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      Promise.resolve().then(fetchInspections),
      Promise.resolve().then(fetchTransfer),
    ]).then(([inspections, transfer]) => {
      if (!cancelled) setResults({ inspections, transfer })
    })
    return () => { cancelled = true }
  }, [attempt])

  const inspections = results?.inspections.status === 'fulfilled' ? results.inspections.value : undefined
  const transfer = results?.transfer.status === 'fulfilled' ? results.transfer.value : undefined
  const failed = results?.inspections.status === 'rejected' || results?.transfer.status === 'rejected'
  const transferSummary = transfer && summarizeChecklist(transferSteps(transfer.etapas), transfer.items_completados)
  let transferAction = 'EMPEZAR TRANSFERENCIA'
  if (transferSummary?.complete) transferAction = 'VER TRANSFERENCIA'
  else if (transfer?.estado) transferAction = 'CONTINUAR TRANSFERENCIA'

  return (
    <section className={styles.section} aria-labelledby="purchase-progress-title">
      <h2 id="purchase-progress-title">Retomá tu compra</h2>
      <p className={styles.intro}>Seguí tus checklists donde los dejaste. El avance muestra los ítems que marcaste.</p>
      {!results && <p><output>Cargando tu avance…</output></p>}
      {results && (
        <div className={styles.results}>
          {results.inspections.status === 'rejected' && <p role="alert">No pudimos cargar tus inspecciones.</p>}
          {inspections?.inspecciones.length === 0 && (
            <div className={styles.empty}>
              <h3>Todavía no empezaste una inspección.</h3>
              <p>Cuando revises un auto desde su ficha, vas a poder retomar el checklist desde acá.</p>
            </div>
          )}
          {inspections?.inspecciones.map(inspection => {
            const summary = summarizeChecklist(inspectionSteps(inspections.pasos), inspection.items_completados)
            return (
              <ChecklistResumeRow
                key={inspection.vehiculo.id}
                title={`Inspección · ${vehicleTitle({ ...inspection.vehiculo, version: null })}`}
                description={inspection.vehiculo.version}
                accessibleTitle={`Inspección · ${vehicleTitle(inspection.vehiculo)}`}
                summary={summary}
                to={`/vehiculos/${inspection.vehiculo.id}/inspeccion`}
                action={summary.complete ? 'VER INSPECCIÓN' : 'CONTINUAR INSPECCIÓN'}
              />
            )
          })}
          {results.transfer.status === 'rejected' && <p role="alert">No pudimos cargar tu transferencia.</p>}
          {transferSummary && (
            <ChecklistResumeRow
              title="Transferencia" summary={transferSummary} to="/transferencia"
              action={transferAction}
            />
          )}
          {failed && (
            <Button type="button" variant="secondary" className={styles.retry} onClick={() => {
              setResults(undefined)
              setAttempt(current => current + 1)
            }}>REINTENTAR</Button>
          )}
        </div>
      )}
    </section>
  )
}
