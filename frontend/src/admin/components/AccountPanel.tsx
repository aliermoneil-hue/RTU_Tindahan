import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../lib/api'
import { prefersReducedMotion } from '../lib/motion'
import { formatDate, formatDateTime, initials } from '../lib/format'
import { MEMBER_LABEL, ROLES, ROLE_LABEL, STATUSES, STATUS_LABEL } from '../lib/types'
import type { AccountStatus, AdminUser, Role } from '../lib/types'
import { RoleBadge, StatusBadge, VerifiedBadge } from './Badge'

interface Props {
  account: AdminUser
  onClose: () => void
  onChanged: (account: AdminUser) => void
}

export function AccountPanel({ account, onClose, onChanged }: Props) {
  const { user: me, abilities } = useAuth()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [closing, setClosing] = useState(false)

  // Slide out first, then tell the page to remove the panel.
  const requestClose = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => onCloseRef.current(), prefersReducedMotion() ? 0 : 220)
  }
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  const [role, setRole] = useState<Role>(account.role)
  const [status, setStatus] = useState<AccountStatus>(account.status)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<ApiError | null>(null)

  // Start from the saved values whenever a different account (or a fresh save) arrives.
  useEffect(() => {
    setRole(account.role)
    setStatus(account.status)
    setNote('')
    setError(null)
  }, [account])

  // Keyboard: Escape closes; focus returns to the row that opened the panel.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [account.id])

  const isSelf = me?.id === account.id
  const roleChanged = role !== account.role
  const statusChanged = status !== account.status
  const needsNote = statusChanged && status !== 'active'
  const dirty = roleChanged || statusChanged
  const canEdit = abilities.manageAccounts && !isSelf
  const canVerify = abilities.verifyAccounts && !account.is_verified && account.status === 'active'

  async function save() {
    setBusy(true)
    setError(null)
    setMessage('')
    try {
      const changes: { role?: string; status?: string; status_note?: string } = {}
      if (roleChanged) changes.role = role
      if (statusChanged) {
        changes.status = status
        if (needsNote) changes.status_note = note.trim()
      }
      const updated = await api.updateAccount(account.id, changes)
      onChanged(updated)
      setMessage('Changes saved.')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'Could not save the changes.'))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    setError(null)
    setMessage('')
    try {
      const updated = await api.verifyAccount(account.id)
      onChanged(updated)
      setMessage('Account verified.')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'Could not verify the account.'))
    } finally {
      setBusy(false)
    }
  }

  const fieldError = (name: string) => error?.fields[name]?.join(' ')
  const generalError = error && !Object.keys(error.fields).length ? error.message : ''

  return (
    <div
      className={`drawer-backdrop${closing ? ' is-closing' : ''}`}
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-head">
          <span className="avatar avatar-large" aria-hidden="true">{initials(account.display_name)}</span>
          <div className="drawer-title">
            <h2 id="drawer-title">{account.display_name}</h2>
            <p className="muted">{account.email}</p>
          </div>
          <button ref={closeRef} type="button" className="btn btn-quiet" onClick={requestClose}>
            Close
          </button>
        </header>

        <div className="drawer-body">
          <div className="badges">
            <RoleBadge role={account.role} />
            <StatusBadge status={account.status} />
            <VerifiedBadge verified={account.is_verified} />
          </div>

          {account.status !== 'active' && account.status_note && (
            <p className="alert alert-warn">
              <strong>{STATUS_LABEL[account.status]}</strong>
              {account.status_changed_at ? ` on ${formatDate(account.status_changed_at)}` : ''}:{' '}
              {account.status_note}
            </p>
          )}

          <dl className="facts">
            <Fact label="Student number" value={account.student_number} />
            <Fact label="Member type" value={MEMBER_LABEL[account.member_type]} />
            <Fact label="College or office" value={account.college} />
            <Fact label="Year level" value={account.year_level ? `Year ${account.year_level}` : null} />
            <Fact label="Contact number" value={account.contact_number} />
            <Fact label="Joined" value={formatDate(account.date_joined)} />
            <Fact label="Verified" value={account.verified_at ? formatDateTime(account.verified_at) : 'Not yet'} />
            <Fact label="Last sign-in" value={formatDateTime(account.last_login)} />
          </dl>

          {message && <p className="alert alert-ok" role="status" key={message}>{message}</p>}
          {generalError && <p className="alert alert-error" role="alert">{generalError}</p>}

          {canVerify && (
            <section className="panel-section">
              <h3>Verification</h3>
              <p className="muted">
                Use this after you have checked the person's RTU email and school ID. It also gives
                the account the Verified User role.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => void verify()} disabled={busy}>
                Verify this account
              </button>
            </section>
          )}

          {abilities.manageAccounts && (
            <section className="panel-section">
              <h3>Role and status</h3>
              {isSelf && (
                <p className="muted">This is your own account. Ask another administrator to change it.</p>
              )}
              {!account.is_verified && !isSelf && (
                <p className="muted">Verify the account before giving it a role.</p>
              )}

              <label className="field">
                <span>Role</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  disabled={!canEdit || busy || !account.is_verified}
                >
                  {ROLES.map((value) => (
                    <option key={value} value={value}>{ROLE_LABEL[value]}</option>
                  ))}
                </select>
                {fieldError('role') && <small className="field-error">{fieldError('role')}</small>}
              </label>

              {role === 'administrator' && roleChanged && (
                <p className="alert alert-warn">
                  Administrators can change every account and role. Only give this role to people
                  you trust with that.
                </p>
              )}

              <label className="field">
                <span>Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as AccountStatus)}
                  disabled={!canEdit || busy}
                >
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>{STATUS_LABEL[value]}</option>
                  ))}
                </select>
                {fieldError('status') && <small className="field-error">{fieldError('status')}</small>}
              </label>

              {needsNote && (
                <label className="field">
                  <span>Reason (kept on the account record)</span>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={
                      status === 'banned'
                        ? 'Why is this account being banned?'
                        : 'Why is this account being suspended?'
                    }
                    disabled={busy}
                  />
                  {fieldError('status_note') && (
                    <small className="field-error">{fieldError('status_note')}</small>
                  )}
                </label>
              )}
              {needsNote && (
                <p className="muted">The person is signed out right away and cannot sign in again.</p>
              )}

              <div className="actions">
                <button
                  type="button"
                  className={`btn ${needsNote ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => void save()}
                  disabled={!canEdit || !dirty || busy || (needsNote && note.trim().length < 3)}
                >
                  {busy ? 'Saving…' : needsNote ? (status === 'banned' ? 'Ban account' : 'Suspend account') : 'Save changes'}
                </button>
                {dirty && !busy && (
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => {
                      setRole(account.role)
                      setStatus(account.status)
                      setNote('')
                      setError(null)
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value || <span className="muted">Not given</span>}</dd>
    </div>
  )
}
