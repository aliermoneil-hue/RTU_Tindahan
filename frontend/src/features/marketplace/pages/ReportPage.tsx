import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate, useRoute } from '@/common/router/router'
import { ApiRequestError } from '@/common/api/client'
import { submitForumReportApi } from '../api/forum'
import { useTindahan } from '../context/TindahanContext'

// RM-01 names the reasons: Misleading, Scam, Inappropriate, Not from RTU, Other.
const REASONS = ['Misleading', 'Scam', 'Inappropriate', 'Not from RTU', 'Other']

/**
 * RM-01: a listing or a member can be reported, the same way a post can.
 * `#/report?type=listing&slug=…` or `#/report?type=user&user=<email>`.
 *
 * The server decides whether the report is allowed — you cannot report your own
 * listing or yourself, and the reported person is never told who reported them.
 */
export function ReportPage() {
  const { path, params } = useRoute()
  const { currentAccount, toast } = useTindahan()
  const rawType = params.get('type')
  const type: 'listing' | 'user' | 'review' =
    rawType === 'user' ? 'user' : rawType === 'review' ? 'review' : 'listing'
  const slug = params.get('slug') || ''
  const email = params.get('user') || ''
  const reviewId = Number(params.get('id') || 0)

  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (path !== 'report') return null

  const what =
    type === 'user' ? 'this member' : type === 'review' ? 'this review' : 'this listing'

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      if (type === 'listing' && !slug) {
        setError('That link is missing the listing. Open the listing and try again.')
        return
      }
      if (type === 'user' && !email) {
        setError('That link is missing the member. Open their listing and try again.')
        return
      }
      if (type === 'review' && !reviewId) {
        setError('That link is missing the review. Open the listing and try again.')
        return
      }
      await submitForumReportApi({
        type,
        reason,
        details: details.trim(),
        ...(type === 'listing'
          ? { listing: slug }
          : type === 'user'
            ? { reported_user: email }
            : { review: reviewId }),
      })
      setDone(true)
      toast('Report sent to the moderators.')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That report could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="section">
      <div className="card stack" style={{ gap: 12, maxWidth: 620, margin: '0 auto' }}>
        <div className="row between wrap">
          <b>Report {what}</b>
          <button type="button" className="link" onClick={() => navigate('market')}>
            Back to the marketplace
          </button>
        </div>

        {done ? (
          <p className="small" role="status">
            <Icon name="check" size="sm" /> Reported. A moderator will look at {what} and decide. You
            will get a notification when it is reviewed, and the person you reported is not told who
            reported them.
          </p>
        ) : (
          <>
            <p className="small muted">
              Reports go to the moderators, not to the person. Say what you saw so they know what to
              check.
            </p>
            <label className="small" style={{ gap: 4 }}>
              Reason
              <select
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="small" style={{ gap: 4 }}>
              What happened? (optional)
              <textarea
                className="input"
                rows={4}
                maxLength={400}
                value={details}
                placeholder="The listing offers to write the whole thesis, which is academic cheating."
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>
            {error && (
              <p className="small" role="alert" style={{ color: 'var(--danger, #b3261e)' }}>
                {error}
              </p>
            )}
            <div className="row">
              <button
                type="button"
                className="btn"
                disabled={busy || !currentAccount}
                onClick={() => void submit()}
              >
                {busy ? 'Sending…' : 'Send the report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
