import { useState, useEffect } from 'react'
import { navigate } from '@/common/router/router'
import { apiFetch } from '@/common/api/client'
import { Icon } from '@/common/components/Icon'
import logoImg from '@/assets/logo-removebg-preview.png'
import './ForgotPasswordPage.css'

type Step = 'email' | 'code' | 'done'

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [passErr, setPassErr] = useState<string | null>(null)
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Always scroll down when entering the forgot password page
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const STUDENT_EMAIL = /^\d{4}-\d{6}@rtu\.edu\.ph$/i

  // ------------------------------------------------------------------
  // Step 1: Send verification code to the inputted email
  // ------------------------------------------------------------------
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailErr(null)
    setCodeErr(null)
    setPassErr(null)
    setConfirmErr(null)

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setEmailErr('Enter your RTU email address.')
      return
    }
    if (!STUDENT_EMAIL.test(trimmed)) {
      setEmailErr('Use your official RTU email, for example 0000-000000@rtu.edu.ph.')
      return
    }

    setIsLoading(true)
    try {
      await apiFetch<{ detail: string }>('/auth/forgot-password/', {
        method: 'POST',
        body: { email: trimmed },
      })
      setStep('code')
    } catch (err: any) {
      setEmailErr(
        err instanceof Error ? err.message : 'Could not send verification code. Try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // ------------------------------------------------------------------
  // Step 2: Verify code and set new password
  // ------------------------------------------------------------------
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeErr(null)
    setPassErr(null)
    setConfirmErr(null)

    const digits = String(code).replace(/\s/g, '')
    if (!/^\d{6}$/.test(digits)) {
      setCodeErr('Enter the 6-digit code from your email.')
      return
    }
    if (!newPass) {
      setPassErr('Enter a new password.')
      return
    }
    if (newPass.length < 8) {
      setPassErr('Choose a password with at least 8 characters.')
      return
    }
    if (newPass !== confirmPass) {
      setConfirmErr('The two passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      await apiFetch<{ detail: string }>('/auth/reset-password/', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), code: digits, password: newPass },
      })
      setStep('done')
    } catch (err: any) {
      setCodeErr(
        err instanceof Error ? err.message : 'Invalid code or reset failed. Try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // ------------------------------------------------------------------
  // Step 1 UI: email input
  // ------------------------------------------------------------------
  if (step === 'email') {
    return (
      <div className="forgot-page">
        <div className="split">
          {/* Left info panel (navy background) */}
          <div className="l">
            <button className="logo" type="button" onClick={() => navigate('/')}>
              <img className="logo-img" src={logoImg} alt="RTU Tindahan Campus Marketplace" />
            </button>
            <div className="info-panel">
              <h1 className="hero-h">Forgot your password?</h1>
              <p>
                Enter your RTU student-number email and we will send a verification code to your
                inbox. Use the code to set a new password and regain access to your account.
              </p>
              <div className="row wrap small" style={{ opacity: 0.9, gap: 16, justifyContent: 'center', marginTop: 16 }}>
                <span className="row" style={{ gap: 6 }}>
                  <Icon name="shield" size="sm" /> Verified RTU accounts
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <Icon name="msg" size="sm" /> Code sent to RTU email
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <Icon name="pin" size="sm" /> No online payment needed
                </span>
              </div>
              <div className="note blue">
                <Icon name="info" />
                <span>
                  Only verified RTU students and personnel can request a password reset. The code
                  expires after 15 minutes.
                </span>
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div className="r">
            <div style={{ width: '100%', maxWidth: '400px', marginBottom: 18 }}>
              <button type="button" className="link" onClick={() => navigate('/login')}>
                ← Back to sign in
              </button>
            </div>

            <form onSubmit={handleSendCode} className="card stack" style={{ width: '100%', maxWidth: '400px', gap: 14 }} noValidate>
              <div>
                <h2 style={{ fontSize: 22 }}>Reset your password</h2>
                <p className="small muted" style={{ marginTop: 4 }}>
                  Step 1 of 2 — Send a verification code to your RTU email.
                </p>
              </div>
              <div className="field">
                <label htmlFor="fp-email">RTU email address</label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`input ${emailErr ? 'border-red-500' : ''}`}
                  placeholder="0000-000000@rtu.edu.ph"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setEmailErr(null)
                  }}
                />
                {emailErr && <p className="err" role="alert">{emailErr}</p>}
              </div>
              <button
                type="button"
                className="btn yellow block lg"
                disabled={isLoading}
                onClick={handleSendCode}
              >
                {isLoading ? 'Sending code…' : 'Send verification code'}
              </button>
              <p className="small muted" style={{ textAlign: 'center' }}>
                Remember your password?{' '}
                <button type="button" className="link" onClick={() => navigate('/login')}>
                  Sign in instead
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Step 2 UI: verification code + new password
  // ------------------------------------------------------------------
  if (step === 'code') {
    return (
      <div className="forgot-page">
        <div className="split">
          <div className="l">
            <button className="logo" type="button" onClick={() => navigate('/')}>
              <img className="logo-img" src={logoImg} alt="RTU Tindahan Campus Marketplace" />
            </button>
            <div className="info-panel">
              <h1 className="hero-h">Enter your code</h1>
              <p>
                We sent a 6-digit verification code to <b>{email}</b>. Enter it below along with
                your new password to reset your account.
              </p>
              <div className="note blue">
                <Icon name="info" />
                <span>
                  The code expires after 15 minutes. Didn't receive it? Go back and resend.
                </span>
              </div>
            </div>
          </div>

          <div className="r">
            <div style={{ width: '100%', maxWidth: '400px', marginBottom: 18 }}>
              <button type="button" className="link" onClick={() => setStep('email')}>
                ← Back
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="card stack" style={{ width: '100%', maxWidth: '400px', gap: 14 }} noValidate>
              <div>
                <h2 style={{ fontSize: 22 }}>Set your new password</h2>
                <p className="small muted" style={{ marginTop: 4 }}>
                  Step 2 of 2 — Enter the code and choose a new password.
                </p>
              </div>
              <div className="field">
                <label htmlFor="fp-code">Verification code</label>
                <input
                  id="fp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]*"
                  className={`input ${codeErr ? 'border-red-500' : ''}`}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ''))
                    setCodeErr(null)
                  }}
                />
                {codeErr && <p className="err" role="alert">{codeErr}</p>}
              </div>
              <div className="field">
                <label htmlFor="fp-new-pass">New password</label>
                <input
                  id="fp-new-pass"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`input ${passErr ? 'border-red-500' : ''} pr-10`}
                  placeholder="At least 8 characters"
                  value={newPass}
                  onChange={(e) => {
                    setNewPass(e.target.value)
                    setPassErr(null)
                  }}
                />
                {passErr && <p className="err" role="alert">{passErr}</p>}
              </div>
              <div className="field">
                <label htmlFor="fp-confirm-pass">Confirm new password</label>
                <input
                  id="fp-confirm-pass"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`input ${confirmErr ? 'border-red-500' : ''} pr-10`}
                  placeholder="Type the same password again"
                  value={confirmPass}
                  onChange={(e) => {
                    setConfirmPass(e.target.value)
                    setConfirmErr(null)
                  }}
                />
                {confirmErr && <p className="err" role="alert">{confirmErr}</p>}
              </div>
              <button
                type="button"
                className="btn yellow block lg"
                disabled={isLoading}
                onClick={handleResetPassword}
              >
                {isLoading ? 'Resetting password…' : 'Reset password'}
              </button>
              <p className="small muted" style={{ textAlign: 'center' }}>
                <button type="button" className="link" onClick={() => navigate('/login')}>
                  Back to sign in
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Step 3 UI: done
  // ------------------------------------------------------------------
  return (
    <div className="forgot-page">
      <div className="split">
        <div className="l">
          <button className="logo" type="button" onClick={() => navigate('/')}>
            <img className="logo-img" src={logoImg} alt="RTU Tindahan Campus Marketplace" />
          </button>
          <div className="info-panel">
            <h1 className="hero-h">Password reset</h1>
            <p>
              Your RTU Tindahan password has been reset successfully. You can now sign in with
                your new password.
            </p>
            <div className="note blue">
              <Icon name="info" />
              <span>
                Remember: meet in visible campus areas, check the item before paying, and pay
                in person.
              </span>
            </div>
          </div>
        </div>

        <div className="r">
          <div style={{ width: '100%', maxWidth: '400px', marginBottom: 18 }}>
            <button type="button" className="link" onClick={() => navigate('/login')}>
              ← Back to sign in
            </button>
          </div>

          <div className="card stack" style={{ width: '100%', maxWidth: '400px', gap: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 56, lineHeight: 1 }}>✓</div>
            <h2 style={{ fontSize: 22 }}>Password reset complete</h2>
            <p className="small muted">
              Your new password is now active. Use it with your RTU email to sign in.
            </p>
            <button
              type="button"
              className="btn yellow block lg"
              onClick={() => navigate('/login')}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
