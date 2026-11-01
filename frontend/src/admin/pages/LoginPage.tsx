import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const { login, notice, clearNotice } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0) // a new number replays the shake
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    clearNotice()
    setBusy(true)
    try {
      await login(email, password)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.')
      setAttempts((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="brand brand-large">
          <span className="brand-mark" aria-hidden="true">RT</span>
          <span className="brand-text">
            <strong>RTU Tindahan</strong>
            <small>Admin area</small>
          </span>
        </div>
        <h1>Sign in</h1>
        <p className="muted">Use your RTU staff account. Students sign in on the main site.</p>

        {notice && !error && <p className="alert alert-info" role="status">{notice}</p>}
        {error && <p key={attempts} className="alert alert-error shake" role="alert">{error}</p>}

        <label className="field">
          <span>RTU email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            placeholder="name@rtu.edu.ph"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

/** Shown when a valid account has no role that can use the admin area. */
export function NoAccess({ roleLabel }: { roleLabel: string }) {
  const { logout } = useAuth()
  return (
    <div className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <div className="login-card">
        <h1>No access</h1>
        <p className="muted">
          Your account is a {roleLabel}. The admin area is for Office Staff, Moderators, and
          Administrators.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
