import { Fragment, useState } from 'react'
import { Link } from 'react-router'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { equipmentValue, specificationGroups, type SpecificationRow } from '@shared/vehicles/detail'
import InfoTip from '../../components/InfoTip'
import buttonStyles from '../../components/button.module.css'
import { formatPrice } from '../inventory/format'
import { EQUIPMENT_GROUPS } from '../inventory/matchingFields'
import { formatDate } from '../costs/format'
import type { OwnershipCosts } from '../costs/types'
import type { Recommendation } from '../recommendations/matching'
import type { VehicleDetailResponse } from '../vehicle-detail/types'
import styles from './ComparisonTable.module.css'

export type ComparisonEntry = {
  id: number
  detail: VehicleDetailResponse
  recommendation: Pick<Recommendation, 'score' | 'components' | 'warnings' | 'budget_excess_percent'>
  costs: Pick<OwnershipCosts, 'inputs' | 'purchase' | 'monthly' | 'yearly' | 'rates_updated_at'>
}
type Group = { title: string; rows: SpecificationRow[] }
const score = (value: number | null) => value === null ? 'No disponible'
  : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}/100`

function groups({ detail: { vehicle, dealer }, recommendation, costs }: ComparisonEntry): Group[] {
  const partial = costs.monthly.not_estimated.length > 0 ? ' (parcial)' : ''
  const [general, ...technical] = specificationGroups(vehicle)
  const overview = ['Año', 'Kilometraje', 'Transmisión', 'Combustible', 'Ubicación']
  return [
    { title: 'Publicación', rows: [
      { label: 'Precio publicado', value: vehicle.precio === null || vehicle.moneda === null
        ? 'No disponible' : formatPrice(vehicle.precio, vehicle.moneda) },
      { label: 'Coincidencia', value: score(recommendation.score).replace('/100', '%') },
      ...overview.flatMap((label) => general.rows.filter((row) => row.label === label)),
      { label: 'Fuente', value: `Concesionaria verificada · ${dealer.nombre}` },
    ] },
    { ...general, rows: general.rows.filter((row) => !overview.includes(row.label)) },
    ...technical,
    ...Object.entries(EQUIPMENT_GROUPS).map(([title, fields]) => ({ title,
      rows: fields.map(([key, label]) => ({ label, value: equipmentValue(vehicle[key]) })),
    })),
    { title: 'Ventajas según tu diagnóstico', rows: [
      { label: 'Compatibilidad con tu uso', value: score(recommendation.components.usage) },
      { label: 'Compatibilidad con tu carrocería', value: score(recommendation.components.body) },
      { label: 'Compatibilidad con tu prioridad', value: score(recommendation.components.priority) },
      { label: 'Compatibilidad con tu confort', value: score(recommendation.components.comfort) },
      { label: 'Advertencias', value: [
        recommendation.warnings.includes('budget_exceeded') ? 'Supera tu presupuesto.' : '',
        recommendation.warnings.includes('body_mismatch') ? 'No coincide con tu carrocería.' : '',
        recommendation.warnings.includes('resale_unavailable') ? 'Reventa no disponible: compatibilidad parcial.' : '',
        recommendation.warnings.includes('resale_stale') ? 'Reventa pendiente de actualización.' : '',
      ].filter(Boolean).join(' ') || 'Sin advertencias de compatibilidad.' },
    ] },
    { title: 'Costos estimados en ARS', rows: [
      { label: 'Compra con transferencia', value: formatPrice(costs.purchase.total) },
      { label: 'Total mensual', value: formatPrice(costs.monthly.total) + partial },
      { label: 'Total anual con service', value: formatPrice(costs.yearly.total) + partial },
      { label: 'Costos no incluidos', value: costs.monthly.not_estimated.join(', ') || 'Ninguno informado' },
      { label: 'Kilómetros por mes', value: `${costs.inputs.km_per_month.toLocaleString('es-AR')} km (${costs.inputs.km_source === 'diagnostico' ? 'tu diagnóstico' : 'valor estimado'})` },
      { label: 'Seguro', value: costs.inputs.coverage === 'todo_riesgo' ? 'Todo riesgo' : 'Terceros completo' },
      { label: 'Valores actualizados al', value: formatDate(costs.rates_updated_at) },
    ] },
  ]
}

function Photo({ url, title }: { url: string | undefined; title: string }) {
  const [failed, setFailed] = useState(false)
  return url && !failed ? <img className={styles.photo} src={url} alt={`Foto de ${title}`}
    onError={() => setFailed(true)} /> : <div className={styles.photo}>Fotos no disponibles.</div>
}

export default function ComparisonTable({ entries, onRemove }: {
  entries: [ComparisonEntry, ComparisonEntry]; onRemove: (id: number) => void
}) {
  const columns = entries.map(groups)
  const rowCount = 2 + columns[0].reduce((count, group) => count + 1 + group.rows.length, 0)
  return (
    <>
      <details className={styles.notes}>
        <summary>Sobre la comparación y los costos</summary>
        <p>Los motivos reflejan tu diagnóstico, no una probabilidad de satisfacción. No indican un ganador absoluto.</p>
        <p>Costos orientativos de la calculadora, con sus valores predeterminados. Los totales parciales excluyen los conceptos indicados.</p>
      </details>
      <div className={styles.viewport} tabIndex={0} role="region" aria-label="Comparación de vehículos">
        <div className={styles.cards}>
          {entries.map(({ id, detail: { vehicle } }, columnIndex) => {
            const title = vehicleTitle(vehicle)
            return <article key={id} className={styles.card} aria-labelledby={`comparison-${id}`}
              style={{ gridRow: `1 / span ${rowCount}` }}>
              <Photo key={vehicle.fotos[0]?.url} url={vehicle.fotos[0]?.url} title={title} />
              <div className={styles.intro}>
                <h2 id={`comparison-${id}`}>{title}</h2>
                <button type="button" className={`${buttonStyles.button} ${styles.remove}`}
                  aria-label={`Quitar ${title}`} onClick={() => onRemove(id)}>QUITAR</button>
              </div>
              {columns[columnIndex].map(({ title: groupTitle, rows }, groupIndex) => <Fragment key={groupTitle}>
                {groupIndex > 0 ? <h3 className={styles.group}>{groupTitle}</h3> : null}
                <dl className={styles.facts} style={{ gridRow: `span ${rows.length}` }}>
                  {rows.map(({ label, value, explanation }) => <div className={styles.fact} key={label}>
                    <dt>{label}{explanation ? <> <InfoTip label={`Sobre ${label} de ${title}`}>{explanation}</InfoTip></> : null}</dt>
                    <dd>{value}</dd>
                  </div>)}
                </dl>
              </Fragment>)}
              <div className={styles.footer}>
                <Link className={buttonStyles.button} to={`/vehiculos/${id}/costos`}>VER CÁLCULO COMPLETO</Link>
              </div>
            </article>
          })}
        </div>
      </div>
    </>
  )
}
