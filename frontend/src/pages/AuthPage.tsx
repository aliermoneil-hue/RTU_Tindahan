import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './Pages.css'
import Icon from '../components/Icon'

/* Same checks the prototype uses: a student email looks like 2024-123456@rtu.edu.ph and a password has 8 or more characters. */
const STUDENT_EMAIL = /^\d{4}-\d{6}@rtu\.edu\.ph$/

type Mode = 'sign-in' | 'create-account'

/* Sign in and Create account forms. They check the fields in the browser. This project has no server,
   so a form that passes the checks says clearly that nothing was sent. */
export default function AuthPage({ mode }: { mode: Mode }) {
  const create = mode === 'create-account'
  const [vals, setVals] = useState({ first: '', last: '', email: '', pass: '', pass2: '' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)

  const set = (k: keyof typeof vals) => (e: ChangeEvent<HTMLInputElement>) => {
    setVals({ ...vals, [k]: e.target.value })
    setErr('')
    setOk(false)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const email = vals.email.trim().toLowerCase()
    if (create && (!vals.first.trim() || !vals.last.trim())) return setErr('Enter your first name and last name.')
    if (create && !STUDENT_EMAIL.test(email)) return setErr('Use your student number email, like 2024-123456@rtu.edu.ph.')
    if (!create && !email.endsWith('@rtu.edu.ph')) return setErr('Use your RTU email, like 2024-123456@rtu.edu.ph.')
    if (!vals.pass) return setErr('Enter your password.')
    if (create && vals.pass.length < 8) return setErr('Your password needs at least 8 characters.')
    if (create && vals.pass !== vals.pass2) return setErr('The two passwords are not the same.')
    setErr('')
    setOk(true)
  }

  return (
    <main className="page">
      <div className="wrap page-narrow">
        <a className="back" href="#/">
          <Icon name="arrow" small />
          Back to home
        </a>
        <div className="page-head">
          <span className="eyebrow">{create ? 'Join RTU Tindahan' : 'Welcome back'}</span>
          <h1>{create ? 'Create your account' : 'Sign in'}</h1>
          <p className="muted">
            {create
              ? 'Your RTU email is your student number, like 2024-123456@rtu.edu.ph.'
              : 'Use the RTU email and password you signed up with.'}
          </p>
        </div>
        <form className="card form" onSubmit={submit} noValidate>
          {create && (
            <div className="form-row">
              <div className="field">
                <label htmlFor="first">First name</label>
                <input id="first" className="input" autoComplete="given-name" value={vals.first} onChange={set('first')} />
              </div>
              <div className="field">
                <label htmlFor="last">Last name</label>
                <input id="last" className="input" autoComplete="family-name" value={vals.last} onChange={set('last')} />
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="email">RTU email address</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              placeholder="0000-000000@rtu.edu.ph"
              value={vals.email}
              onChange={set('email')}
              aria-invalid={err.toLowerCase().includes('email') || undefined}
            />
            {create && <span className="hint">Format: 4 digits, a dash, 6 digits, then @rtu.edu.ph</span>}
          </div>
          <div className="field">
            <label htmlFor="pass">Password</label>
            <input
              id="pass"
              className="input"
              type="password"
              autoComplete={create ? 'new-password' : 'current-password'}
              placeholder={create ? 'At least 8 characters' : ''}
              value={vals.pass}
              onChange={set('pass')}
            />
          </div>
          {create && (
            <div className="field">
              <label htmlFor="pass2">Type the password again</label>
              <input id="pass2" className="input" type="password" autoComplete="new-password" value={vals.pass2} onChange={set('pass2')} />
            </div>
          )}
          {err && (
            <p className="err" role="alert">
              {err}
            </p>
          )}
          {ok && (
            <p className="notice" role="status">
              <Icon name="check" small />
              <span>
                The details look correct, but nothing was sent. This page is not connected to the RTU Tindahan server, so no
                account was {create ? 'created' : 'opened'}. Set the prototype address in <code>config.ts</code> to connect it.
              </span>
            </p>
          )}
          <button type="submit" className="btn yellow lg">
            Check my details
          </button>
          <p className="form-foot muted">
            {create ? (
              <>
                Already have an account? <a href="#/sign-in">Sign in</a>
              </>
            ) : (
              <>
                New here? <a href="#/create-account">Create an account</a> · <a href="#/verify-help">Need help verifying?</a>
              </>
            )}
          </p>
        </form>
      </div>
    </main>
  )
}
