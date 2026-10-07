import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import { HttpError, NetworkError } from '../../lib/http'
import { fetchCurrentUser } from '../auth/api'
import type { User } from '../auth/types'

// Main screen placeholder: shows the logged-in user, or sends guests to the register page.
export default function HomePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User>()
  const [error, setError] = useState<ErrorKind>()

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
          setError(failure instanceof NetworkError ? 'network' : 'server')
        }
      })
    return () => {
      active = false
    }
  }, [navigate])

  if (error) return <ErrorState kind={error} />

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
