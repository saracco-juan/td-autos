import styles from './ErrorState.module.css'

export type ErrorKind = 'network' | 'server'

const COPY: Record<ErrorKind, { title: string; body: string }> = {
  network: {
    title: 'Sin conexión con el servidor',
    body: 'No pudimos conectarnos. Revisá tu conexión a internet e intentá de nuevo.',
  },
  server: {
    title: 'Algo salió mal',
    body: 'No pudimos cargar la información. Intentá de nuevo en unos minutos.',
  },
}

// Icon paths adapted from Lucide (ISC license): wifi-off and triangle-alert.
function ErrorIcon({ kind }: { kind: ErrorKind }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="48"
      height="48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon={kind}
    >
      {kind === 'network' ? (
        <>
          <path d="M12 20h.01" />
          <path d="M8.5 16.429a5 5 0 0 1 7 0" />
          <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
          <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
          <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
          <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
          <path d="m2 2 20 20" />
        </>
      ) : (
        <>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  )
}

// Full-block error for data that failed to load.
export default function ErrorState({ kind }: { kind: ErrorKind }) {
  const { title, body } = COPY[kind]
  return (
    <section role="alert" className={styles.state}>
      <ErrorIcon kind={kind} />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
    </section>
  )
}
