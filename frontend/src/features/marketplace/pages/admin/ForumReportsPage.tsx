import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { FR_ACTIONS, reportStatusLabel, stamp } from '../../constants'
import { fetchMemberHistory, type ApiMemberHistory } from '../../api/forum'
import { useTindahan } from '../../context/TindahanContext'
import type { ForumPost } from '../../types'
import './ForumReportsPage.css'

// RM-02: three statuses, and the outcome read beside them.
const FR_TABS: ['received' | 'under_review' | 'resolved' | 'all', string][] = [
  ['received', 'Received'],
  ['under_review', 'Under Review'],
  ['resolved', 'Resolved'],
  ['all', 'All'],
]

function postTitle(f: ForumPost): string {
  const t = String(f.title || '').trim()
  if (t) return t
  const b = String(f.body || '').trim().replace(/\s+/g, ' ')
  return b ? (b.length > 70 ? b.slice(0, 70).trim() + '...' : b) : 'Untitled post'
}

/**
 * RM-06: what this member has been reported for before, and what staff did.
 *
 * It is fetched when opened rather than with the queue, so a moderator reading
 * the row in front of them is not handed every member's history at once.
 */
function MemberHistoryPanel({ email }: { email: string }) {
  const [data, setData] = useState<ApiMemberHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    fetchMemberHistory(email)
      .then((body) => {
        if (alive) setData(body)
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'That history could not be read.')
      })
    return () => {
      alive = false
    }
  }, [email])

  if (error) {
    return (
      <p className="small" role="alert" style={{ margin: 0, color: 'var(--red)' }}>
        {error}
      </p>
    )
  }
  if (!data) return <p className="small muted" style={{ margin: 0 }}>Reading history…</p>

  const { counts } = data
  return (
    <div className="stack" style={{ gap: 8, padding: 10, background: 'var(--soft)', borderRadius: 8 }}>
      <div className="row between wrap" style={{ gap: 6 }}>
        <b className="small">{data.member.name} ({data.member.email})</b>
        <span className="row wrap" style={{ gap: 6 }}>
          <span className="pill">{counts.reports} report{counts.reports === 1 ? '' : 's'}</span>
          {counts.unresolved > 0 && <span className="pill red">{counts.unresolved} open</span>}
          {counts.actioned > 0 && <span className="pill navy">{counts.actioned} actioned</span>}
          {counts.dismissed > 0 && <span className="pill">{counts.dismissed} dismissed</span>}
        </span>
      </div>

      {data.reports.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>No past reports against this member.</p>
      ) : (
        <ul className="stack small" style={{ gap: 4, margin: 0, paddingLeft: 16 }}>
          {data.reports.map((row) => (
            <li key={row.id}>
              <b>{row.reason}</b> · {row.type} · {reportStatusLabel(row.status, row.resolution)} ·{' '}
              {stamp(row.created_at)}
              {row.handled_by_name ? ` · by ${row.handled_by_name}` : ''}
              {row.note ? ` · ${row.note}` : ''}
            </li>
          ))}
        </ul>
      )}

      {data.actions.length > 0 && (
        <div className="stack" style={{ gap: 2 }}>
          <span className="tiny muted">ACTIONS ON RECORD</span>
          <ul className="stack tiny" style={{ gap: 2, margin: 0, paddingLeft: 16 }}>
            {data.actions.map((row, index) => (
              <li key={`${row.created_at}-${index}`}>
                {row.action} · {row.target_type} · by {row.by} · {stamp(row.created_at)}
                {row.note ? ` · ${row.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ForumReportsPage() {
  const {
    db,
    isStaffUser,
    openPost,
    setForumReportStatus,
    openModal,
    toggleHidePost,
    deleteForumPost,
    toggleHideComment,
    deleteForumComment,
  } = useTindahan()

  const [frTab, setFrTab] = useState<'received' | 'under_review' | 'resolved' | 'all'>('received')
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  if (!isStaffUser) {
    return (
      <div className="card stack">
        <b>This page is for RTU staff accounts only.</b>
      </div>
    )
  }

  const tabs = FR_TABS

  const cnt = (k: string) =>
    db.freports.filter((r) => k === 'all' || r.status === k).length
  const list = db.freports.filter((r) => frTab === 'all' || r.status === frTab)
  // Screening holds a post before anyone reports it, so these rows have no
  // report behind them: the queue has to read the feed itself (AI-03).
  const held = db.feed.filter((f) => f.held)
  const heldComments = db.feed.flatMap((f) =>
    (f.comments || [])
      .filter((c) => c.held && !c.deleted)
      .map((c) => ({ post: f, comment: c })),
  )

  return (
    <div className="fcol wide">
      <div>
        <span className="eyebrow">STAFF · MEMBER & FORUM REPORTS</span>
        <h1>Member, Order & Forum Reports</h1>
        <p className="muted small">
          Reports sent by buyers and sellers about meetup/order problems (such as no-shows) as well
          as reported forum posts and comments.
        </p>
      </div>

      <div className="tabs" role="tablist" aria-label="Report status">
        {tabs.map((t) => (
          <button
            key={t[0]}
            type="button"
            className={`tab ${frTab === t[0] ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={frTab === t[0]}
            onClick={() => setFrTab(t[0])}
          >
            {t[1]} <span className="tnum">({cnt(t[0])})</span>
          </button>
        ))}
      </div>

      {held.length ? (
        <section className="card stack" style={{ gap: 10 }} aria-label="Held by screening">
          <div className="row between wrap" style={{ gap: 8 }}>
            <b>Held by screening ({held.length})</b>
            <span className="tiny muted">
              Automatic screening held these. Nobody else can see them until a moderator releases
              or deletes them.
            </span>
          </div>
          {held.map((f) => (
            <div key={f.id} className="card stack" style={{ gap: 6, padding: 10 }}>
              <div className="row between wrap" style={{ gap: 8 }}>
                <div className="row wrap grow" style={{ gap: 6 }}>
                  <span className="pill red">Held</span>
                  <b>{postTitle(f)}</b>
                  <span className="tiny muted">
                    by {f.by} · {stamp(f.ts)}
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn ghost sm" onClick={() => openPost(f.id)}>
                    Open
                  </button>
                  <button type="button" className="btn sm" onClick={() => toggleHidePost(f.id)}>
                    Release
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => deleteForumPost(f.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {f.screening?.reasons?.length ? (
                <p className="small muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                  {f.screening.reasons.join(' ')}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {heldComments.length ? (
        <section className="card stack" style={{ gap: 10 }} aria-label="Held comments">
          <div className="row between wrap" style={{ gap: 8 }}>
            <b>Held comments ({heldComments.length})</b>
            <span className="tiny muted">
              Held by automatic screening. Out of the thread until a moderator releases them.
            </span>
          </div>
          {heldComments.map(({ post, comment }) => (
            <div key={comment.id} className="card stack" style={{ gap: 6, padding: 10 }}>
              <div className="row between wrap" style={{ gap: 8 }}>
                <div className="row wrap grow" style={{ gap: 6 }}>
                  <span className="pill red">Held</span>
                  <b style={{ overflowWrap: 'anywhere' }}>{comment.text.slice(0, 120)}</b>
                  <span className="tiny muted">
                    by {comment.by} on "{postTitle(post)}" · {stamp(comment.ts)}
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn ghost sm" onClick={() => openPost(post.id)}>
                    Open
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => toggleHideComment(post.id, comment.id)}
                  >
                    Release
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => deleteForumComment(post.id, comment.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {comment.screening?.reasons?.length ? (
                <p className="small muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                  {comment.screening.reasons.join(' ')}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {list.length ? (
        list.map((r) => {
          const f = db.feed.find((x) => x.id === r.postId)
          const c = f && r.commentId ? f.comments.find((x) => x.id === r.commentId) : undefined
          const gone = !f || (Boolean(r.commentId) && (!c || c.deleted))
          const live = gone ? null : c || f
          const text = gone ? r.snap.text : c ? c.text : f?.body || r.snap.text

          return (
            <article
              key={r.id}
              className="card stack frcard"
              id={`rep-${r.id}`}
              style={{ gap: 10 }}
            >
              <div className="row between wrap" style={{ gap: 8 }}>
                <div className="row wrap" style={{ gap: 6 }}>
                  <span
                    className={`pill ${
                      r.status === 'received'
                        ? 'red'
                        : r.status === 'under_review'
                          ? 'yellow'
                          : 'navy'
                    }`.trim()}
                  >
                    {reportStatusLabel(r.status, r.resolution)}
                  </span>
                  <span className={`pill ${r.type === 'order' ? 'yellow' : ''}`.trim()}>
                    {r.type === 'order'
                      ? `Order Report (${r.reporterRole === 'seller' ? 'Seller → Buyer' : 'Buyer → Seller'})`
                      : r.type === 'post'
                        ? 'Post'
                        : r.type === 'listing'
                          ? 'Listing'
                          : r.type === 'user'
                            ? 'Member'
                            : r.type === 'review'
                              ? 'Review'
                              : 'Comment'}
                  </span>
                  <b>{r.reason}</b>
                </div>
                <span className="tiny muted">{stamp(r.ts)}</span>
              </div>

              {r.details && (
                <p className="small" style={{ overflowWrap: 'anywhere' }}>
                  {r.details}
                </p>
              )}

              <div className="frquote">
                <div className="tiny muted">
                  {r.type === 'order'
                    ? `Transaction / Meetup Report · ${r.snap.title}`
                    : r.type === 'listing'
                      ? 'Reported listing'
                      : r.type === 'user'
                        ? 'Reported member'
                        : r.type === 'review'
                          ? 'Reported review'
                        : `Reported ${r.type}${r.type === 'comment' ? ` on the post "${r.snap.title}"` : ''}${
                        gone
                          ? ' (no longer exists, copy saved when reported)'
                          : live && live.hidden
                            ? ' (currently hidden)'
                            : ''
                      }`}
                </div>
                {(r.type === 'post' ||
                  r.type === 'order' ||
                  r.type === 'listing' ||
                  r.type === 'user' ||
                  r.type === 'review') && (
                  <b>{r.type === 'order' ? r.snap.title : f ? postTitle(f) : r.snap.title}</b>
                )}
                <div
                  className="small"
                  style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                >
                  {String(text || '').slice(0, 400) || <i>No text</i>}
                </div>
                {r.snap.imgs > 0 && (
                  <div className="tiny muted">
                    {r.snap.imgs} photo{r.snap.imgs === 1 ? '' : 's'} attached
                  </div>
                )}
              </div>

              <div className="frmeta">
                <div>
                  <span className="tiny muted">REPORTED BY</span>
                  <br />
                  {r.reporterName}
                  <br />
                  <span className="tiny muted">{r.reporterEmail}</span>
                </div>
                <div>
                  <span className="tiny muted">REPORTED USER</span>
                  <br />
                  {r.targetName}
                  {r.targetEmail && (
                    <>
                      <br />
                      <span className="tiny muted">{r.targetEmail}</span>
                    </>
                  )}
                </div>
                <div>
                  <span className="tiny muted">SUBMITTED</span>
                  <br />
                  {stamp(r.ts)}
                </div>
                <div>
                  <span className="tiny muted">STATUS</span>
                  <br />
                  {reportStatusLabel(r.status, r.resolution)}
                  {r.handledBy && (
                    <>
                      <br />
                      <span className="tiny muted">
                        by {r.handledBy}
                        {r.handledAt ? `, ${stamp(r.handledAt)}` : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {r.action ? (
                <div className="small">
                  <b>Action:</b> {FR_ACTIONS[r.action] ? FR_ACTIONS[r.action][0] : r.action}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
              ) : (
                r.note && (
                  <div className="small">
                    <b>Note:</b> {r.note}
                  </div>
                )
              )}

              {/* RM-06: the pattern behind this one report, read on demand. */}
              {historyFor && historyFor === r.targetEmail && (
                <MemberHistoryPanel email={historyFor} />
              )}

              <div className="row wrap" style={{ gap: 6 }}>
                {r.type === 'order' ? (
                  r.targetEmail ? (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => openModal({ kind: 'admin-user', email: r.targetEmail! })}
                    >
                      Manage reported account ({r.targetName})
                    </button>
                  ) : null
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={gone}
                      onClick={() => openPost(r.postId, r.commentId)}
                    >
                      Open content
                    </button>
                    {r.targetEmail && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        aria-expanded={historyFor === r.targetEmail}
                        onClick={() =>
                          setHistoryFor(historyFor === r.targetEmail ? null : r.targetEmail)
                        }
                      >
                        {historyFor === r.targetEmail ? 'Hide history' : 'Member history'}
                      </button>
                    )}
                  </>
                )}
                {r.status === 'received' && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setForumReportStatus(r.id, 'under_review')}
                  >
                    Start review
                  </button>
                )}
                {r.status !== 'resolved' ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setForumReportStatus(r.id, 'resolved', 'dismissed')}
                  >
                    Resolve, no action
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setForumReportStatus(r.id, 'received')}
                  >
                    Reopen
                  </button>
                )}
                {r.type !== 'order' && (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() =>
                      openModal({ kind: 'forum-mod-action', reportId: r.id })
                    }
                  >
                    Take moderation action
                  </button>
                )}
              </div>
            </article>
          )
        })
      ) : (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 36 }}
        >
          <span style={{ color: 'var(--blue)' }}>
            <Icon name="check" />
          </span>
          <b>{frTab === 'received' ? 'No new reports' : 'No reports here'}</b>
          <p className="small muted">Reports from members will appear in this list.</p>
        </div>
      )}

      <section className="card stack" style={{ gap: 8 }}>
        <b>
          Moderation log <span className="tiny muted tnum">({db.modlog.length})</span>
        </b>
        {db.modlog.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Staff</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {db.modlog.slice(0, 25).map((m) => (
                  <tr key={m.id}>
                    <td className="tnum">{stamp(m.ts)}</td>
                    <td>{m.by}</td>
                    <td>{m.kind}</td>
                    <td>
                      {m.type} by {m.targetName || 'unknown'}
                    </td>
                    <td>
                      {m.outcome || ''}
                      {m.note ? ` · ${m.note}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">No moderation actions yet.</p>
        )}
      </section>
    </div>
  )
}
