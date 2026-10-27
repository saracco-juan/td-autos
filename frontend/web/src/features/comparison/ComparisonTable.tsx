import { Fragment, useState } from 'react'
import { Link } from 'react-router'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { equipmentValue, specificationGroups, type SpecificationRow } from '@shared/vehicles/detail'
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
  return [
    { title: 'Publicación', rows: [
      { label: 'Precio publicado', value: vehicle.precio === null || vehicle.moneda === null
        ? 'No disponible' : formatPrice(vehicle.precio, vehicle.moneda) },
      { label: 'Compatibilidad con tu perfil', value: score(recommendation.score) },
      { label: 'Fuente', value: `Concesionaria verificada · ${dealer.nombre}` },
    ] },
    ...specificationGroups(vehicle),
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
  return (
    <>
      <p>Los motivos reflejan tu diagnóstico, no una probabilidad de satisfacción. No indican un ganador absoluto.</p>
      <p>Costos orientativos de la calculadora, con sus valores predeterminados. Los totales parciales excluyen los conceptos indicados.</p>
      <div className={styles.viewport} tabIndex={0} role="region" aria-label="Desplazá la comparación para ver ambos vehículos">
        <table className={styles.table} aria-label="Comparación de vehículos">
          <thead><tr>
            <th scope="col">Características</th>
            {entries.map(({ id, detail: { vehicle } }) => {
              const title = vehicleTitle(vehicle)
              return <th key={id} scope="col">
                <Photo key={vehicle.fotos[0]?.url} url={vehicle.fotos[0]?.url} title={title} />
                <h2>{title}</h2>
                <button type="button" className={buttonStyles.button} aria-label={`Quitar ${title}`} onClick={() => onRemove(id)}>QUITAR</button>
              </th>
            })}
          </tr></thead>
          <tbody>
            {columns[0].map(({ title, rows }, groupIndex) => <Fragment key={title}>
              <tr className={styles.group}><th colSpan={3} scope="colgroup">{title}</th></tr>
              {rows.map(({ label, explanation }, rowIndex) => <tr key={label}>
                <th scope="row">{label}{explanation ? <small>{explanation}</small> : null}</th>
                {entries.map(({ id }, columnIndex) => <td key={id}>{columns[columnIndex][groupIndex].rows[rowIndex].value}</td>)}
              </tr>)}
            </Fragment>)}
            <tr><th scope="row">Calculadora</th>{entries.map(({ id }) => <td key={id}>
              <Link className={buttonStyles.button} to={`/vehiculos/${id}/costos`}>VER CÁLCULO COMPLETO</Link>
            </td>)}</tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
