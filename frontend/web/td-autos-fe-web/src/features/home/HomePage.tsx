import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { HttpError } from '../../lib/http'
import { fetchCurrentUser } from '../auth/api'
import type { User } from '../auth/types'

const LOAD_ERROR = 'No se pudo cargar la información del usuario.'

// Main screen placeholder: shows the logged-in user, or sends guests to the register page.
export default function HomePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    fetchCurrentUser()
      .then((current) => {
        if (active) setUser(current)
      })
      .catch((failure: unknown) => {
        if (!active) return
        if (failure instanceof HttpError && failure.status === 401) {
          navigate('/registro', { replace: true })
        } else {
          setError(LOAD_ERROR)
        }
      })
    return () => {
      active = false
    }
  }, [navigate])

  return (
    <main>
      <h1>Inicio</h1>
      {error ? <p role="alert">{error}</p> : null}
      {user ? (
        <section aria-label="Usuario">
          <p>{[user.name, user.apellido].filter(Boolean).join(' ')}</p>
          <p>{user.email}</p>
        </section>
      ) : null}
    </main>
  )
}
