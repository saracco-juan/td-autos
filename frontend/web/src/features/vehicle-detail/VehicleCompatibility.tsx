import type { DetailContext } from './navigation'
import styles from './VehicleSpecifications.module.css'

export default function VehicleCompatibility({ context }: { context: DetailContext | null }) {
  const number = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 1 })
  return (
    <section className={styles.card} aria-label="Coincidencia con tu perfil">
      <h2>Por qué coincide con tu perfil</h2>
      {context ? (
        <>
          <p>{number(context.score)}% de compatibilidad</p>
          <p>Uso que elegiste: {number(context.factors.usage)}/100</p>
          <p>Carrocería que elegiste: {number(context.factors.body)}/100</p>
          <p>Prioridad principal: {context.factors.priority === null ? 'no disponible' : `${number(context.factors.priority)}/100`}</p>
          <p>Confort: {number(context.factors.comfort)}/100</p>
          <small>Corresponde a la recomendación desde la que abriste la ficha. No garantiza satisfacción ni el estado del vehículo.</small>
        </>
      ) : <p>Abrí esta ficha desde tus recomendaciones para consultar su compatibilidad.</p>}
    </section>
  )
}
