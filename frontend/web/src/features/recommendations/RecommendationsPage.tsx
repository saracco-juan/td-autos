import styles from './RecommendationsPage.module.css'

// Provisional screen (D3): confirms the saved diagnosis until HU05 replaces it with the real recommendations.
export default function RecommendationsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Recomendaciones</h1>
        <p className={styles.subtitle}>
          Guardamos tu diagnóstico. Las recomendaciones van a estar disponibles pronto.
        </p>
      </div>
    </div>
  )
}
