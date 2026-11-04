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
      <path d="M30,200 H710" className={styles.axis} />
      <g className={styles.chartReveal}>
        <path d={`${path} L710,200 L30,200 Z`} className={styles.area} />
        <path d={path} className={styles.curve} />
        {coordinates.map(({ x, y }, index) => <circle key={values[index].years} cx={x} cy={y} r="4" />)}
      </g>
      {values.map((point, index) => {
        const { x, y } = coordinates[index]
        const anchor = index === 0 ? 'start' : index === values.length - 1 ? 'end' : 'middle'
        return <g key={point.years}>
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
  const [, ...referenceDetails] = referenceLines(reference)
  return (
    <div className={styles.body}>
      <section className={styles.projection} aria-labelledby="projection-title">
        <h2 id="projection-title">Valor proyectado en el tiempo</h2>
        <p className={styles.rate}><span>Depreciación anual estimada</span><strong>{formatPercent(projection.annual_depreciation_percent)} anual</strong></p>
        <ProjectionChart projection={projection} />
        <p className={styles.legend}>{depreciationCopy.legend}</p>
      </section>
      <div className={styles.summary}>
        <table aria-label="Valor proyectado">
          <caption>Valor proyectado</caption>
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
      <section className={styles.explanation} aria-labelledby="calculation-title">
        <h2 id="calculation-title">Cómo se calcula</h2>
        <div className={styles.factors}>
          <section>
            <h3>Referencias del vehículo</h3>
            {referenceDetails.map(line => <p key={line}>{line}</p>)}
          </section>
          <section>
            <h3>Estado de la unidad</h3>
            <p>{mileageDescription(kilometers)}</p>
            <p>{depreciationCopy.condition}</p>
          </section>
        </div>
        {projection.annual_depreciation_percent < 0 ? <p>{depreciationCopy.appreciation}</p> : null}
        {reference.stale ? <p role="status">{depreciationCopy.stale}</p> : null}
        <p className={styles.note}>{depreciationCopy.caveat}</p>
      </section>
    </div>
  )
}
