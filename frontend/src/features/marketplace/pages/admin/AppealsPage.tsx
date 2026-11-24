import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { ApiRequestError } from '@/common/api/client'
import {
  decideAppeal,
  fetchAppeals,
  type ApiAppeal,
  type AppealStatus,
} from '../../api/appeals'

/**
 * The queue AI-06 and RM-08 ask for: who appealed what, why, and the two
 * buttons that end it. A decision needs a reason, and the server refuses the
 * reviewer who made the original call — so a moderator sees that refusal here
 * rather than a mystery.
 */
export function AppealsPage() {
  const [rows, setRows] = useState<ApiAppeal[]>([])
  const [filter, setFilter] = useState<AppealStatus | 'all'>('pending')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load(status: AppealStatus | 'all') {
    setLoading(true)
    try {
      setRows(await fetchAppeals(status === 'all' ? undefined : status))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The queue could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(filter)
  }, [filter])

  async function decide(appeal: ApiAppeal, grant: boolean) {
    const note = (notes[appeal.id] || '').trim()
    if (!note) {
      setError('Give a reason: the appellant is told what you decided and why.')
      return
    }
    setBusyId(appeal.id)
    setError(null)
    try {
      await decideAppeal(appeal.id, grant, note)
      await load(filter)
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
          <h1 style={{ fontSize: 22, margin: 0 }}>Appeals</h1>
          <p className="small muted" style={{ margin: 0 }}>
            A person disagreeing with a decision. Whoever made the original call cannot decide the
            appeal, and every decision needs a reason.
          </p>
        </div>
        <div className="tabs" role="tablist" aria-label="Appeal status">
          {(['pending', 'granted', 'denied', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={filter === s}
              className={`tab ${filter === s ? 'on' : ''}`.trim()}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
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
            Nothing {filter === 'all' ? '' : filter} here. An appeal appears the moment a member
            files one.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {rows.map((appeal) => (
            <div key={appeal.id} className="card stack" style={{ gap: 8 }}>
              <div className="row between wrap" style={{ gap: 8 }}>
                <span className="row wrap" style={{ gap: 8 }}>
                  <b>{appeal.appellant_name}</b>
                  <span className="pill">
                    {appeal.kind === 'account' ? 'Account suspension' : appeal.kind}
                  </span>
                  <span
                    className={`pill ${
                      appeal.status === 'granted'
                        ? 'green'
                        : appeal.status === 'denied'
                          ? 'red'
                          : 'yellow'
                    }`}
                  >
                    {appeal.status}
                  </span>
                </span>
                <span className="tiny muted">
                  {new Date(appeal.created_at).toLocaleString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <p className="small" style={{ margin: 0 }}>
                <b>{appeal.target_label || 'Account'}</b>
              </p>
              <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {appeal.reason}
              </p>

              {appeal.status === 'pending' ? (
                <>
                  {appeal.original_decider_name && (
                    <p className="tiny muted" style={{ margin: 0 }}>
                      Decided originally by {appeal.original_decider_name}; they cannot review it.
                    </p>
                  )}
                  <textarea
                    className="input"
                    rows={2}
                    maxLength={600}
                    placeholder="The reason, in the appellant's own terms."
                    value={notes[appeal.id] || ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [appeal.id]: e.target.value }))
                    }
                  />
                  <div className="row wrap" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={busyId === appeal.id}
                      onClick={() => void decide(appeal, true)}
                    >
                      <Icon name="check" size="sm" /> Grant
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={busyId === appeal.id}
                      onClick={() => void decide(appeal, false)}
                    >
                      <Icon name="x" size="sm" /> Deny
                    </button>
                  </div>
                </>
              ) : (
                <p className="small" style={{ margin: 0 }}>
                  <b>{appeal.status === 'granted' ? 'Granted' : 'Denied'}</b> by{' '}
                  {appeal.decided_by_name || 'staff'}: {appeal.decision_note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
