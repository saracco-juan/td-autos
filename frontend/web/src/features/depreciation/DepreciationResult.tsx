import type { DepreciationProjection, DepreciationReference } from '@shared/depreciation/types'
import { formatPrice } from '@shared/recommendations/format'
import styles from './DepreciationResult.module.css'

const percent = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`

function ProjectionChart({ projection }: { projection: DepreciationProjection }) {
  const values = [{ years: 0, value: projection.current_value }, ...projection.points]
  const maximum = Math.max(...values.map(({ value }) => value))
  const coordinates = values.map(({ years, value }) => ({ x: 30 + years / 5 * 680, y: 200 - value / maximum * 160 }))
  const path = coordinates.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  return (
    <svg viewBox="0 0 740 240" className={styles.chart} role="img"
      aria-label="Proyección del valor publicado a 1, 3 y 5 años">
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
            {point.years === 0 ? 'Hoy' : `${point.years} ${point.years === 1 ? 'año' : 'años'}`}
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
          <p className={styles.legend}>Este vehículo · estimación a partir del precio publicado</p>
        </section>
        <h2 className={styles.caption}>CÓMO SE CALCULA</h2>
        <div className={styles.factors}>
          <section className={styles.card}>
            <h3>Referencias del vehículo</h3>
            <p>Usamos precios de referencia ACARA de distintos años de modelo, no un historial de precios.</p>
            <p>Años de referencia: {reference.years_used.join(', ')}.</p>
            {reference.source_date ? <p>Fecha de referencia: {reference.source_date}.</p> : null}
            {reference.reference_count > 1 ? <p>Estimación con {reference.reference_count} referencias compatibles.</p> : null}
            {reference.approximate_model ? <p>Referencia aproximada de un modelo similar: {reference.approximate_model}.</p> : null}
          </section>
          <section className={styles.card}>
            <h3>Estado de la unidad</h3>
            <p>{kilometers === null ? 'Kilometraje no informado.' : `Kilometraje publicado: ${kilometers.toLocaleString('es-AR')} km.`}</p>
            <p>El uso, el mantenimiento y el estado pueden modificar el valor de reventa. Esta estimación no aplica ajustes por kilometraje.</p>
          </section>
        </div>
        <p className={styles.rate}><span>Depreciación anual estimada</span><strong>{percent(projection.annual_depreciation_percent)} anual</strong></p>
        {projection.annual_depreciation_percent < 0 ? <p>El porcentaje negativo indica un aumento estimado del valor según las referencias disponibles.</p> : null}
        {reference.stale ? <p role="status">Los valores de referencia pueden estar desactualizados.</p> : null}
        <p className={styles.note}>Aplicamos la misma tasa anual de forma acumulada al precio publicado. Es una estimación orientativa, sin ajuste por inflación ni tipo de cambio. No garantiza un precio futuro ni reemplaza una tasación.</p>
      </div>
      <div className={styles.summary}>
        <table aria-label="Valor proyectado">
          <caption>VALOR PROYECTADO</caption>
          <tbody>
            <tr><th scope="row">Valor actual</th><td><strong>{formatPrice(projection.current_value, projection.currency)}</strong></td></tr>
            {projection.points.map((point) => <tr key={point.years}>
              <th scope="row">En {point.years} {point.years === 1 ? 'año' : 'años'}</th>
              <td>{formatPrice(point.value, projection.currency)} · {percent(point.retained_percent)}</td>
            </tr>)}
          </tbody>
        </table>
        <p className={styles.note}>Los porcentajes indican el valor conservado respecto del precio publicado.</p>
      </div>
    </div>
  )
}
