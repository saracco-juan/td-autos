import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '../model/AuthContext'

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within an AuthProvider')
  return value
}
