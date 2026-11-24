import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate, useRoute } from '@/common/router/router'
import { ApiRequestError } from '@/common/api/client'
import { appealSuspension, createAppeal, type AppealKind } from '../api/appeals'
import { useTindahan } from '../context/TindahanContext'

/**
 * AI-06 and RM-08 in one small screen: say what you are appealing, say why, and
 * send it. The server decides whether the appeal is allowed at all — this page
 * only asks the question well.
 *
 * `#/appeal?kind=listing&id=27` is the usual way in; `#/appeal?kind=account` is
 * reached from the sign-in screen by someone who cannot sign in.
 */
export function AppealPage() {
  const { path, params } = useRoute()
  const { currentAccount, toast } = useTindahan()
  const kind = (params.get('kind') || 'listing') as AppealKind
  const targetId = Number(params.get('id') || 0)

  const [reason, setReason] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (path !== 'appeal') return null

  const isAccount = kind === 'account'
  const what =
    kind === 'account'
      ? 'your account'
      : kind === 'listing'
        ? 'your rejected listing'
        : kind === 'post'
          ? 'your removed post'
          : 'your removed comment'

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      if (reason.trim().length < 10) {
        setError('Write a sentence or two so the reviewer knows what to look at.')
        return
      }
      if (isAccount) {
        await appealSuspension({ email: email.trim(), password, reason })
      } else if (!targetId) {
        setError('That link is missing the item. Open your listing or post and try again.')
        return
      } else {
        await createAppeal({
          kind,
          reason,
          ...(kind === 'listing' ? { listing: targetId } : {}),
          ...(kind === 'post' ? { post: targetId } : {}),
          ...(kind === 'comment' ? { comment: targetId } : {}),
        })
      }
      setDone(true)
      toast('Appeal sent. A moderator who did not decide this will read it.')
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : 'That appeal could not be sent.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="section">
      <div className="card stack" style={{ gap: 12, maxWidth: 640, margin: '0 auto' }}>
        <div className="row between wrap">
          <b>Appeal a decision</b>
          <button type="button" className="link" onClick={() => navigate('market')}>
            Back to the marketplace
          </button>
        </div>

        {done ? (
          <div className="stack" style={{ gap: 10 }}>
            <p className="small" role="status">
              <Icon name="check" size="sm" /> Your appeal about {what} was sent. A moderator who
              did not make the original decision will review it and you will get a notification with
              their reason, whichever way it goes.
            </p>
          </div>
        ) : (
          <>
            <p className="small muted">
              You are appealing {what}. Say why the decision should be looked at again — the
              reviewer sees your words and the record, nothing else.
            </p>

            {isAccount && (
              <>
                <label className="small" style={{ gap: 4 }}>
                  RTU email
                  <input
                    className="input"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="small" style={{ gap: 4 }}>
                  Password
                  <input
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <p className="tiny muted">
                  A suspended account cannot sign in, so the appeal is filed with the credentials it
                  already has. No session is started.
                </p>
              </>
            )}

            <label className="small" style={{ gap: 4 }}>
              Why should this be reviewed?
              <textarea
                className="input"
                rows={5}
                maxLength={1000}
                value={reason}
                placeholder="The item is a laboratory microscope, not a prohibited device. The photos show the optics."
                onChange={(e) => setReason(e.target.value)}
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
                disabled={busy || !currentAccount && !isAccount}
                onClick={() => void submit()}
              >
                {busy ? 'Sending…' : 'Send the appeal'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
