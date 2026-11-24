import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { apiDownload, ApiRequestError } from '@/common/api/client'
import { fetchOutbox, outboxExportPath, type ApiOutboxMessage } from '../../api/store'

/**
 * EM-06: the Official Store's outbox, as the office reads it.
 *
 * Every row here is a message the system *prepared*, never one it sent — EM-05
 * keeps the sending switch off until the IT Office decides. That is why the
 * screen says "prepared" rather than "sent", and why there is no resend button:
 * this is a record to read, preview and hand to whoever needs it as a file.
 */
export function OutboxPage() {
  const [rows, setRows] = useState<ApiOutboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<'all' | 'student' | 'staff'>('all')
  const [state, setState] = useState<'all' | 'prepared' | 'skipped'>('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(
        await fetchOutbox({
          kind: kind === 'all' ? undefined : kind,
          state: state === 'all' ? undefined : state,
        }),
      )
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'The outbox could not be loaded. Office Staff only.',
      )
    } finally {
      setLoading(false)
    }
  }, [kind, state])

  useEffect(() => {
    void load()
  }, [load])

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const { blob, filename } = await apiDownload(
        outboxExportPath({
          kind: kind === 'all' ? undefined : kind,
          state: state === 'all' ? undefined : state,
        }),
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || 'tindahan-outbox.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That export could not be prepared.')
    } finally {
      setBusy(false)
    }
  }

  const stamp = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card stack" style={{ gap: 6 }}>
        <div className="row between wrap">
          <div>
            <b>Email outbox</b>
            <p className="small muted" style={{ margin: 0 }}>
              Messages the store prepared for students and for the office. Nothing here has been
              sent — sending stays switched off until the IT Office decides, so this is the record
              of what would go out.
            </p>
          </div>
          <button type="button" className="btn sm" disabled={busy} onClick={() => void download()}>
            <Icon name="dl" size="sm" /> {busy ? 'Preparing…' : 'Download JSON'}
          </button>
        </div>

        <div className="row wrap" style={{ gap: 10 }}>
          <label className="small" style={{ gap: 4 }}>
            Audience
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="all">Everyone</option>
              <option value="student">Students</option>
              <option value="staff">Office staff</option>
            </select>
          </label>
          <label className="small" style={{ gap: 4 }}>
            State
            <select
              className="input"
              value={state}
              onChange={(e) => setState(e.target.value as typeof state)}
            >
              <option value="all">Both</option>
              <option value="prepared">Prepared</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <span className="pill">{rows.length} message{rows.length === 1 ? '' : 's'}</span>
          {loading && <span className="tiny muted">Loading…</span>}
        </div>

        {error && (
          <p className="small" role="alert" style={{ color: 'var(--red)', margin: 0 }}>
            {error}
          </p>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {rows.map((m) => {
          const open = openId === m.id
          return (
            <div key={m.id} className="card stack" style={{ gap: 8 }}>
              <button
                type="button"
                className="row between wrap"
                aria-expanded={open}
                style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', gap: 8 }}
                onClick={() => setOpenId(open ? null : m.id)}
              >
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <b style={{ overflowWrap: 'anywhere' }}>{m.subject}</b>
                  <span className="tiny muted">
                    {m.kind_display} · {m.event} · {stamp(m.created_at)}
                    {m.ticket_reference ? ` · #${m.ticket_reference}` : ''}
                  </span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <span className={`pill ${m.state === 'skipped' ? 'yellow' : ''}`.trim()}>
                    {m.state_display}
                  </span>
                  <span className="tiny muted">{open ? 'Hide' : 'Preview'}</span>
                </span>
              </button>

              {open && (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <span className="tiny muted">To:</span>
                    {m.recipients.length ? (
                      m.recipients.map((r) => (
                        <span key={r} className="pill">
                          {r}
                        </span>
                      ))
                    ) : (
                      <span className="pill yellow">No address — skipped</span>
                    )}
                  </div>
                  <pre
                    className="small"
                    style={{
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                      padding: 12,
                      background: 'var(--soft)',
                      borderRadius: 8,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {m.body}
                  </pre>
                  {m.note && <p className="tiny muted" style={{ margin: 0 }}>{m.note}</p>}
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Prepared, not sent. The sending switch is off by design (EM-05).
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {!loading && !rows.length && (
          <div className="card stack">
            <p className="small muted" style={{ margin: 0 }}>
              Nothing in the outbox yet. It fills as tickets change status and as stock runs low.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
