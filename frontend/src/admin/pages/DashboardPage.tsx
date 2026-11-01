import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useAuth } from '../auth/AuthContext'
import { RoleBadge, StatusBadge } from '../components/Badge'
import { PageHeader } from '../components/Layout'
import { api, ApiError } from '../lib/api'
import { formatDate } from '../lib/format'
import { useCountUp } from '../lib/motion'
import { Link } from '../lib/router'
import { ROLES, ROLE_LABEL, STATUSES, STATUS_LABEL } from '../lib/types'
import type { Health, Summary } from '../lib/types'

export function DashboardPage() {
  const { user, abilities } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [health, setHealth] = useState<Health | 'down' | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    api
      .summary(controller.signal)
      .then(setSummary)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof ApiError ? caught.message : 'Could not load the dashboard.')
      })
    api
      .health(controller.signal)
      .then(setHealth)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setHealth('down')
      })
    return () => controller.abort()
  }, [attempt])

  const greeting = user ? `Signed in as ${ROLE_LABEL[user.role]}.` : ''

  return (
    <>
      <PageHeader title="Dashboard" subtitle={greeting} />

      {error && (
        <p className="alert alert-error" role="alert">
          {error}{' '}
          <button type="button" className="link-button" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}

      {!summary && !error && <p className="muted">Loading the numbers…</p>}

      {summary && (
        <>
          <section className="tiles" aria-label="Account totals">
            <Tile label="Accounts" value={summary.total} index={0} />
            <Tile
              label="Awaiting verification"
              index={1}
              value={summary.unverified}
              tone={summary.unverified > 0 ? 'warn' : undefined}
              to={abilities.verifyAccounts ? '/accounts?verified=false' : undefined}
            />
            <Tile
              label="Suspended or banned"
              index={2}
              value={summary.by_status.suspended + summary.by_status.banned}
              tone={summary.by_status.suspended + summary.by_status.banned > 0 ? 'bad' : undefined}
              to={abilities.viewAccounts ? '/accounts?status=suspended' : undefined}
            />
            <Tile label="Joined in the last 7 days" value={summary.new_last_7_days} index={3} />
          </section>

          <div className="grid-2">
            <section className="card" aria-labelledby="by-role">
              <h2 id="by-role">Accounts by role</h2>
              <Bars
                rows={ROLES.map((role) => ({
                  key: role,
                  label: ROLE_LABEL[role],
                  value: summary.by_role[role],
                }))}
                total={summary.total}
              />
            </section>
            <section className="card" aria-labelledby="by-status">
              <h2 id="by-status">Accounts by status</h2>
              <Bars
                rows={STATUSES.map((status) => ({
                  key: status,
                  label: STATUS_LABEL[status],
                  value: summary.by_status[status],
                  tone: status,
                }))}
                total={summary.total}
              />
              <HealthLine health={health} />
            </section>
          </div>

          {abilities.viewAccounts && (
            <section className="card" aria-labelledby="recent">
              <div className="card-head">
                <h2 id="recent">Newest accounts</h2>
                <Link to="/accounts" className="link">See all accounts</Link>
              </div>
              {summary.recent.length === 0 ? (
                <p className="muted">No accounts yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Role</th>
                        <th scope="col">Status</th>
                        <th scope="col">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recent.map((row, index) => (
                        <tr key={row.id} className="row-in" style={{ '--i': index } as CSSProperties}>
                          <td>
                            <div className="cell-name">
                              <strong>{row.display_name}</strong>
                              <small>{row.email}</small>
                            </div>
                          </td>
                          <td><RoleBadge role={row.role} /></td>
                          <td><StatusBadge status={row.status} /></td>
                          <td>{formatDate(row.date_joined)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {!abilities.viewAccounts && (
            <p className="muted">
              Moderation queues arrive with the content screening work. For now this page shows
              account totals only.
            </p>
          )}
        </>
      )}
    </>
  )
}

function Tile({
  label,
  value,
  tone,
  to,
  index,
}: {
  label: string
  value: number
  tone?: 'warn' | 'bad'
  to?: string
  index: number
}) {
  const shown = useCountUp(value)
  const style = { '--i': index } as CSSProperties
  const body = (
    <>
      <span className="tile-value">{shown.toLocaleString('en-PH')}</span>
      <span className="tile-label">{label}</span>
    </>
  )
  const className = `tile${tone ? ` tile-${tone}` : ''}`
  return to ? (
    <Link to={to} className={`${className} tile-link`} style={style}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>{body}</div>
  )
}

function Bars({
  rows,
  total,
}: {
  rows: { key: string; label: string; value: number; tone?: string }[]
  total: number
}) {
  // Start at zero, then grow to the real width on the next frame.
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <ul className="bars">
      {rows.map((row, index) => {
        const share = total > 0 ? (row.value / total) * 100 : 0
        return (
          <li key={row.key}>
            <span className="bar-label">{row.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span
                className={`bar-fill${row.tone ? ` bar-${row.tone}` : ''}`}
                style={{
                  width: grown ? `${share}%` : 0,
                  minWidth: grown && row.value > 0 ? 4 : 0,
                  transitionDelay: `${index * 70}ms`,
                }}
              />
            </span>
            <span className="bar-value">{row.value}</span>
          </li>
        )
      })}
    </ul>
  )
}

function HealthLine({ health }: { health: Health | 'down' | null }) {
  if (health === null) return <p className="health muted">Checking the server…</p>
  if (health === 'down') {
    return (
      <p className="health health-bad">
        <span className="dot" aria-hidden="true" /> Server health check failed
      </p>
    )
  }
  const ok = health.status === 'ok'
  return (
    <p className={`health ${ok ? 'health-ok' : 'health-bad'}`}>
      <span className="dot" aria-hidden="true" />
      {ok ? 'Server and database are running' : 'Database is unavailable'} ({health.database_vendor})
    </p>
  )
}
