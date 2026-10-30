import type { DepreciationProjection, DepreciationReference } from '@shared/depreciation/types'
import { chartGeometry, depreciationCopy, formatPercent, mileageDescription, referenceLines, yearLabel } from '@shared/depreciation/presentation'
import { formatPrice } from '@shared/recommendations/format'
import styles from './DepreciationResult.module.css'

function ProjectionChart({ projection }: { projection: DepreciationProjection }) {
  const { values, coordinates, path } = chartGeometry(projection)
  return (
    <svg viewBox="0 0 740 240" className={styles.chart} role="img"
      aria-label={depreciationCopy.chartLabel}>
      <desc>Los importes y porcentajes de esta estimación están en la tabla Valor proyectado.</desc>
      <path d={`${path} L710,200 L30,200 Z`} className={styles.area} />
      <path d="M30,200 H710" className={styles.axis} />
      <path d={path} className={styles.curve} />
      {values.map((point, index) => {
        const { x, y } = coordinates[index]
        const anchor = index === 0 ? 'start' : index === values.length - 1 ? 'end' : 'middle'
        return <g key={point.years}>
          <circle cx={x} cy={y} r="4" />
          <text x={x} y={y - 14} textAnchor={anchor} className={styles.chartValue}>
            {formatPrice(point.value, projection.currency)}
          </text>
          <text x={x} y="226" textAnchor={anchor} className={styles.chartYear}>
            {point.years === 0 ? 'Hoy' : yearLabel(point.years)}
          </text>
        </g>
      })}
    </svg>
  )
}

export default function DepreciationResult({ projection, reference, kilometers }: {
  projection: DepreciationProjection; reference: DepreciationReference; kilometers: number | null
}) {
  return (
    <div className={styles.body}>
      <div className={styles.main}>
        <section className={styles.card} aria-labelledby="projection-title">
          <h2 id="projection-title">Valor proyectado en el tiempo</h2>
          <ProjectionChart projection={projection} />
          <p className={styles.legend}>{depreciationCopy.legend}</p>
        </section>
        <h2 className={styles.caption}>CÓMO SE CALCULA</h2>
        <div className={styles.factors}>
          <section className={styles.card}>
            <h3>Referencias del vehículo</h3>
            {referenceLines(reference).map(line => <p key={line}>{line}</p>)}
          </section>
          <section className={styles.card}>
            <h3>Estado de la unidad</h3>
            <p>{mileageDescription(kilometers)}</p>
            <p>{depreciationCopy.condition}</p>
          </section>
        </div>
        <p className={styles.rate}><span>Depreciación anual estimada</span><strong>{formatPercent(projection.annual_depreciation_percent)} anual</strong></p>
        {projection.annual_depreciation_percent < 0 ? <p>{depreciationCopy.appreciation}</p> : null}
        {reference.stale ? <p role="status">{depreciationCopy.stale}</p> : null}
        <p className={styles.note}>{depreciationCopy.caveat}</p>
      </div>
      <div className={styles.summary}>
        <table aria-label="Valor proyectado">
          <caption>VALOR PROYECTADO</caption>
          <tbody>
            <tr><th scope="row">Valor actual</th><td><strong>{formatPrice(projection.current_value, projection.currency)}</strong></td></tr>
            {projection.points.map((point) => <tr key={point.years}>
              <th scope="row">En {yearLabel(point.years)}</th>
              <td>{formatPrice(point.value, projection.currency)} · {formatPercent(point.retained_percent)}</td>
            </tr>)}
          </tbody>
        </table>
        <p className={styles.note}>{depreciationCopy.retained}</p>
      </div>
    </div>
  )
}
