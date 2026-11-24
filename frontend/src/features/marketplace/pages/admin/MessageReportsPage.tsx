import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { ApiRequestError } from '@/common/api/client'
import {
  fetchMessageReports,
  resolveMessageReport,
  type ApiMessageReport,
} from '../../api/messages'

/**
 * MS-05, on screen: the reported message and nothing else from a private
 * conversation. A moderator picks what to do — dismiss, warn, suspend — and has
 * to say what the sender will be told, because that sentence is the reason on
 * the record.
 */
export function MessageReportsPage() {
  const [rows, setRows] = useState<ApiMessageReport[]>([])
  const [status, setStatus] = useState<'open' | 'dismissed' | 'actioned'>('open')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load(which: typeof status) {
    setLoading(true)
    try {
      setRows(await fetchMessageReports(which))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The queue could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(status)
  }, [status])

  async function resolve(report: ApiMessageReport, action: 'dismiss' | 'warn' | 'suspend') {
    const note = (notes[report.id] || '').trim()
    if (action !== 'dismiss' && !note) {
      setError('Say what the sender is being told, so the record has a reason.')
      return
    }
    setBusyId(report.id)
    setError(null)
    try {
      await resolveMessageReport(report.id, action, note)
      await load(status)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That decision was not saved.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="section stack" style={{ gap: 14 }}>
      <div className="row between wrap">
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Message reports</h1>
          <p className="small muted" style={{ margin: 0 }}>
            A reported conversation shows only the message it was reported for. The rest of the
            thread stays private, and the person reported is not told a report exists.
          </p>
        </div>
        <div className="tabs" role="tablist" aria-label="Report status">
          {(['open', 'actioned', 'dismissed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={`tab ${status === s ? 'on' : ''}`.trim()}
              onClick={() => setStatus(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="small" role="alert" style={{ color: 'var(--danger, #b3261e)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="small muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card">
          <p className="small muted" style={{ margin: 0 }}>
            Nothing {status} here.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {rows.map((report) => (
            <div key={report.id} className="card stack" style={{ gap: 8 }}>
              <div className="row between wrap" style={{ gap: 8 }}>
                <span className="row wrap" style={{ gap: 8 }}>
                  <b>{report.reason_display}</b>
                  <span className="pill">{report.is_thread_report ? 'Whole thread' : 'One message'}</span>
                  <span
                    className={`pill ${
                      report.status === 'actioned'
                        ? 'green'
                        : report.status === 'dismissed'
                          ? 'navy'
                          : 'yellow'
                    }`}
                  >
                    {report.status_display}
                  </span>
                </span>
                <span className="tiny muted">
                  {new Date(report.created_at).toLocaleString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <p className="small" style={{ margin: 0 }}>
                Reported by <b>{report.reporter_name}</b> against <b>{report.reported_user_name}</b>
              </p>

              {report.reported_messages.length > 0 ? (
                <blockquote
                  className="small"
                  style={{
                    margin: 0,
                    padding: '8px 12px',
                    borderLeft: '3px solid var(--line, #d6d9e0)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  “{report.reported_messages[0].body}”
                  <span className="tiny muted"> — the message the report is about</span>
                </blockquote>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>
                  The whole thread was reported, so no message is shown — read the reporter's words
                  below instead.
                </p>
              )}

              {report.details && (
                <p className="small" style={{ margin: 0 }}>
                  <b>Reporter says:</b> {report.details}
                </p>
              )}

              {report.status === 'open' ? (
                <>
                  <input
                    className="input"
                    maxLength={600}
                    placeholder="What the sender will be told, if anything."
                    value={notes[report.id] || ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))
                    }
                  />
                  <div className="row wrap" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={busyId === report.id}
                      onClick={() => void resolve(report, 'warn')}
                    >
                      <Icon name="flag" size="sm" /> Warn the sender
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={busyId === report.id}
                      onClick={() => void resolve(report, 'suspend')}
                    >
                      <Icon name="lock" size="sm" /> Suspend
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={busyId === report.id}
                      onClick={() => void resolve(report, 'dismiss')}
                    >
                      <Icon name="x" size="sm" /> Dismiss
                    </button>
                  </div>
                </>
              ) : (
                <p className="small" style={{ margin: 0 }}>
                  <b>{report.action === 'dismiss' ? 'Dismissed' : 'Action taken'}</b>
                  {report.handled_by_name ? ` by ${report.handled_by_name}` : ''}
                  {report.note ? `: ${report.note}` : '.'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
