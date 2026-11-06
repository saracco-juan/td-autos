import type { LeadSummary } from '@shared/leads/types'
import { calculateLeadMetrics } from '@shared/leads/metrics'
import pageStyles from '../pages/LeadsPage.module.css'
import styles from './MetricsOverview.module.css'

export default function MetricsOverview({ data }: { data: LeadSummary }) {
  const metrics = calculateLeadMetrics(data)
  const brandMaximum = Math.max(1, ...metrics.brands.map(({ leads }) => leads))
  return (
    <>
      <section className={`${pageStyles.card} ${styles.summary}`} aria-labelledby="contacts-title">
        <h2 id="contacts-title">Contactos recibidos</h2>
        <strong className={styles.total} aria-label="Total de contactos">{data.total.toLocaleString('es-AR')}</strong>
        <div className={styles.coverageLabel}><span>Vehículos contactados</span><strong>{metrics.coverage}%</strong></div>
        <meter className={pageStyles.bar} min={0} max={100} value={metrics.coverage}
          aria-label="Porcentaje de vehículos contactados" />
        <p>{metrics.contacted} de {metrics.inventory} vehículos recibieron contactos</p>
      </section>
      {data.total > 0 ? <>
        <section className={`${pageStyles.card} ${styles.concentration}`} aria-labelledby="concentration-title">
          <h2 id="concentration-title">Concentración del interés</h2>
          <strong className={styles.total} aria-hidden="true">{metrics.concentration}%</strong>
          <meter className={pageStyles.bar} min={0} max={100} value={metrics.concentration}
            aria-label="Concentración de contactos" />
          <p>de los contactos se concentra en {metrics.topCount === 1 ? 'tu vehículo más consultado' : `tus ${metrics.topCount} vehículos más consultados`}.</p>
        </section>
        <section className={`${pageStyles.card} ${styles.brands}`} aria-labelledby="brands-title">
          <h2 id="brands-title">Contactos por marca</h2>
          <div className={styles.brandList}>
            {metrics.brands.map((brand) => (
              <div key={brand.label} className={styles.brandRow}>
                <span title={brand.label}>{brand.label}</span>
                <strong>{brand.leads}</strong>
                <meter className={pageStyles.bar} min={0} max={brandMaximum}
                  value={brand.leads} aria-label={`Contactos de la marca ${brand.label}`} />
              </div>
            ))}
          </div>
        </section>
      </> : null}
    </>
  )
}
