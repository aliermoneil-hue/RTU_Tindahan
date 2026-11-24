import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { ApiRequestError } from '@/common/api/client'
import {
  createScreeningRule,
  deleteScreeningRule,
  fetchScreeningRules,
  updateScreeningRule,
  type ApiScreeningRule,
} from '../../api/screening'

/**
 * AI-10: the two lists the screening reads. An administrator adds a phrase the
 * moment a seller finds a way around the old list; the change is live on the
 * next item screened, and every change is in the audit log.
 */
export function ScreeningRulesPage() {
  const [rows, setRows] = useState<ApiScreeningRule[]>([])
  const [kind, setKind] = useState<'prohibited' | 'scam'>('prohibited')
  const [phrase, setPhrase] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      setRows(await fetchScreeningRules())
      setError(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The rules could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function add() {
    const value = phrase.trim().toLowerCase()
    if (value.length < 2) {
      setError('A phrase needs at least two characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createScreeningRule({ phrase: value, kind, note: note.trim() })
      setPhrase('')
      setNote('')
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That phrase could not be added.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(rule: ApiScreeningRule) {
    setBusy(true)
    try {
      await updateScreeningRule(rule.id, { is_active: !rule.is_active })
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(rule: ApiScreeningRule) {
    setBusy(true)
    try {
      await deleteScreeningRule(rule.id)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That phrase could not be removed.')
    } finally {
      setBusy(false)
    }
  }

  const shown = rows.filter((r) => r.kind === kind)
  const activeCount = shown.filter((r) => r.is_active).length

  return (
    <div className="section stack" style={{ gap: 14 }}>
      <div className="row between wrap">
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Screening rules</h1>
          <p className="small muted" style={{ margin: 0 }}>
            The phrases the automatic check looks for. A change takes effect on the next item
            screened — no release needed — and is written to the audit log.
          </p>
        </div>
        <div className="tabs" role="tablist" aria-label="Rule kind">
          {(['prohibited', 'scam'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={`tab ${kind === k ? 'on' : ''}`.trim()}
              onClick={() => setKind(k)}
            >
              {k === 'prohibited' ? 'Prohibited' : 'Scam patterns'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="small" role="alert" style={{ color: 'var(--danger, #b3261e)' }}>
          {error}
        </p>
      )}

      <div className="card stack" style={{ gap: 8 }}>
        <b className="small">Add a phrase</b>
        <div className="row wrap small" style={{ gap: 10 }}>
          <label className="small grow" style={{ gap: 4 }}>
            Phrase
            <input
              className="input"
              maxLength={120}
              value={phrase}
              placeholder={kind === 'prohibited' ? 'e.g. fake transcript' : 'e.g. send gcash first'}
              onChange={(e) => setPhrase(e.target.value)}
            />
          </label>
          <label className="small grow" style={{ gap: 4 }}>
            Why (optional)
            <input
              className="input"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button type="button" className="btn sm" disabled={busy} onClick={() => void add()}>
            <Icon name="plus" size="sm" /> Add to {kind === 'prohibited' ? 'prohibited' : 'scam'}
          </button>
        </div>
        <p className="tiny muted">
          {kind === 'prohibited'
            ? 'A prohibited phrase on its own is enough to hold a listing or post for review.'
            : 'A scam phrase describes a pay-first or off-app pattern; it only applies to listing text.'}
        </p>
      </div>

      <div className="row between small muted">
        <span>
          {shown.length} phrase{shown.length === 1 ? '' : 's'} · {activeCount} active
        </span>
        <button type="button" className="link" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="small muted">Loading…</p>
      ) : (
        <div className="card stack" style={{ gap: 6 }}>
          {shown.map((rule) => (
            <div key={rule.id} className="row between wrap small" style={{ gap: 8 }}>
              <span style={{ flex: 1, overflowWrap: 'anywhere' }}>
                <b style={{ opacity: rule.is_active ? 1 : 0.5 }}>{rule.phrase}</b>
                {rule.note && <span className="tiny muted"> · {rule.note}</span>}
              </span>
              <span className={`pill ${rule.is_active ? 'green' : 'navy'}`}>
                {rule.is_active ? 'Active' : 'Off'}
              </span>
              <button
                type="button"
                className="btn ghost sm"
                disabled={busy}
                onClick={() => void toggle(rule)}
              >
                {rule.is_active ? 'Switch off' : 'Switch on'}
              </button>
              <button
                type="button"
                className="link"
                disabled={busy}
                onClick={() => void remove(rule)}
              >
                Remove
              </button>
            </div>
          ))}
          {shown.length === 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              No phrases of this kind. With the table empty the shipped list is used, so screening
              keeps working.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
