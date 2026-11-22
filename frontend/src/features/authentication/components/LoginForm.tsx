'use client'

import { useState } from 'react'
import { navigate } from '@/common/router/router'
import { Icon } from '@/common/components/Icon'
import { Button } from '@/common/components/Button'
import type { LoginCredentials } from '../types'

interface LoginFormProps {
  onSubmit: (data: LoginCredentials) => void
  isLoading: boolean
  error: string | null
  onForgotPassword: () => void
}

export function LoginForm({ onSubmit, isLoading, error, onForgotPassword }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [passErr, setPassErr] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

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

  return (
    <form onSubmit={handleSubmit} className="card stack" style={{ width: '100%', maxWidth: '400px', gap: 14 }} noValidate>
      <div>
        <h2 style={{ fontSize: 22 }}>Welcome to Tindahan</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          Sign in with the RTU account you verified. New here? Create your account first.
        </p>
      </div>
      <div className="field">
        <label htmlFor="lg-email">RTU email address</label>
        <input
          id="lg-email"
          type="email"
          autoComplete="email"
          required
          className={`input ${emailErr ? 'border-red-500' : ''}`}
          placeholder="0000-000000@rtu.edu.ph"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <div className="row between">
          <label htmlFor="lg-pass">Password</label>
          <button type="button" className="link" onClick={onForgotPassword}>
            Forgot password?
          </button>
        </div>
        <div className="password-input">
          <input
            id="lg-pass"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className={`input ${passErr ? 'border-red-500' : ''} pr-10`}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPass(!showPass)}
            aria-label={showPass ? 'Hide password' : 'Show password'}
          >
            <Icon name={showPass ? 'eye' : 'eyeoff'} size="sm" />
          </button>
        </div>
      </div>
      {emailErr && <p className="err" role="alert">{emailErr}</p>}
      {passErr && <p className="err" role="alert">{passErr}</p>}
      {error && <p className="err" role="alert">{error}</p>}
      <Button variant="yellow" size="lg" isLoading={isLoading} className="block">
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
