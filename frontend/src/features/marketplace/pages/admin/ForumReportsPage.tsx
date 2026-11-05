import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { FR_ACTIONS, stamp } from '../../constants'
import { useTindahan } from '../../context/TindahanContext'
import type { ForumPost } from '../../types'
import './ForumReportsPage.css'

const FR_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  dismissed: 'Dismissed',
  actioned: 'Action taken',
}

function postTitle(f: ForumPost): string {
  const t = String(f.title || '').trim()
  if (t) return t
  const b = String(f.body || '').trim().replace(/\s+/g, ' ')
  return b ? (b.length > 70 ? b.slice(0, 70).trim() + '...' : b) : 'Untitled post'
}

export function ForumReportsPage() {
  const {
    db,
    isStaffUser,
    openPost,
    setForumReportStatus,
    openModal,
  } = useTindahan()

  const [frTab, setFrTab] = useState<'open' | 'reviewed' | 'dismissed' | 'actioned' | 'all'>('open')

  if (!isStaffUser) {
    return (
      <div className="card stack">
        <b>This page is for RTU staff accounts only.</b>
      </div>
    )
  }

  const tabs: ['open' | 'reviewed' | 'dismissed' | 'actioned' | 'all', string][] = [
    ['open', 'Open'],
    ['reviewed', 'Reviewed'],
    ['dismissed', 'Dismissed'],
    ['actioned', 'Action taken'],
    ['all', 'All'],
  ]

  const cnt = (k: string) =>
    db.freports.filter((r) => k === 'all' || r.status === k).length
  const list = db.freports.filter((r) => frTab === 'all' || r.status === frTab)

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
                      r.status === 'open'
                        ? 'red'
                        : r.status === 'actioned'
                          ? 'navy'
                          : ''
                    }`.trim()}
                  >
                    {FR_STATUS_LABELS[r.status] || r.status}
                  </span>
                  <span className={`pill ${r.type === 'order' ? 'yellow' : ''}`.trim()}>
                    {r.type === 'order'
                      ? `Order Report (${r.reporterRole === 'seller' ? 'Seller → Buyer' : 'Buyer → Seller'})`
                      : r.type === 'post'
                        ? 'Post'
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
                    : `Reported ${r.type}${r.type === 'comment' ? ` on the post "${r.snap.title}"` : ''}${
                        gone
                          ? ' (no longer exists, copy saved when reported)'
                          : live && live.hidden
                            ? ' (currently hidden)'
                            : ''
                      }`}
                </div>
                {(r.type === 'post' || r.type === 'order') && (
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
                  {FR_STATUS_LABELS[r.status] || r.status}
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
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={gone}
                    onClick={() => openPost(r.postId, r.commentId)}
                  >
                    Open content
                  </button>
                )}
                {r.status === 'open' ? (
                  <>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setForumReportStatus(r.id, 'reviewed')}
                    >
                      Mark reviewed
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setForumReportStatus(r.id, 'dismissed')}
                    >
                      Dismiss report
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setForumReportStatus(r.id, 'open')}
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
          <b>{frTab === 'open' ? 'No open reports' : 'No reports here'}</b>
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
