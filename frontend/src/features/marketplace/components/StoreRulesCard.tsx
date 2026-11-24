import { useEffect, useState } from 'react'
import { ApiRequestError } from '@/common/api/client'
import {
  fetchStoreSettings,
  patchStoreSettings,
  type ApiStoreSettings,
} from '../api/store'

/**
 * OS-12: the store's own rules, edited by staff instead of by a deploy.
 *
 * Five knobs and one honest compromise. Four are plain fields — the queue
 * prefix, its width, the store-wide note, and which statuses demand a reason.
 * The fifth is the transition graph, which is a small map and therefore a small
 * JSON box: a drag-and-drop graph editor would be a week of work to protect a
 * setting that changes twice a term, and the server refuses an unknown status
 * with a sentence rather than accepting it.
 */
const STATUSES: Array<[string, string]> = [
  ['request_received', 'Request Received'],
  ['confirmed', 'Confirmed'],
  ['on_hold', 'On Hold'],
  ['ready_for_pickup', 'Ready for Pickup'],
  ['claimed', 'Claimed'],
  ['cancelled', 'Cancelled'],
]

export function StoreRulesCard() {
  const [settings, setSettings] = useState<ApiStoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [transitions, setTransitions] = useState('')
  const [reasons, setReasons] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    fetchStoreSettings()
      .then((body) => {
        if (!alive) return
        setSettings(body)
        setTransitions(JSON.stringify(body.allowed_transitions ?? {}, null, 2))
        setReasons(body.reason_required ?? [])
      })
      .catch((err) => {
        if (alive) setError(err instanceof ApiRequestError ? err.message : 'Could not read the settings.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  async function save() {
    if (!settings) return
    setBusy(true)
    setError(null)
    setNote(null)
    let graph: Record<string, string[]>
    try {
      graph = transitions.trim() ? JSON.parse(transitions) : {}
    } catch {
      setError('The transition map is not valid JSON. Fix it, or clear the box to use the built-in graph.')
      setBusy('' as never)
      return
    }
    try {
      const saved = await patchStoreSettings({
        queue_prefix: settings.queue_prefix,
        queue_number_width: settings.queue_number_width,
        claim_note: settings.claim_note,
        reason_required: reasons,
        allowed_transitions: graph,
      })
      setSettings(saved)
      setTransitions(JSON.stringify(saved.allowed_transitions ?? {}, null, 2))
      setNote('Saved. The store obeys these from the next request onward.')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="card stack">
        <b>Store rules (OS-12)</b>
        <p className="small muted" style={{ margin: 0 }}>Reading the settings…</p>
      </div>
    )
  }
  if (!settings) {
    return (
      <div className="card stack">
        <b>Store rules (OS-12)</b>
        <p className="small" style={{ margin: 0, color: 'var(--red)' }}>
          {error ?? 'The settings could not be read.'}
        </p>
      </div>
    )
  }

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div>
        <b>Store rules (OS-12)</b>
        <p className="small muted" style={{ margin: 0 }}>
          What the office can change without a deployment: the queue number, the store-wide
          note that goes out with every ticket, which statuses need a reason, and which
          moves between statuses are allowed.
        </p>
      </div>

      <div className="row wrap" style={{ gap: 10 }}>
        <label className="small" style={{ gap: 4 }}>
          Queue prefix
          <input
            className="input"
            maxLength={6}
            style={{ maxWidth: 110 }}
            value={settings.queue_prefix}
            onChange={(e) => setSettings({ ...settings, queue_prefix: e.target.value })}
          />
        </label>
        <label className="small" style={{ gap: 4 }}>
          Digits
          <input
            className="input"
            type="number"
            min={1}
            max={6}
            style={{ maxWidth: 90 }}
            value={settings.queue_number_width}
            onChange={(e) =>
              setSettings({ ...settings, queue_number_width: Number(e.target.value) })
            }
          />
        </label>
      </div>

      <label className="small" style={{ gap: 4 }}>
        Store-wide claim note
        <textarea
          className="input"
          rows={2}
          maxLength={600}
          placeholder="Bring your RTU ID to the BAO window."
          value={settings.claim_note}
          onChange={(e) => setSettings({ ...settings, claim_note: e.target.value })}
        />
      </label>

      <div className="stack" style={{ gap: 4 }}>
        <span className="small">Statuses that cannot be set without a reason</span>
        <div className="row wrap" style={{ gap: 10 }}>
          {STATUSES.map(([value, label]) => (
            <label key={value} className="row small" style={{ gap: 4 }}>
              <input
                type="checkbox"
                checked={reasons.includes(value)}
                onChange={(e) =>
                  setReasons((prev) =>
                    e.target.checked ? [...prev, value] : prev.filter((item) => item !== value),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <label className="small" style={{ gap: 4 }}>
        Allowed transitions (JSON — empty means the built-in graph)
        <textarea
          className="input"
          rows={8}
          spellCheck={false}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
          value={transitions}
          onChange={(e) => setTransitions(e.target.value)}
        />
      </label>
      <p className="tiny muted" style={{ margin: 0 }}>
        An unknown status is refused by the server rather than saved, so a typo cannot strand a
        ticket. Leave the box empty to fall back to the graph the code ships with.
      </p>

      {error && (
        <p className="small" role="alert" style={{ margin: 0, color: 'var(--red)' }}>
          {error}
        </p>
      )}
      {note && (
        <p className="small" role="status" style={{ margin: 0, color: 'var(--green)' }}>
          {note}
        </p>
      )}

      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save the store rules'}
        </button>
      </div>
    </div>
  )
}
