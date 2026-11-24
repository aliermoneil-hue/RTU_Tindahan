'use client'

import { useState, useEffect } from 'react'
import { navigate } from '@/common/router/router'
import { Icon } from '@/common/components/Icon'
import { Button } from '@/common/components/Button'
import type { LoginCredentials } from '../types'

interface LoginFormProps {
  onSubmit: (data: LoginCredentials) => void
  isLoading: boolean
  error: string | null
  onForgotPassword: () => void
  /** Active lock, if any. */
  lock: { kind: 'cooldown' | 'restricted'; until: number } | null
  /** How many attempts remain before the next penalty. */
  attemptsLeft: number | null
  /** What the next penalty will be. */
  nextPenalty: string | null
  /** Email restored from sessionStorage. */
  defaultEmail: string
  /** Called when the email field loses focus. */
  onEmailBlur: (email: string) => void
  /** Seconds remaining on the current lock (0 when none). */
  remainingSeconds: number
}

export function LoginForm({
  onSubmit,
  isLoading,
  error,
  onForgotPassword,
  lock,
  attemptsLeft,
  nextPenalty,
  defaultEmail,
  onEmailBlur,
  remainingSeconds,
}: LoginFormProps) {
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [passErr, setPassErr] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

  // Keep the email in sync with defaultEmail when it changes externally.
  useEffect(() => {
    if (defaultEmail && !email) {
      setEmail(defaultEmail)
    }
  }, [defaultEmail, email])

  const locked = !!lock
  const kind = lock?.kind ?? null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setEmailErr(null)
    setPassErr(null)

    // Frontend-only RTU email format check (backend also validates this)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setEmailErr('Enter your RTU email address.')
      return
    }
    if (!/^[^@\s]+@rtu\.edu\.ph$/.test(trimmed)) {
      setEmailErr('Use your official RTU email, for example 0000-000000@rtu.edu.ph.')
      return
    }
    if (!password) {
      setPassErr('Enter your password.')
      return
    }

    onSubmit({ email: trimmed, password })
  }

  const handleEmailBlur = () => {
    onEmailBlur(email)
  }

  // Build the lock message box
  let lockBox: JSX.Element | null = null
  if (error && locked) {
    const isCooldown = kind === 'cooldown'
    const resetButton = (
      <button
        type="button"
        className="link"
        onClick={onForgotPassword}
        style={{ marginTop: 4, alignSelf: 'flex-start' }}
      >
        Reset your password
      </button>
    )
    if (isCooldown) {
      lockBox = (
        <div className="login-lock" role="alert">
          <p className="small">
            Too many failed attempts. You can try again in{' '}
            <span className="login-lock-time">{remainingSeconds}</span> seconds.
          </p>
          {resetButton}
        </div>
      )
    } else {
      lockBox = (
        <div className="login-lock" role="alert">
          <p className="small">
            Your login access is temporarily restricted for security reasons. Try again in{' '}
            <span className="login-lock-time">{remainingSeconds}</span> seconds.
          </p>
          {resetButton}
        </div>
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card stack" style={{ width: '100%', maxWidth: '400px', gap: 14 }} noValidate>
      <div>
        <h2 style={{ fontSize: 22 }}>Welcome to Tindahan</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          Sign in with the RTU account you verified. New here? Create your account first.
        </p>
      </div>

      {lockBox}

      <div className="field">
        <label htmlFor="lg-email">RTU email address</label>
        <input
          id="lg-email"
          type="email"
          autoComplete="email"
          required
          className={`input ${emailErr ? 'border-red-500' : ''} ${locked ? 'lock-disabled' : ''}`}
          placeholder="0000-000000@rtu.edu.ph"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setEmailErr(null)
          }}
          onBlur={handleEmailBlur}
          disabled={locked}
        />
      </div>
      <div className="field">
        <div className="row between">
          <label htmlFor="lg-pass">Password</label>
          <button type="button" className="link" onClick={onForgotPassword} disabled={locked} aria-disabled={locked}>
            Forgot password?
          </button>
        </div>
        <div className="password-input">
          <input
            id="lg-pass"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className={`input ${passErr ? 'border-red-500' : ''} pr-10 ${locked ? 'lock-disabled' : ''}`}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPassErr(null)
            }}
            disabled={locked}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPass(!showPass)}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            disabled={locked}
            aria-disabled={locked}
          >
            <Icon name={showPass ? 'eye' : 'eyeoff'} size="sm" />
          </button>
        </div>
      </div>
      {emailErr && <p className="err" role="alert">{emailErr}</p>}
      {passErr && <p className="err" role="alert">{passErr}</p>}
      {!locked && error && <p className="err" role="alert">{error}</p>}
      {!locked && attemptsLeft !== null && attemptsLeft < 5 && (
        <p className="small muted" role="alert">
          {attemptsLeft === 1
            ? `1 attempt left before your account is restricted.`
            : nextPenalty === 'restriction'
              ? `${attemptsLeft} attempt(s) left before your account is restricted.`
              : `${attemptsLeft} attempt(s) left before a 1-minute wait.`}
        </p>
      )}
      <Button
        variant="yellow"
        size="lg"
        isLoading={isLoading}
        className="block"
        disabled={locked}
      >
        <Icon name="lock" size="sm" /> Sign in with RTU account
      </Button>
      <p className="small muted" style={{ textAlign: 'center' }}>
        First time here?{' '}
        <button type="button" className="link" onClick={() => navigate('register')}>
          Create and verify my RTU account
        </button>
      </p>
    </form>
  )
}
