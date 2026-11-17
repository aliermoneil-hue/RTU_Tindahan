import { useState } from 'react'
import { navigate } from '@/common/router/router'
import { Icon } from '@/common/components/Icon'
import logoImg from '@/assets/logo-removebg-preview.png'
import { confirmPasswordReset, requestPasswordReset } from '../api/passwordReset'
import './ResetPasswordPage.css'

/**
 * Forgot-password screen (AV-06).
 *
 * Two steps, matching the endpoints: ask for a code, then trade the code for a
 * new password. The backend never says whether an address exists, so this page
 * never claims a mail was sent either — it says "if that address has an
 * account", which is both true and useless to someone probing for accounts.
 */

type Step = 'ask' | 'confirm' | 'done'

const EMAIL_RE = /^[^@\s]+@rtu\.edu\.ph$/

export function ResetPasswordPage() {
  const [step, setStep] = useState<Step>('ask')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const askForCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return setError('Enter your RTU email address.')
    if (!EMAIL_RE.test(trimmed)) {
      return setError('Use your official RTU email, for example 0000-000000@rtu.edu.ph.')
    }

    setIsBusy(true)
    try {
      const result = await requestPasswordReset(trimmed)
      setEmail(trimmed)
      setNotice(
        `If that address has an account, a 6-digit code is on its way. It expires in ${result.code_expires_in_minutes} minutes.`,
      )
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsBusy(false)
    }
  }

  const resend = async () => {
    setError(null)
    setNotice(null)
    setIsBusy(true)
    try {
      const result = await requestPasswordReset(email)
      setNotice(`Sent again if the account exists. The code expires in ${result.code_expires_in_minutes} minutes.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsBusy(false)
    }
  }

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6 digits from the email.')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')

    setIsBusy(true)
    try {
      await confirmPasswordReset({
        email,
        code: code.trim(),
        password,
        password_confirm: confirm,
      })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="reset-page">
      <div className="reset-card card stack">
        <button className="reset-brand" type="button" onClick={() => navigate('')}>
          <img src={logoImg} alt="RTU Tindahan Campus Marketplace" />
        </button>

        {step === 'ask' && (
          <form onSubmit={askForCode} className="stack" noValidate>
            <div>
              <span className="eyebrow">STEP 1 OF 2</span>
              <h1 style={{ fontSize: 22, marginTop: 6 }}>Forgot your password?</h1>
              <p className="small muted" style={{ marginTop: 6 }}>
                Enter the RTU address on your account. We will email a 6-digit code that lets you
                set a new password.
              </p>
            </div>

            <div className="field">
              <label htmlFor="rp-email">RTU email address</label>
              <input
                id="rp-email"
                type="email"
                className="input"
                autoComplete="email"
                placeholder="0000-000000@rtu.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="note red">
                <Icon name="info" />
                <span>{error}</span>
              </div>
            )}

            <button className="btn yellow block" type="submit" disabled={isBusy}>
              {isBusy ? 'Sending...' : 'Email me a code'}
            </button>
            <button className="btn ghost block" type="button" onClick={() => navigate('login')}>
              Back to sign in
            </button>
          </form>
        )}

        {step === 'confirm' && (
          <form onSubmit={submitNewPassword} className="stack" noValidate>
            <div>
              <span className="eyebrow">STEP 2 OF 2</span>
              <h1 style={{ fontSize: 22, marginTop: 6 }}>Set a new password</h1>
              <p className="small muted" style={{ marginTop: 6 }}>
                Code sent to <b>{email}</b>. Enter the 6 digits, then choose a password you have
                not used before.
              </p>
            </div>

            {notice && (
              <div className="note blue">
                <Icon name="info" />
                <span>{notice}</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="rp-code">6-digit code</label>
              <input
                id="rp-code"
                className="input rp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="rp-password">New password</label>
              <input
                id="rp-password"
                type="password"
                className="input"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="rp-confirm">Confirm new password</label>
              <input
                id="rp-confirm"
                type="password"
                className="input"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="note red">
                <Icon name="info" />
                <span>{error}</span>
              </div>
            )}

            <button className="btn yellow block" type="submit" disabled={isBusy}>
              {isBusy ? 'Saving...' : 'Set new password'}
            </button>
            <div className="row between">
              <button className="link" type="button" onClick={resend} disabled={isBusy}>
                Send a new code
              </button>
              <button
                className="link"
                type="button"
                onClick={() => {
                  setStep('ask')
                  setError(null)
                  setNotice(null)
                  setCode('')
                }}
              >
                Use a different address
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="stack">
            <div>
              <span className="eyebrow">DONE</span>
              <h1 style={{ fontSize: 22, marginTop: 6 }}>Password changed</h1>
              <p className="small muted" style={{ marginTop: 6 }}>
                Every other device was signed out. Sign in with the new password.
              </p>
            </div>
            <button className="btn yellow block" type="button" onClick={() => navigate('login')}>
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
