import { useState } from 'react'
import { navigate } from '@/common/router/router'
import { LoginForm } from '../components/LoginForm'
import { useAuth } from '../AuthContext'
import type { LoginCredentials } from '../types'
import './LoginPage.css'

/** The sign-in page. Signing in uses the real backend through AuthContext. */
export function LoginPage() {
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async ({ email, password }: LoginCredentials) => {
    setIsLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate('', { replace: true }) // the home route shows the marketplace once signed in
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <LoginForm onSubmit={handleLogin} isLoading={isLoading} error={error} />
    </div>
  )
}
