import { useAuth } from '../auth/session/useAuth'

// Main screen placeholder: shows the logged-in user. The route guard keeps guests out.
export default function HomePage() {
  const { user } = useAuth()

  return (
    <div>
      <h1>Inicio</h1>
      {user ? (
        <section aria-label="Usuario">
          <p>{[user.name, user.apellido].filter(Boolean).join(' ')}</p>
          <p>{user.email}</p>
        </section>
      ) : null}
    </div>
  )
}
