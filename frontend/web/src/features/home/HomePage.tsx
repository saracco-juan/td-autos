import { Link } from 'react-router'
import { useAuth } from '../auth/session/hooks/useAuth'
import buttonStyles from '../../components/Buttons/button.module.css'
import styles from './HomePage.module.css'
import ScrollCue from '../../components/ScrollCue/ScrollCue'

export default function HomePage() {
  const { user } = useAuth()
  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <img className={styles.heroImage} src="/images/home-vehicles-headlights.webp" alt="Ferrari oscura entre un hatchback y un SUV, rodeados de humo con iluminación roja" width="1536" height="1024" fetchPriority="high" />
        <div className={styles.heroContent}>
          <h1 id="home-title">Tu próximo auto. <br /><span>Tu próxima historia.</span></h1>
          <p>Descubrí el vehículo que acompaña tu forma de vivir. <br />Compará tus opciones y elegí con más información.</p>
        </div>
        <div className={styles.heroBottom}>
          <Link className={`${buttonStyles.button} ${styles.action} ${styles.heroButton}`} to={user ? '/recomendaciones' : '/registro'}>
            {user ? 'Ver mis recomendados' : 'Encontrar mi auto'}
            <Arrow />
          </Link>
          <ScrollCue to="#diagnostico">Descubrí TD Autos</ScrollCue>
        </div>
      </section>

      <div className={styles.journey}>
        {journey.map((step) => (
          <section key={step.id} id={step.id} className={`${styles.step} ${step.dark ? styles.darkStep : ''}`} aria-labelledby={`${step.id}-title`}>
            <div className={styles.stepInner}>
              <h2 id={`${step.id}-title`} className={styles.stepTitle}>
                <span data-reveal>{step.title}</span>{' '}<span data-reveal>{step.emphasis}</span>
              </h2>
              <div className={styles.stepCopy} data-reveal>
                <h3>{step.feature}</h3>
                <p>{step.description}</p>
              </div>
              <dl className={styles.stepDetails}>
                {step.details.map(([title, description]) => (
                  <div key={title} data-reveal><dt>{title}</dt><dd>{description}</dd></div>
                ))}
              </dl>
            </div>
          </section>
        ))}
        <div className={styles.journeyAction}>
          <Link className={`${buttonStyles.button} ${styles.action}`} to={user ? '/diagnostico' : '/registro'}>Empezar mi búsqueda <Arrow /></Link>
        </div>
      </div>

      <section className={styles.dealers} id="concesionarias" aria-labelledby="dealers-title">
        <div className={styles.dealerInner}>
          <h2 id="dealers-title" data-reveal>Tu inventario.<br /><span>Su próximo auto.</span></h2>
          <div className={styles.dealerContent} data-reveal>
            <p>Un espacio para que tu concesionaria conecte con quienes están buscando un vehículo.</p>
            <ul><li>Publicá y mantené actualizado tu inventario.</li><li>Recibí consultas de compradores interesados.</li><li>Gestioná tus vehículos desde un mismo lugar.</li></ul>
            <div className={styles.dealerActions}>
              <Link className={`${buttonStyles.button} ${styles.action}`} to="/registro/concesionaria">Registrar mi concesionaria <Arrow /></Link>
              <Link className={`${buttonStyles.button} ${styles.action} ${styles.dealerLogin}`} to="/login">Ingresar como concesionaria <Arrow /></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

const journey = [
  {
    id: 'diagnostico', title: 'El auto correcto', emphasis: 'empieza por vos.', feature: 'Un diagnóstico para orientar tu búsqueda.',
    description: 'Contanos cómo lo vas a usar, cuánto querés invertir y qué valorás más. Tus respuestas son el punto de partida para encontrar opciones que tengan sentido para vos.',
    details: [['Tu presupuesto', 'Definí un rango para enfocar la búsqueda.'], ['Tu uso', 'Elegí el uso que necesitás darle al vehículo.'], ['Tus prioridades', 'Indicá qué pesa más en tu decisión.']],
  },
  {
    id: 'busqueda', title: 'Muchas opciones.', emphasis: 'Tus favoritas.', feature: 'Recomendaciones con un motivo.',
    description: 'Explorá vehículos de concesionarias y otros portales según tu perfil. Mirá por qué se recomienda cada opción y guardá las que querés seguir considerando.',
    details: [['Filtrá', 'Ajustá precio, año, kilometraje y transmisión.'], ['Conocé', 'Consultá fotos, equipamiento y ficha técnica.'], ['Guardá', 'Reuní tus candidatos en favoritos.']],
  },
  {
    id: 'comparacion', title: 'Dos candidatos.', emphasis: 'Una decisión más clara.', feature: 'Compará lo que realmente cambia.', dark: true,
    description: 'Poné dos vehículos frente a frente. Revisá sus diferencias en seguridad, confort, equipamiento y costos sin ir y volver entre fichas.',
    details: [['Elegí dos', 'Armá la comparación desde recomendados o favoritos.'], ['Encontrá diferencias', 'Ocultá las similitudes para concentrarte en lo importante.'], ['Profundizá', 'Consultá el cálculo completo de costos de cada opción.']],
  },
  {
    id: 'costos', title: 'Más allá', emphasis: 'del precio publicado.', feature: 'Costos y depreciación, en perspectiva.',
    description: 'Antes de avanzar, estimá cuánto puede costar mantenerlo y explorá cómo varía el valor de referencia según el año del modelo. Más contexto para planificar tu compra.',
    details: [['Compra', 'Consultá el precio y la estimación de transferencia.'], ['Uso', 'Ajustá kilómetros y seguro para estimar los gastos.'], ['Depreciación', 'Compará valores de referencia entre años de modelo.']],
  },
  {
    id: 'checklists', title: 'Llegá a la visita', emphasis: 'con las preguntas claras.', feature: 'Checklists de inspección y transferencia.',
    description: 'Revisá el vehículo paso a paso y organizá la documentación. Una guía para acompañarte desde la primera inspección hasta los trámites de transferencia.',
    details: [['Inspeccioná', 'Recorré los puntos de revisión y marcá cada ítem.'], ['Organizá', 'Seguí las etapas de la transferencia.'], ['Repasá', 'Consultá el resumen de lo que completaste.']],
  },
]

function Arrow() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
