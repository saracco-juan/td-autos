import { Link } from 'react-router'
import buttonStyles from '../../components/button.module.css'
import ErrorState from '../../components/ErrorState'
import screenStyles from '../../components/screen.module.css'
import SessionLoading from '../auth/session/SessionLoading'
import styles from './admin.module.css'
import { useDealerDirectory } from './useDealerDirectory'

// Admin dashboard (Figma 2101:1493, UH19): dealer counts and the Concesionarias area.
export default function AdminDashboardPage() {
  const { state, retry } = useDealerDirectory()

  // The loader and the error are direct children of the content area so they are centered there.
  if (state === 'loading') return <SessionLoading />
  if ('error' in state) return <ErrorState kind={state.error} onRetry={retry} />

  const { activas, pendientes, inactivas } = state.data.conteos
  const stats = [
    { label: 'Concesionarias activas', value: activas },
    { label: 'Pendientes de aprobación', value: pendientes },
    { label: 'Inactivas', value: inactivas, muted: true },
  ]

  return (
    // A centered column: the dashboard does not need the full width (DESIGN.md).
    <div className={`${screenStyles.page} ${styles.dashboard}`}>
      <div className={styles.header}>
        <p className={screenStyles.eyebrow}>ADMINISTRACIÓN</p>
        <h1 className={screenStyles.title}>Panel de administración</h1>
        <p className={styles.subtitle}>Gestioná las concesionarias registradas en la plataforma.</p>
      </div>
      <div className={styles.stats}>
        {stats.map(({ label, value, muted }) => (
          <div key={label} role="group" aria-label={label} className={styles.card}>
            <p className={styles.statLabel}>{label}</p>
            <p className={`${styles.statValue} ${muted ? styles.statMuted : ''}`}>{value}</p>
          </div>
        ))}
      </div>
      <p className={styles.sectionLabel}>ÁREAS</p>
      <section className={styles.card} aria-labelledby="admin-area-dealers">
        <h2 id="admin-area-dealers" className={styles.cardTitle}>
          Concesionarias
        </h2>
        <p className={styles.cardBody}>Revisá altas nuevas, aprobá comprobantes y editá los datos de cada concesionaria.</p>
        <Link to="/admin/concesionarias" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.areaAction}`}>
          VER CONCESIONARIAS
        </Link>
      </section>
    </div>
  )
}
