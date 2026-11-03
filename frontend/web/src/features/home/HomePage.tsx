import { Link } from 'react-router'
import { useAuth } from '../auth/session/useAuth'
import buttonStyles from '../../components/button.module.css'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <img className={styles.heroImage} src="/images/home-ferrari.webp" alt="Ferrari roja de frente, con faros encendidos e iluminación roja en un estudio oscuro" width="1536" height="1024" fetchPriority="high" />
        <div className={styles.heroContent}>
          <h1 id="home-title">Tu próximo auto. <br /><span>Tu próxima historia.</span></h1>
          <p>Descubrí el vehículo que acompaña tu forma de vivir. <br />Compará tus opciones y elegí con más información.</p>
        </div>
        <div className={styles.heroBottom}>
          <Link className={`${buttonStyles.button} ${styles.action} ${styles.heroButton}`} to={user ? '/recomendaciones' : '/registro'}>
            {user ? 'Ver mis recomendados' : 'Encontrar mi auto'}
            <Arrow />
          </Link>
          <a className={styles.explore} href="#como-funciona">Descubrí TD Autos <span aria-hidden="true">↓</span></a>
          <span className={styles.imageNote}>Imagen conceptual generada con IA.</span>
        </div>
      </section>

      <section className={`${styles.section} ${styles.product}`} id="como-funciona" aria-labelledby="overview-title">
        <div className={styles.sectionHeading}>
          <h2 id="overview-title">Menos dudas. <br /><span>Más información.</span></h2>
          <p>Una búsqueda que empieza en vos: tu presupuesto, tus prioridades y el uso que le vas a dar. TD Autos reúne opciones de concesionarias y otros portales para ayudarte a encontrar tu próximo vehículo.</p>
        </div>
        <figure className={styles.productView}>
          <img src="/images/home-recommendations.webp" alt="Vista de recomendaciones de TD Autos con filtros y vehículos del inventario de demostración" width="1360" height="840" loading="lazy" />
          <figcaption>Recomendaciones según tu perfil. Tus favoritos, siempre a mano.</figcaption>
        </figure>
        <div className={styles.productDetails}>
          <div><h3>Tu perfil marca el rumbo</h3><p>Contanos qué necesitás y qué priorizás para orientar las recomendaciones.</p></div>
          <div><h3>Una búsqueda a tu medida</h3><p>Filtrá por precio, año, kilometraje y transmisión. Guardá las opciones que te interesan.</p></div>
          <div><h3>Los motivos, a la vista</h3><p>Conocé por qué aparece cada opción y consultá su ficha antes de avanzar.</p></div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.tools}`} aria-labelledby="tools-title">
        <div className={styles.sectionHeading}>
          <h2 id="tools-title">De la primera mirada <br /><span>a una buena decisión.</span></h2>
          <p>El precio publicado es solo el comienzo. Mirá las diferencias entre tus candidatos y qué puede implicar mantenerlos.</p>
        </div>
        <div className={styles.featureGrid}>
          <article>
            <div className={styles.featureImage}><img src="/images/home-comparison.webp" alt="Comparación de dos vehículos con sus especificaciones técnicas en TD Autos" width="1920" height="919" loading="lazy" /></div>
            <h3>Dos opciones. Todas las diferencias.</h3>
            <p>Compará equipamiento, seguridad, confort y costos. Ocultá lo que coincide para concentrarte en lo que cambia.</p>
          </article>
          <article>
            <div className={styles.featureImage}><img src="/images/home-costs.webp" alt="Calculadora de costos de TD Autos con el detalle de los gastos estimados" width="1440" height="1000" loading="lazy" /></div>
            <h3>Antes de comprar, hacé los números.</h3>
            <p>Estimá gastos de uso y explorá la depreciación del vehículo. Una referencia para planificar tu presupuesto.</p>
          </article>
        </div>
        <div className={styles.checklists}>
          <h3>También te acompañamos en el siguiente paso.</h3>
          <p>Los checklists de inspección y transferencia te ayudan a preparar la visita, revisar el vehículo y organizar la documentación.</p>
          <Link className={`${buttonStyles.button} ${styles.action}`} to={user ? '/diagnostico' : '/registro'}>Empezar mi búsqueda <Arrow /></Link>
        </div>
      </section>

      <section className={styles.dealers} id="concesionarias" aria-labelledby="dealers-title">
        <div className={styles.dealerInner}>
          <h2 id="dealers-title">Tu inventario.<br /><span>Su próximo auto.</span></h2>
          <div className={styles.dealerContent}>
            <p>Un espacio para que tu concesionaria conecte con quienes están buscando un vehículo.</p>
            <ul><li>Publicá y mantené actualizado tu inventario.</li><li>Recibí consultas de compradores interesados.</li><li>Gestioná tus vehículos desde un mismo lugar.</li></ul>
            <div className={styles.dealerActions}>
              <Link className={`${buttonStyles.button} ${styles.action}`} to="/registro/concesionaria">Registrar mi concesionaria <Arrow /></Link>
              <Link className={styles.dealerLogin} to="/login">Ingresar como concesionaria</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Arrow() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
