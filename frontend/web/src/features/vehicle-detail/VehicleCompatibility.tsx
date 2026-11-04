import InfoTip from '../../components/InfoTip/InfoTip'
import type { DetailContext } from './navigation'
import styles from './VehicleCompatibility.module.css'

const number = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 1 })

export default function VehicleCompatibility({ context }: { context: DetailContext | null }) {
  const metrics = context ? [
    { label: context.usageLabel ?? 'Uso', value: context.factors.usage,
      explanation: context.usageLabel ? `Elegiste ${context.usageLabel.toLocaleLowerCase('es-AR')} como uso principal.` : 'Coincidencia con el uso de tu diagnóstico.' },
    { label: 'Carrocería', value: context.factors.body },
    { label: context.priorityLabel ?? 'Prioridad', value: context.factors.priority,
      explanation: context.priorityLabel ? `Elegiste ${context.priorityLabel.toLocaleLowerCase('es-AR')} como prioridad principal.` : 'Coincidencia con la prioridad de tu diagnóstico.' },
    { label: 'Confort', value: context.factors.comfort },
  ] : []

  return (
    <section className={styles.section} aria-label="Coincidencia con tu perfil">
      <div className={styles.heading}>
        <h2>Por qué coincide con tu perfil</h2>
        {context ? <p>{number(context.score)}% de compatibilidad</p> : null}
      </div>
      {context ? <>
        <div className={styles.metrics}>
          {metrics.map(({ label, value, explanation }, index) => (
            <div className={styles.metric} key={index}>
              {value !== null ? <>
                <div className={styles.scale} aria-hidden="true"><span>0%</span><span>100%</span></div>
                <div className={styles.track} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
                  <span style={{ width: `${value}%` }} />
                </div>
                <p className={styles.score}>{number(value)}<span>%</span></p>
              </> : <p className={styles.unavailable}>Sin datos</p>}
              <div className={styles.label}>
                <h3>{label}</h3>
                {explanation ? <InfoTip label={`Sobre ${label.toLocaleLowerCase('es-AR')}`}>{explanation}</InfoTip> : null}
              </div>
            </div>
          ))}
        </div>
        <p className={styles.note}>Coincidencia con el diagnóstico de esta recomendación. No garantiza el estado del vehículo.</p>
      </> : <p>Abrí esta ficha desde tus recomendaciones para consultar su compatibilidad.</p>}
    </section>
  )
}
