import { useRef, useState } from 'react'
import { apiDownload, ApiRequestError, saveBlob } from '@/common/api/client'
import {
  downloadJsonBackupPath,
  importJsonBackup,
  resetContent,
  type ApiResetResult,
} from '../api/admin'

/**
 * PX-06: the content as JSON, an import of one, and a reset.
 *
 * Three buttons, and the two that can hurt ask for a word rather than a click:
 * the server refuses `import` without IMPORT and `reset` without RESET, so a
 * stray click on a demo machine cannot empty the marketplace. What a reset keeps
 * is stated on the card, because "reset everything" means something narrower
 * here than a panelist might assume.
 */
export function JsonBackupCard({ isAdmin }: { isAdmin: boolean }) {
  const [busy, setBusy] = useState<'' | 'download' | 'import' | 'reset'>('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<ApiResetResult | null>(null)
  const [confirmWord, setConfirmWord] = useState('')
  const fileInput = useRef<HTMLInputElement | null>(null)

  async function download() {
    setBusy('download')
    setError(null)
    setNote(null)
    try {
      const { blob, filename } = await apiDownload(downloadJsonBackupPath())
      saveBlob(blob, filename || 'tindahan-backup.json')
      setNote('Downloaded. Accounts travel as references in this file, not as credentials.')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That backup could not be prepared.')
    } finally {
      setBusy('')
    }
  }

  async function upload(file: File) {
    setBusy('import')
    setError(null)
    setNote(null)
    try {
      const result = await importJsonBackup(file, 'IMPORT')
      setNote(
        `Imported ${result.total} row${result.total === 1 ? '' : 's'} from ${file.name}. ` +
          'Nothing was deleted: rows that were not in the file are still here.',
      )
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That file could not be imported.')
    } finally {
      setBusy('')
    }
  }

  async function reset() {
    setBusy('reset')
    setError(null)
    setNote(null)
    try {
      const result = await resetContent('RESET')
      setResetResult(result)
      setNote(`Cleared ${result.total} row${result.total === 1 ? '' : 's'}.`)
      setConfirmWord('')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That reset could not be run.')
    } finally {
      setBusy('')
    }
  }

  if (!isAdmin) {
    return (
      <div className="card stack">
        <b>JSON backup, import and reset</b>
        <p className="small muted" style={{ margin: 0 }}>
          Ask an administrator: importing and resetting rewrite live data.
        </p>
      </div>
    )
  }

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div>
        <b>JSON backup, import and reset (PX-06)</b>
        <p className="small muted" style={{ margin: 0 }}>
          The content as one JSON file — listings, threads, orders, reviews, tickets and
          settings. Accounts are named in it so a restored listing keeps its seller, but no
          password travels in this file; credentials live in the database backup above.
        </p>
      </div>

      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn" disabled={busy === 'download'} onClick={() => void download()}>
          {busy === 'download' ? 'Preparing…' : 'Download JSON backup'}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy === 'import'}
          onClick={() => fileInput.current?.click()}
        >
          {busy === 'import' ? 'Importing…' : 'Import a JSON backup'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            if (!window.confirm(`Import ${file.name}? Rows that share a key will be overwritten.`)) return
            void upload(file)
          }}
        />
      </div>

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
      {resetResult && (
        <details className="small">
          <summary>What the reset cleared, and what it kept</summary>
          <p className="small muted" style={{ margin: '6px 0' }}>
            Kept: {resetResult.kept.join('; ')}.
          </p>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {(Object.entries(resetResult.cleared) as Array<[string, number]>)
              .filter(([, count]) => count > 0)
              .map(([table, count]) => (
                <li key={table}>
                  {table}: {count}
                </li>
              ))}
          </ul>
        </details>
      )}

      <div
        className="stack"
        style={{ gap: 8, padding: 10, background: 'var(--red-bg)', borderRadius: 8 }}
      >
        <b className="small">Reset the content</b>
        <p className="small" style={{ margin: 0 }}>
          Clears every listing, thread, order, review, report and ticket that members made.
          Accounts, categories, screening rules, the store settings, the official store
          catalogue and the audit log stay. The change is written to the audit log.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ maxWidth: 180 }}
            placeholder="Type RESET"
            value={confirmWord}
            onChange={(e) => setConfirmWord(e.target.value)}
            aria-label="Type RESET to confirm"
          />
          <button
            type="button"
            className="btn danger"
            disabled={busy === 'reset' || confirmWord.trim().toUpperCase() !== 'RESET'}
            onClick={() => void reset()}
          >
            {busy === 'reset' ? 'Clearing…' : 'Reset the content'}
          </button>
        </div>
      </div>
    </div>
  )
}
