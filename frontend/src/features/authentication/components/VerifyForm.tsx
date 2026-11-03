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
}

interface Step2Data {
  email: string
  code: string
  sent: boolean
  busy: boolean
  demo?: boolean
  demoCode?: string
  info?: string
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
  })
  const [step2, setStep2] = useState<Step2Data>({
    email: '',
    code: '',
    sent: false,
    busy: false,
  })
  // Per-field errors shown below each input
  const [firstErr, setFirstErr] = useState<string | null>(null)
  const [lastErr, setLastErr] = useState<string | null>(null)
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [passErr, setPassErr] = useState<string | null>(null)
  const [pass2Err, setPass2Err] = useState<string | null>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const { register } = useAuth()

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

  // ---------------- STEP 1 ----------------
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAllErr()
    const { first, last, prog, email, pass, pass2 } = step1

    if (!first.trim()) {
      setFirstErr('Enter your first name.')
      return
    }
    if (!last.trim()) {
      setLastErr('Enter your last name.')
      return
    }
    if (!RTU_EMAIL.test(email)) {
      setEmailErr('Use your RTU student email, like 2024-123456@rtu.edu.ph.')
      return
    }
    if (!pass) {
      setPassErr('Enter a password.')
      return
    }
    if (pass.length < 8) {
      setPassErr('Password must be at least 8 characters.')
      return
    }
    if (!pass2) {
      setPass2Err('Confirm your password.')
      return
    }
    if (pass !== pass2) {
      setPass2Err('Passwords do not match.')
      return
    }

    try {
      await register({
        email,
        display_name: `${first.trim()} ${last.trim()}`,
        password: pass,
        password_confirm: pass2,
        member_type: 'student',
        college: prog,
        year_level: null,
        contact_number: '',
        privacy_consent: true,
      })
      setStep2((prev) => ({ ...prev, email, sent: true }))
      setStep(2)
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Account creation failed. Try again.')
    }
  }

  // ---------------- STEP 2 ----------------
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAllErr()
    setStep2((prev) => ({ ...prev, busy: true }))
    // Simulate sending code; the backend endpoint would be called here.
    // For demo purposes, show a demo code.
    setTimeout(() => {
      setStep2((prev) => ({
        ...prev,
        busy: false,
        demo: true,
        demoCode: '123456',
      }))
    }, 1200)
  }

  const handleResendCode = () => {
    clearAllErr()
    setStep2((prev) => ({ ...prev, busy: true }))
    setTimeout(() => {
      setStep2((prev) => ({
        ...prev,
        busy: false,
        demo: true,
        demoCode: '123456',
      }))
    }, 1200)
  }

  const handleChangeEmail = () => {
    setStep(1)
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAllErr()
    if (!/^\d{6}$/.test(step2.code)) {
      setCodeErr('Enter the 6-digit code.')
      return
    }
    try {
      await register({
        email: step2.email,
        display_name: `${step1.first.trim()} ${step1.last.trim()}`,
        password: step1.pass,
        password_confirm: step1.pass2,
        member_type: 'student',
        college: step1.prog,
        year_level: null,
        contact_number: '',
        privacy_consent: true,
      })
      setStep(3)
      onStep3Complete?.()
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Code verification failed. Try again.')
    }
  }

  const maskMail = (m: string) => {
    const p = String(m).split('@')
    return `${p[0].slice(0, 2)}***@${p[1] || ''}`
  }

  return (
    <form
      onSubmit={
        step === 1 ? handleStep1Submit : step === 2 ? handleSendCode : handleVerifyCode
      }
      className="stack"
      style={{ gap: 14, maxWidth: 560 }}
      noValidate
    >
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
      ) : step === 2 && !step2.sent ? (
        <>
          <h1 style={{ fontSize: 26, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Confirm your RTU email
          </h1>
          <p className="small muted" style={{ marginBottom: 16 }}>
            We will email a 6-digit code to <b>{maskMail(step1.email)}</b>. Open that inbox, copy
            the code and enter it on the next screen.
          </p>
          <div className="card stack" style={{ gap: 12 }}>
            <div className="note blue">
              <Icon name="lock" size="sm" />
              <span>
                The code goes only to your RTU student-number email. It proves the account is really
                yours.
              </span>
            </div>
          </div>
          <div className="row between wrap">
            <button
              type="button"
              className="btn ghost"
              onClick={handleChangeEmail}
            >
              <Icon name="back" size="sm" /> Back
            </button>
            <button
              className="btn lg"
              type="submit"
              disabled={step2.busy}
            >
              {step2.busy ? 'Sending...' : 'Send code'}
            </button>
          </div>
        </>
      ) : step === 2 && step2.sent ? (
        <>
          <h1 style={{ fontSize: 26, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Enter your code
          </h1>
          <p className="small muted" style={{ marginBottom: 16 }}>
            We sent a 6-digit code to your RTU email{' '}
            <b>{maskMail(step2.demo ? step2.email : step1.email)}</b>. It expires in 5 minutes.
            Check your spam folder if you do not see it.
          </p>
          {step2.demo && (
            <div className="note" role="status">
              <Icon name="info" size="sm" />
              <span>
                <b>Demo mode.</b> No email service is connected, so nothing was emailed. Your code is{' '}
                <b className="demo-code tnum" style={{ letterSpacing: '0.25em', fontSize: 15 }}>
                  {step2.demoCode}
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
                value={step2.code}
                placeholder="000000"
                onChange={(e) => {
                  setStep2((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))
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
          {step2.info && <div className="small" style={{ color: 'var(--green)' }}>{step2.info}</div>}
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
      ) : (
        // STEP 3 - All set
        <>
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
        </>
      )}
    </form>
  )
}
