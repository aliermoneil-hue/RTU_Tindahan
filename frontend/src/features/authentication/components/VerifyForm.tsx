'use client'

import { useState, useCallback } from 'react'
import { navigate } from '@/common/router/router'
import { Icon } from '@/common/components/Icon'
import { useAuth } from '../AuthContext'

const RTU_EMAIL = /^\d{4}-\d{6}@rtu\.edu\.ph$/i

const PROGRAMS = [
  'BS Information Technology',
  'BS Computer Engineering',
  'BS Electronics Engineering',
  'BS Business Administration',
]

interface Step1Data {
  first: string
  last: string
  prog: string
  email: string
  pass: string
  pass2: string
  code: string
}

interface VerifyFormProps {
  onStep3Complete?: () => void
}

export function VerifyForm({ onStep3Complete }: VerifyFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [step1, setStep1] = useState<Step1Data>({
    first: '',
    last: '',
    prog: PROGRAMS[0],
    email: '',
    pass: '',
    pass2: '',
    code: '',
  })
  // Per-field errors shown below each input
  const [firstErr, setFirstErr] = useState<string | null>(null)
  const [lastErr, setLastErr] = useState<string | null>(null)
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [passErr, setPassErr] = useState<string | null>(null)
  const [pass2Err, setPass2Err] = useState<string | null>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const { sendCode, verifyCode, otp } = useAuth()

  const clearAllErr = useCallback(() => {
    setFirstErr(null)
    setLastErr(null)
    setEmailErr(null)
    setPassErr(null)
    setPass2Err(null)
    setCodeErr(null)
  }, [])

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      navigate('')
    }
  }

  // -----------------------------------------------------------------------
  // STEP 1: student account — name, program, RTU email, password
  // -----------------------------------------------------------------------
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAllErr()
    const { first, last, email, pass, pass2 } = step1

    if (!first.trim() || !last.trim()) {
      if (!first.trim()) setFirstErr('Enter your first name.')
      if (!last.trim()) setLastErr('Enter your last name.')
      return
    }
    const em = email.trim().toLowerCase()
    if (!RTU_EMAIL.test(em)) {
      setEmailErr('Use your student number email, like 2024-123456@rtu.edu.ph.')
      return
    }
    if (!pass) {
      setPassErr('Enter a password.')
      return
    }
    if (pass.length < 8) {
      setPassErr('Choose a password with at least 8 characters.')
      return
    }
    if (!pass2) {
      setPass2Err('Confirm your password.')
      return
    }
    if (pass !== pass2) {
      setPass2Err('The two passwords do not match.')
      return
    }

    try {
      await sendCode(em, first.trim())
      setStep1((prev) => ({ ...prev, email: em }))
      setStep(2)
      window.scrollTo(0, 0)
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Account creation failed. Try again.')
    }
  }

  // -----------------------------------------------------------------------
  // STEP 2a: before code sent — "Send code" button
  // -----------------------------------------------------------------------
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAllErr()
    try {
      await sendCode(step1.email.trim().toLowerCase(), step1.first.trim())
      window.scrollTo(0, 0)
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Could not send code. Try again.')
    }
  }

  // -----------------------------------------------------------------------
  // STEP 2b: code sent — enter the 6-digit code
  // -----------------------------------------------------------------------
  const handleResendCode = async () => {
    clearAllErr()
    try {
      await sendCode(step1.email.trim().toLowerCase(), step1.first.trim())
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Could not resend code. Try again.')
    }
  }

  const handleChangeEmail = () => {
    setStep(1)
    setStep1((prev) => ({ ...prev, code: '' }))
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAllErr()
    if (!/^\d{6}$/.test(step1.code)) {
      setCodeErr('Enter the 6 digits from the email.')
      return
    }
    try {
      await verifyCode(step1.code, {
        first: step1.first,
        last: step1.last,
        email: step1.email,
        pass: step1.pass,
        prog: step1.prog,
      })
      setStep(3)
      onStep3Complete?.()
    } catch (err) {
      setCodeErr(err instanceof Error ? err.message : 'Code verification failed. Try again.')
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  const maskMail = (m: string) => {
    const p = String(m).split('@')
    return `${p[0].slice(0, 2)}***@${p[1] || ''}`
  }

  // Keep step1 in sync with OTP email
  const demoCode = otp?.code ?? null
  const otpEmail = otp?.to ?? step1.email

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (step === 1) {
          handleStep1Submit(e)
        } else if (step === 2 && otp) {
          handleVerifyCode(e)
        } else if (step === 2 && !otp) {
          handleSendCode(e)
        }
      }}
      className="stack"
      style={{ gap: 14, maxWidth: 560 }}
      noValidate
    >
      {/* ============ STEP 1 ============ */}
      {step === 1 ? (
        <>
          <h1 style={{ fontSize: 26, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Create your student account
          </h1>
          <p className="small muted" style={{ marginBottom: 16 }}>
            Your RTU email is your student number, like 2024-123456@rtu.edu.ph. Next we will
            send a 6-digit code to that same RTU email.
          </p>
          <div className="card stack" style={{ gap: 12 }}>
            <b>About you</b>
            <div className="grid2">
              <div className="field">
                <label htmlFor="v-first">First name</label>
                <input
                  id="v-first"
                  className={`input ${firstErr ? 'border-red-500' : ''}`}
                  autoComplete="given-name"
                  value={step1.first}
                  onChange={(e) => {
                    setStep1((prev) => ({ ...prev, first: e.target.value }))
                    setFirstErr(null)
                  }}
                />
                {firstErr && <p className="err" role="alert">{firstErr}</p>}
              </div>
              <div className="field">
                <label htmlFor="v-last">Last name</label>
                <input
                  id="v-last"
                  className={`input ${lastErr ? 'border-red-500' : ''}`}
                  autoComplete="family-name"
                  value={step1.last}
                  onChange={(e) => {
                    setStep1((prev) => ({ ...prev, last: e.target.value }))
                    setLastErr(null)
                  }}
                />
                {lastErr && <p className="err" role="alert">{lastErr}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="v-prog">Program</label>
              <select
                className="input"
                id="v-prog"
                value={step1.prog}
                onChange={(e) => {
                  setStep1((prev) => ({ ...prev, prog: e.target.value }))
                  setEmailErr(null)
                }}
              >
                {PROGRAMS.map((o) => (
                  <option key={o} value={o} selected={step1.prog === o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="card stack" style={{ gap: 12 }}>
            <b>Sign-in details</b>
            <div className="field">
              <label htmlFor="v-email">RTU email (student number)</label>
              <input
                className={`input tnum ${emailErr ? 'border-red-500' : ''}`}
                id="v-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={step1.email}
                placeholder="0000-000000@rtu.edu.ph"
                onChange={(e) => {
                  setStep1((prev) => ({ ...prev, email: e.target.value }))
                  setEmailErr(null)
                }}
              />
              <span className="tiny muted">Format: 4 digits, a dash, 6 digits, then @rtu.edu.ph</span>
              {emailErr && <p className="err" role="alert">{emailErr}</p>}
            </div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="v-pass">Password</label>
                <input
                  className={`input ${passErr ? 'border-red-500' : ''}`}
                  id="v-pass"
                  type="password"
                  autoComplete="new-password"
                  value={step1.pass}
                  placeholder="At least 8 characters"
                  onChange={(e) => {
                    setStep1((prev) => ({ ...prev, pass: e.target.value }))
                    setPassErr(null)
                  }}
                />
                {passErr && <p className="err" role="alert">{passErr}</p>}
              </div>
              <div className="field">
                <label htmlFor="v-pass2">Confirm password</label>
                <input
                  className={`input ${pass2Err ? 'border-red-500' : ''}`}
                  id="v-pass2"
                  type="password"
                  autoComplete="new-password"
                  value={step1.pass2}
                  onChange={(e) => {
                    setStep1((prev) => ({ ...prev, pass2: e.target.value }))
                    setPass2Err(null)
                  }}
                />
                {pass2Err && <p className="err" role="alert">{pass2Err}</p>}
              </div>
            </div>
          </div>
          <div className="err" role="alert">{emailErr}</div>
          <div className="row between wrap">
            <button
              type="button"
              className="btn ghost"
              onClick={goBack}
            >
              <Icon name="back" size="sm" /> Back
            </button>
            <span className="row">
              <span className="small muted">Takes about 2 minutes</span>
              <button className="btn lg" type="submit">
                Continue
              </button>
            </span>
          </div>
        </>
      ) : (
        // ============ STEP 2 ============
        <>
          {!otp ? (
            // Step 2 before code sent
            <>
              <h1 style={{ fontSize: 26, letterSpacing: '-0.02em', marginBottom: 4 }}>
                Confirm your RTU email
              </h1>
              <p className="small muted" style={{ marginBottom: 16 }}>
                We will email a 6-digit code to <b>{maskMail(step1.email)}</b>. Open that inbox,
                copy the code and enter it on the next screen.
              </p>
              <div className="card stack" style={{ gap: 12 }}>
                <div className="note blue">
                  <Icon name="lock" size="sm" />
                  <span>
                    The code goes only to your RTU student-number email. It proves the account is
                    really yours.
                  </span>
                </div>
              </div>
              <div className="err" role="alert">{emailErr}</div>
              <div className="row between wrap">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleChangeEmail}
                >
                  <Icon name="back" size="sm" /> Back
                </button>
                <button className="btn lg" type="button" onClick={handleSendCode}>
                  Send code
                </button>
              </div>
            </>
          ) : (
            // Step 2 after code sent — enter the code
            <>
              <h1 style={{ fontSize: 26, letterSpacing: '-0.02em', marginBottom: 4 }}>
                Enter your code
              </h1>
              <p className="small muted" style={{ marginBottom: 16 }}>
                We sent a 6-digit code to your RTU email <b>{maskMail(otpEmail)}</b>. It expires in
                5 minutes. Check your spam folder if you do not see it.
              </p>
              {otp?.demo && (
                <div className="note" role="status">
                  <Icon name="info" size="sm" />
                  <span>
                    <b>Demo mode.</b> No email service is connected, so nothing was emailed. Your
                    code is{' '}
                    <b className="demo-code tnum" style={{ letterSpacing: '0.25em', fontSize: 15 }}>
                      {demoCode}
                    </b>
                  </span>
                </div>
              )}
              <div className="card stack" style={{ gap: 12 }}>
                <div className="field">
                  <label htmlFor="v-code">6-digit code</label>
                  <input
                    className={`input otp tnum ${codeErr ? 'border-red-500' : ''}`}
                    id="v-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]*"
                    value={step1.code}
                    placeholder="000000"
                    onChange={(e) => {
                      setStep1((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))
                      setCodeErr(null)
                    }}
                  />
                  {codeErr && <p className="err" role="alert">{codeErr}</p>}
                </div>
                <div className="row wrap">
                  <button
                    type="button"
                    className="link"
                    onClick={handleResendCode}
                  >
                    Send a new code
                  </button>
                  <span className="muted">·</span>
                  <button
                    type="button"
                    className="link"
                    onClick={handleChangeEmail}
                  >
                    Use a different RTU email
                  </button>
                </div>
              </div>
              <div className="err" role="alert">{codeErr}</div>
              <div className="row between wrap">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleChangeEmail}
                >
                  <Icon name="back" size="sm" /> Back
                </button>
                <button className="btn lg" type="submit">
                  Verify and create account
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ============ STEP 3 ============ */}
      {step === 3 && (
        <div className="card stack" style={{ maxWidth: 560, gap: 14, alignItems: 'flex-start' }}>
          <span
            className="avatar"
            style={{
              background: 'var(--green-bg)',
              color: 'var(--green)',
              width: 46,
              height: 46,
            }}
          >
            <Icon name="check" />
          </span>
          <h2 style={{ fontSize: 24 }}>Welcome, {step1.first.trim() || 'friend'}</h2>
          <p className="muted">
            Your RTU email is confirmed and your account is ready. You can buy from the marketplace
            and sell from My shop. New listings are checked by RTU staff before they appear.
          </p>
          <div className="row wrap">
            <button
              className="btn"
              onClick={() => {
                navigate('marketplace', { replace: true })
                onStep3Complete?.()
              }}
            >
              Go to marketplace
            </button>
            <button className="btn ghost" onClick={() => navigate('', { replace: true })}>
              Back to homepage
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
