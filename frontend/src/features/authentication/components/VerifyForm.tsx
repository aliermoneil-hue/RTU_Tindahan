'use client'

import { useState, useCallback, useEffect } from 'react'
import { navigate } from '@/common/router/router'
import { Icon } from '@/common/components/Icon'
import { ScreeningNotice } from '@/common/components/ScreeningNotice'

import { Button } from '@/common/components/Button'
import { useAuth } from '../AuthContext'

const RTU_EMAIL = /^\d{4}-\d{6}@rtu\.edu\.ph$/i

const PROGRAMS = [
  'BS Information Technology',
  'BS Computer Engineering',
  'BS Electronics Engineering',
  'BS Business Administration',
]

const YEARS = ['1st', '2nd', '3rd', '4th', '5th', '6th']

interface Step1Data {
  first: string
  last: string
  prog: string
  year: number
  email: string
  pass: string
  pass2: string
  code: string
  agree: boolean
}

interface VerifyFormProps {
  onStep3Complete?: () => void
  onStepChange?: (step: 1 | 2 | 3) => void
}

export function VerifyForm({ onStep3Complete, onStepChange }: VerifyFormProps) {
  const { register, resendCode, confirmCode, otp, clearOtp } = useAuth()
  const DRAFT_KEY = 'rtu:register-draft'

  const defaultStep1: Step1Data = {
    first: '',
    last: '',
    prog: PROGRAMS[0],
    year: 1,
    email: '',
    pass: '',
    pass2: '',
    code: '',
    agree: false,
  }

  const loadDraft = (): Step1Data => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return defaultStep1
      const parsed = JSON.parse(raw)
      return {
        ...defaultStep1,
        first: String(parsed.first ?? ''),
        last: String(parsed.last ?? ''),
        prog: String(parsed.prog ?? defaultStep1.prog),
        year: Number(parsed.year) || defaultStep1.year,
        email: String(parsed.email ?? ''),
        agree: Boolean(parsed.agree),
      }
    } catch {
      return defaultStep1
    }
  }

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [step1, setStep1] = useState<Step1Data>(loadDraft)
  // Persist the draft (name, program, year, email, agree) so a reload or
  // navigating away and back does not lose what was filled in. Never store
  // passwords or the code.
  useEffect(() => {
    try {
      const { first, last, prog, year, email, agree } = step1
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ first, last, prog, year, email, agree }))
    } catch {
      /* sessionStorage unavailable or quota-exceeded; ignore */
    }
  }, [step1])
  // Drop the draft once registration is complete.
  useEffect(() => {
    if (step === 3) {
      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [step])
  // Notify the page header whenever the step changes.
  useEffect(() => {
    onStepChange?.(step)
  }, [step])

  // Per-field errors shown below each input
  const [firstErr, setFirstErr] = useState<string | null>(null)
  const [lastErr, setLastErr] = useState<string | null>(null)
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [passErr, setPassErr] = useState<string | null>(null)
  const [pass2Err, setPass2Err] = useState<string | null>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [agreeErr, setAgreeErr] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [showPass2, setShowPass2] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const clearAllErr = useCallback(() => {
    setFirstErr(null)
    setLastErr(null)
    setEmailErr(null)
    setPassErr(null)
    setPass2Err(null)
    setCodeErr(null)
    setAgreeErr(null)
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
    const { first, last, email, pass, pass2, prog, year, agree } = step1

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
    if (!agree) {
      setAgreeErr('Accept the privacy notice to create your account.')
      return
    }

    setIsLoading(true)
    try {
      // Creates the visitor account and emails the 6-digit code.
      await register({
        first: first.trim(),
        last: last.trim(),
        email: em,
        pass,
        prog,
        year,
        consent: agree,
      })
      setStep1((prev) => ({ ...prev, email: em }))
      setStep(2)
      window.scrollTo(0, 0)
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Account creation failed. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // -----------------------------------------------------------------------
  // STEP 2a: before code sent — "Send code" button
  // -----------------------------------------------------------------------
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAllErr()
    setIsLoading(true)
    try {
      await resendCode(step1.email.trim().toLowerCase())
      window.scrollTo(0, 0)
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Could not send code. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // -----------------------------------------------------------------------
  // STEP 2b: code sent — enter the 6-digit code
  // -----------------------------------------------------------------------
  const handleResendCode = async () => {
    clearAllErr()
    setIsLoading(true)
    try {
      await resendCode(otp?.to || step1.email.trim().toLowerCase())
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Could not resend code. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeEmail = () => {
    clearOtp()
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
    setIsLoading(true)
    try {
      // Correct code activates the account and signs the user in.
      await confirmCode(otp?.to || step1.email, step1.code)
      setStep(3)
      onStep3Complete?.()
    } catch (err) {
      setCodeErr(err instanceof Error ? err.message : 'Code verification failed. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  const maskMail = (m: string) => {
    const p = String(m).split('@')
    return `${p[0].slice(0, 2)}***@${p[1] || ''}`
  }

  // The address the code was sent to. Kept by AuthContext, so it survives a
  // page reload and the code screen can still resume.
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
            <div className="field">
              <label htmlFor="v-year">Year level</label>
              <select
                className="input"
                id="v-year"
                value={step1.year}
                onChange={(e) =>
                  setStep1((prev) => ({ ...prev, year: Number(e.target.value) }))
                }
              >
                {YEARS.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label} year
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
                <div className="password-input">
                  <input
                    className={`input ${passErr ? 'border-red-500' : ''} pr-10`}
                    id="v-pass"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={step1.pass}
                    placeholder="At least 8 characters"
                    onChange={(e) => {
                      setStep1((prev) => ({ ...prev, pass: e.target.value }))
                      setPassErr(null)
                    }}
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
                {passErr && <p className="err" role="alert">{passErr}</p>}
              </div>
              <div className="field">
                <label htmlFor="v-pass2">Confirm password</label>
                <div className="password-input">
                  <input
                    className={`input ${pass2Err ? 'border-red-500' : ''} pr-10`}
                    id="v-pass2"
                    type={showPass2 ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={step1.pass2}
                    onChange={(e) => {
                      setStep1((prev) => ({ ...prev, pass2: e.target.value }))
                      setPass2Err(null)
                    }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPass2(!showPass2)}
                    aria-label={showPass2 ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPass2 ? 'eye' : 'eyeoff'} size="sm" />
                  </button>
                </div>
                {pass2Err && <p className="err" role="alert">{pass2Err}</p>}
              </div>
            </div>
          </div>
          <label className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={step1.agree}
              onChange={(e) => {
                setStep1((prev) => ({ ...prev, agree: e.target.checked }))
                setAgreeErr(null)
              }}
              style={{ marginTop: 3 }}
            />
            <span className="small">
              I accept the privacy notice. My RTU email, program, and year level are used only to
              run the marketplace (RA 10173).
            </span>
          </label>
          <ScreeningNotice tone="auth" />
          {agreeErr && (
            <p className="err" role="alert">
              {agreeErr}
            </p>
          )}
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
              <Button variant="yellow" size="lg" isLoading={isLoading} className="block">
                Continue
              </Button>
            </span>
          </div>
          {otp && (
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="link"
                onClick={() => setStep(2)}
              >
                I already have a code
              </button>
            </div>
          )}
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
                <Button variant="yellow" size="lg" isLoading={isLoading} className="block" onClick={handleSendCode}>
                  Send code
                </Button>
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
                <Button variant="yellow" size="lg" isLoading={isLoading} className="block" type="submit">
                  Verify and create account
                </Button>
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
