import { useEffect, useRef } from 'react'
import type { LeadSummary } from '@shared/leads/types'
import { calculateLeadMetrics } from '@shared/leads/metrics'
import pageStyles from './LeadsPage.module.css'
import styles from './MetricsOverview.module.css'

function ConcentrationGauge({ value }: { value: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (typeof CanvasRenderingContext2D === 'undefined') return
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const tokens = getComputedStyle(document.documentElement)
    context.clearRect(0, 0, 400, 240)
    context.lineWidth = 28
    context.lineCap = 'round'
    const arc = (end: number, color: string) => {
      context.beginPath()
      context.strokeStyle = tokens.getPropertyValue(color).trim()
      context.arc(200, 205, 160, Math.PI, end)
      context.stroke()
    }
    arc(2 * Math.PI, '--surface-raised')
    if (value > 0) arc(Math.PI + Math.PI * value / 100, '--accent-default')
  }, [value])
  return (
    <div role="meter" aria-label="Concentración de contactos" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={value} className={styles.gauge}>
      <canvas ref={canvas} width={400} height={240} aria-hidden="true" />
      <strong aria-hidden="true">{value}%</strong>
    </div>
  )
}

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
        <section className={`${pageStyles.card} ${styles.brands}`} aria-labelledby="brands-title">
          <h2 id="brands-title">Contactos por marca</h2>
          <div className={styles.brandChart}>
            {metrics.brands.map((brand) => (
              <div key={brand.label} className={styles.column}>
                <strong>{brand.leads}</strong>
                <div className={styles.track}>
                  <meter className={`${pageStyles.bar} ${styles.verticalBar}`} min={0} max={brandMaximum}
                    value={brand.leads} aria-label={`Contactos de la marca ${brand.label}`} />
                </div>
                <span title={brand.label}>{brand.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className={`${pageStyles.card} ${styles.concentration}`} aria-labelledby="concentration-title">
          <h2 id="concentration-title">Concentración del interés</h2>
          <ConcentrationGauge value={metrics.concentration} />
          <p>de los contactos se concentra en {metrics.topCount === 1 ? 'tu vehículo más consultado' : `tus ${metrics.topCount} vehículos más consultados`}.</p>
        </section>
      </> : null}
    </>
  )
}
