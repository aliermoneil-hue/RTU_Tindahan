import { useEffect, useState, type ReactNode } from 'react'
import { ScreeningNotice } from '@/common/components/ScreeningNotice'
import { Icon } from '@/common/components/Icon'
import { navigate, useRoute } from '@/common/router/router'
import { REACTS, ago, peso, priceLabel, stamp } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { imgSrc, imgsOf } from '../imageStore'
import type { ForumComment, ForumPost } from '../types'
import { AvatarBadge } from '../components/AvatarBadge'
import './ForumPostPage.css'

function postTitle(f: ForumPost): string {
  const t = String(f.title || '').trim()
  if (t) return t
  const b = String(f.body || '').trim().replace(/\s+/g, ' ')
  return b ? (b.length > 70 ? b.slice(0, 70).trim() + '...' : b) : 'Untitled post'
}

export function ForumPostPage() {
  const { params } = useRoute()
  const {
    db,
    currentAccount,
    isStaffUser,
    selectedPostId,
    highlightedCommentId,
    allOnSale,
    acctByEmail,
    openProduct,
    deleteForumPost,
    toggleForumReaction,
    togglePinPost,
    toggleHidePost,
    addForumComment,
    editForumComment,
    deleteForumComment,
    toggleHideComment,
    openModal,
    toast,
  } = useTindahan()

  const [newComment, setNewComment] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [editCmId, setEditCmId] = useState<string | null>(null)
  const [editCmText, setEditCmText] = useState('')
  const [editCmErr, setEditCmErr] = useState('')
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const [openReactPostId, setOpenReactPostId] = useState<string | null>(null)

  useEffect(() => {
    if (!openMenuKey && !openReactPostId) return
    const onDocClick = () => {
      setOpenMenuKey(null)
      setOpenReactPostId(null)
    }
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
  }, [openMenuKey, openReactPostId])

  if (!currentAccount) return null

  const postId = params.get('id') || selectedPostId
  const f = postId ? db.feed.find((x) => x.id === postId) : undefined
  const fpVisible =
    f && ((!f.hidden && !f.held) || isStaffUser || f.authorEmail === currentAccount.email)

  if (!f || !fpVisible) {
    return (
      <div className="fcol">
        <button
          type="button"
          className="btn ghost sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => navigate('forum')}
        >
          <Icon name="back" size="sm" />
          Back to the forum
        </button>
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
        >
          <span style={{ color: 'var(--blue)' }}>
            <Icon name="info" />
          </span>
          <b>This post is not available</b>
          <p className="small muted">It may have been deleted or hidden by staff.</p>
        </div>
      </div>
    )
  }

  const author = f.authorEmail ? acctByEmail(f.authorEmail) : undefined
  const isStaffPost =
    f.kind === 'notice' || f.kind === 'school' || author?.role === 'moderator'
  const by = f.kind === 'notice' ? 'Office of Student Affairs' : f.by || 'RTU'
  const nrep = isStaffUser
    ? db.freports.filter((r) => r.status === 'open' && r.postId === f.id).length
    : 0
  const mine = f.authorEmail === currentAccount.email
  const reported = db.freports.some(
    (r) =>
      r.type === 'post' &&
      r.postId === f.id &&
      r.reporterEmail === currentAccount.email,
  )
  // A held comment is out of the thread for everyone but its author and
  // staff, exactly like a held post (AI-03).
  const cmLive = (c: ForumComment) =>
    !c.deleted &&
    !c.hidden &&
    (!c.held || isStaffUser || (Boolean(c.email) && c.email === currentAccount.email))
  const nReact = Object.keys(f.reacts || {}).length
  const nCm = (f.comments || []).filter(cmLive).length
  const postMenuKey = `p:${f.id}`
  const postMenuOpen = openMenuKey === postMenuKey

  const liveProd =
    f.pid && allOnSale.some((p) => p.id === f.pid)
      ? allOnSale.find((p) => p.id === f.pid)
      : undefined
  const prodImgs = liveProd ? imgsOf(liveProd) : []
  const postImgs = f.imgs || []
  const bodyStr = String(f.body || '')

  const renderCommentTree = (parent: string | null, depth: number): ReactNode => {
    const children = (f.comments || []).filter((c) => (c.parent || null) === parent)
    if (!children.length) return null
    return children.map((c) => {
      const cMine = c.email === currentAccount.email
      const cAcct = acctByEmail(c.email)
      const cStaff = cAcct?.role === 'moderator'
      const cReported = db.freports.some(
        (r) =>
          r.type === 'comment' &&
          r.commentId === c.id &&
          r.reporterEmail === currentAccount.email,
      )
      const cMenuKey = `c:${c.id}`
      const cMenuOpen = openMenuKey === cMenuKey
      const kids = renderCommentTree(c.id, depth + 1)

      let bubble: ReactNode
      if (c.deleted) {
        bubble = (
          <div className="bubc muted">
            <i>[deleted]</i>
          </div>
        )
      } else if (c.hidden && !isStaffUser) {
        bubble = (
          <div className="bubc muted">
            <i>[removed by moderators]</i>
          </div>
        )
      } else if (editCmId === c.id) {
        bubble = (
          <form
            className="stack"
            style={{ gap: 6 }}
            onSubmit={(e) => {
              e.preventDefault()
              if (!editCmText.trim()) {
                setEditCmErr('A comment cannot be empty.')
                return
              }
              if (editForumComment(f.id, c.id, editCmText)) {
                setEditCmId(null)
                setEditCmText('')
                setEditCmErr('')
              }
            }}
          >
            <textarea
              className="input"
              maxLength={500}
              aria-label="Edit your comment"
              value={editCmText}
              onChange={(e) => {
                setEditCmText(e.target.value)
                setEditCmErr('')
              }}
            />
            {editCmErr && (
              <span className="err" role="alert">
                {editCmErr}
              </span>
            )}
            <div className="row" style={{ gap: 6 }}>
              <button type="submit" className="btn sm">
                Save
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setEditCmId(null)
                  setEditCmErr('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )
      } else {
        bubble = (
          <div className="bubc">
            <b>
              {c.by}
              {cStaff && (
                <>
                  {' '}
                  <span className="pill navy">Staff</span>
                </>
              )}
              {c.hidden && (
                <>
                  {' '}
                  <span className="pill red">Hidden</span>
                </>
              )}
              {c.held && (
                <>
                  {' '}
                  <span className="pill red">Held for review</span>
                  {isStaffUser && c.screening?.reasons?.length ? (
                    <span className="tiny muted" title={c.screening.reasons.join(' ')}>
                      {' '}
                      {c.screening.reasons[0]}
                    </span>
                  ) : null}
                </>
              )}
            </b>
            {c.text}
          </div>
        )
      }

      return (
        <div
          key={c.id}
          className={`fcm ${highlightedCommentId === c.id ? 'hl' : ''}`.trim()}
          id={`c-${c.id}`}
        >
          <AvatarBadge
            account={c.deleted ? undefined : cAcct}
            name={c.deleted ? '?' : c.by}
            isStaff={cStaff}
            size="sm"
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="cm-row">
              <div className="cm-main">{bubble}</div>
              {!c.deleted && (
                <div className="amenu-wrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="iconbtn amenu-btn"
                    aria-haspopup="menu"
                    aria-expanded={cMenuOpen}
                    aria-label="More actions for this comment"
                    title="More actions"
                    onClick={() =>
                      setOpenMenuKey((cur) => (cur === cMenuKey ? null : cMenuKey))
                    }
                  >
                    <Icon name="dots" size="sm" />
                  </button>
                  {cMenuOpen && (
                    <div className="amenu" role="menu">
                      {cMine && !c.hidden && (
                        <button
                          type="button"
                          role="menuitem"
                          className="amenu-item"
                          onClick={() => {
                            setOpenMenuKey(null)
                            setEditCmId(c.id)
                            setEditCmText(c.text)
                            setEditCmErr('')
                          }}
                        >
                          <Icon name="edit" size="sm" />
                          <span>Edit comment</span>
                        </button>
                      )}
                      {!cMine && (
                        <button
                          type="button"
                          role="menuitem"
                          className="amenu-item"
                          disabled={cReported}
                          onClick={() => {
                            setOpenMenuKey(null)
                            openModal({
                              kind: 'forum-report',
                              postId: f.id,
                              commentId: c.id,
                            })
                          }}
                        >
                          <Icon name="flag" size="sm" />
                          <span>{cReported ? 'Reported' : 'Report comment'}</span>
                        </button>
                      )}
                      {isStaffUser && (
                        <button
                          type="button"
                          role="menuitem"
                          className="amenu-item"
                          onClick={() => {
                            setOpenMenuKey(null)
                            toggleHideComment(f.id, c.id)
                          }}
                        >
                          <Icon name="eye" size="sm" />
                          <span>{c.hidden ? 'Restore comment' : c.held ? 'Release comment' : 'Hide comment'}</span>
                        </button>
                      )}
                      {(cMine || isStaffUser) && (
                        <button
                          type="button"
                          role="menuitem"
                          className="amenu-item danger"
                          onClick={() => {
                            setOpenMenuKey(null)
                            deleteForumComment(f.id, c.id)
                          }}
                        >
                          <Icon name="trash" size="sm" />
                          <span>Delete comment</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!c.deleted && (
              <div className="tiny muted fcm-acts" title={ago(c.ts)}>
                {stamp(c.ts)}
                {c.edited && (
                  <>
                    {' '}
                    ·{' '}
                    <span className="edited-tag" title={`Edited ${stamp(c.edited)}`}>
                      edited
                    </span>
                  </>
                )}
                {!c.hidden && !c.held && depth < 5 && (
                  <>
                    {' '}
                    ·{' '}
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setReplyToId((cur) => (cur === c.id ? null : c.id))
                        setReplyText('')
                      }}
                    >
                      Reply
                    </button>
                  </>
                )}
              </div>
            )}

            {replyToId === c.id && (
              <form
                className="row"
                style={{ gap: 8, marginTop: 6 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  if (addForumComment(f.id, c.id, replyText)) {
                    setReplyText('')
                    setReplyToId(null)
                  }
                }}
              >
                <input
                  className="input"
                  value={replyText}
                  placeholder={`Reply to ${c.by}...`}
                  maxLength={500}
                  aria-label="Write a reply"
                  autoComplete="off"
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <button type="submit" className="btn sm" aria-label="Post reply">
                  <Icon name="send" size="sm" />
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    setReplyToId(null)
                    setReplyText('')
                  }}
                >
                  Cancel
                </button>
              </form>
            )}

            {kids && (
              <div className={`cthread ${depth >= 3 ? 'flat' : ''}`.trim()}>
                {kids}
              </div>
            )}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="fcol">
      <button
        type="button"
        className="btn ghost sm"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => navigate('forum')}
      >
        <Icon name="back" size="sm" />
        Back to the forum
      </button>

      <article
        className={`card stack fpost ${f.pinned ? 'pinned' : ''} ${
          f.hidden || f.held ? 'is-hidden' : ''
        }`.trim()}
        id={`post-${f.id}`}
      >
        <div className="fpost-top">
          <div className="fhead">
            <AvatarBadge
              account={f.kind !== 'notice' ? author : undefined}
              name={by}
              isStaff={isStaffPost}
              size="md"
            />
            <div className="grow">
              <div className="row wrap" style={{ gap: 6 }}>
                <b style={{ fontSize: 14 }}>{by}</b>
                {isStaffPost && <span className="pill navy">Staff</span>}
                {f.kind === 'notice' && <span className="pill yellow">Notice</span>}
                {(f.kind === 'student' || f.kind === 'school') && (
                  <span className={`srcpill ${f.kind}`}>
                    {f.kind === 'school' ? 'Official RTU Store' : 'Student seller'}
                  </span>
                )}
                {f.topic && f.kind === 'post' && <span className="pill">{f.topic}</span>}
                {f.pinned && <span className="pill yellow">Pinned</span>}
                {f.hidden && <span className="pill red">Hidden by staff</span>}
                {f.held && <span className="pill red">Held for review</span>}
                {nrep > 0 && (
                  <button
                    type="button"
                    className="pill red linkpill"
                    title="Open Forum Reports"
                    onClick={() => navigate('forum-reports')}
                  >
                    {nrep} open report{nrep === 1 ? '' : 's'}
                  </button>
                )}
              </div>
              <div className="tiny muted" title={ago(f.ts)}>
                {stamp(f.ts)} · {ago(f.ts)}
                {f.edited && (
                  <>
                    {' '}
                    ·{' '}
                    <span className="edited-tag" title={`Edited ${stamp(f.edited)}`}>
                      edited
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="amenu-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="iconbtn amenu-btn"
                aria-haspopup="menu"
                aria-expanded={postMenuOpen}
                aria-label="More actions for this post"
                title="More actions"
                onClick={() =>
                  setOpenMenuKey((cur) => (cur === postMenuKey ? null : postMenuKey))
                }
              >
                <Icon name="dots" size="sm" />
              </button>
              {postMenuOpen && (
                <div className="amenu" role="menu">
                  {mine && f.kind === 'post' && !f.hidden && (
                    <button
                      type="button"
                      role="menuitem"
                      className="amenu-item"
                      onClick={() => {
                        setOpenMenuKey(null)
                        openModal({ kind: 'forum-edit-post', postId: f.id })
                      }}
                    >
                      <Icon name="edit" size="sm" />
                      <span>Edit post</span>
                    </button>
                  )}
                  {!mine && f.kind !== 'notice' && (
                    <button
                      type="button"
                      role="menuitem"
                      className="amenu-item"
                      disabled={reported}
                      onClick={() => {
                        setOpenMenuKey(null)
                        openModal({
                          kind: 'forum-report',
                          postId: f.id,
                          commentId: null,
                        })
                      }}
                    >
                      <Icon name="flag" size="sm" />
                      <span>{reported ? 'Reported' : 'Report post'}</span>
                    </button>
                  )}
                  {isStaffUser && (
                    <button
                      type="button"
                      role="menuitem"
                      className="amenu-item"
                      onClick={() => {
                        setOpenMenuKey(null)
                        togglePinPost(f.id)
                      }}
                    >
                      <Icon name="pin" size="sm" />
                      <span>{f.pinned ? 'Unpin post' : 'Pin post'}</span>
                    </button>
                  )}
                  {isStaffUser && (
                    <button
                      type="button"
                      role="menuitem"
                      className="amenu-item"
                      onClick={() => {
                        setOpenMenuKey(null)
                        toggleHidePost(f.id)
                      }}
                    >
                      <Icon name="eye" size="sm" />
                      <span>{f.hidden ? 'Restore post' : f.held ? 'Release post' : 'Hide post'}</span>
                    </button>
                  )}
                  {(mine || isStaffUser) && (
                    <button
                      type="button"
                      role="menuitem"
                      className="amenu-item danger"
                      onClick={() => {
                        setOpenMenuKey(null)
                        deleteForumPost(f.id)
                      }}
                    >
                      <Icon name="trash" size="sm" />
                      <span>Delete post</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {f.hidden && (
            <div
              className="note"
              role="status"
              style={{ background: 'var(--red-bg)', borderColor: 'transparent' }}
            >
              <Icon name="info" />
              <span>
                {isStaffUser
                  ? 'This post is hidden from members.'
                  : 'Staff hid this post. Only you and staff can see it.'}
              </span>
            </div>
          )}

          {f.kind === 'student' || f.kind === 'school' ? (
            <div className="fprod">
              {prodImgs.length > 0 && imgSrc(prodImgs[0]) && (
                <img
                  className="fprod-img"
                  src={imgSrc(prodImgs[0])}
                  alt={f.title || ''}
                />
              )}
              <div className="grow" style={{ minWidth: 180 }}>
                <b>
                  {f.svc ? 'New service: ' : 'New: '}
                  {f.title}
                </b>
                <div className="small muted" style={{ overflowWrap: 'anywhere' }}>
                  {bodyStr.length > 200 ? bodyStr.slice(0, 200) + '...' : bodyStr}
                </div>
                <div className="small tnum" style={{ marginTop: 2 }}>
                  {liveProd ? priceLabel(liveProd) : peso(f.price || 0)}
                  {f.tag ? ` · ${f.tag}` : ''}
                </div>
              </div>
              {liveProd ? (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => openProduct(liveProd.id)}
                >
                  View {f.svc ? 'service' : 'listing'}
                </button>
              ) : (
                <span className="pill">No longer available</span>
              )}
            </div>
          ) : (
            <>
              <h1 className="ptitle">{postTitle(f)}</h1>
              {!(
                f.kind === 'post' &&
                !String(f.title || '').trim() &&
                bodyStr.length <= 70
              ) && <div className="fbody full">{bodyStr}</div>}
            </>
          )}

          {postImgs.length > 0 && (
            <div className={`fimgs n${Math.min(postImgs.length, 4)} full`}>
              {postImgs.map((id, idx) => {
                const src = imgSrc(id)
                if (!src) {
                  return (
                    <div key={`${id}-${idx}`} className="fimg-miss">
                      <Icon name="info" size="sm" />
                      <span>Image unavailable</span>
                    </div>
                  )
                }
                return (
                  <button
                    key={`${id}-${idx}`}
                    type="button"
                    className="fimg"
                    aria-label={`Open photo ${idx + 1} of ${postImgs.length}`}
                    onClick={() =>
                      openModal({ kind: 'forum-photo', postId: f.id, index: idx })
                    }
                  >
                    <img
                      src={src}
                      alt={`Photo ${idx + 1} attached to the post ${postTitle(f)}`}
                      loading="lazy"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="fpost-foot">
          <div className="fact-group">
            <div className="freact-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`fact-btn ${f.reacts[currentAccount.email] ? 'on' : ''}`}
                aria-pressed={Boolean(f.reacts[currentAccount.email])}
                aria-label={`React: ${f.reacts[currentAccount.email] || 'React'}`}
                title={f.reacts[currentAccount.email] || 'React'}
                onClick={() => {
                  setOpenMenuKey(null)
                  setOpenReactPostId((cur) => (cur === f.id ? null : f.id))
                }}
              >
                <span>
                  {f.reacts[currentAccount.email]
                    ? REACTS.find((r) => r[0] === f.reacts[currentAccount.email])?.[1] ||
                      REACTS[0][1]
                    : REACTS[0][1]}
                </span>{' '}
                {nReact > 0 ? `${nReact}` : 'React'}
              </button>
              {openReactPostId === f.id && (
                <div className="freact-tray" role="menu">
                  {REACTS.map((r) => {
                    const already = f.reacts[currentAccount.email] === r[0]
                    return (
                      <button
                        key={r[0]}
                        type="button"
                        className={`freact-pick ${already ? 'on' : ''}`}
                        aria-pressed={already}
                        aria-label={r[2]}
                        title={r[2]}
                        onClick={() => {
                          toggleForumReaction(f.id, r[0])
                          setOpenReactPostId(null)
                        }}
                      >
                        {r[1]}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              className="fact-btn"
              aria-label="Comment"
              title="Comment"
              onClick={() => {
                setOpenMenuKey(null)
                setOpenReactPostId(null)
                navigate('forum')
              }}
            >
              <Icon name="msg" size="sm" />{' '}
              {nCm > 0 ? `${nCm}` : 'Comment'}
            </button>

            <button
              type="button"
              className="fact-btn"
              aria-label="Share post"
              title="Share post"
              onClick={() => {
                setOpenMenuKey(null)
                setOpenReactPostId(null)
                const url = `${window.location.origin}${window.location.pathname}?id=${f.id}`
                navigator.clipboard?.writeText(url).then(() => {
                  toast('Post link copied.')
                })
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6c-2.8 0-4.2 0-4.8 0C1 2 0 3 0 5v15c0 2 1 4 4 4h13c3 0 4 0 5-1 1-1 1-2 1-4V6c0-2-1-3-4-3zM19 5l-4 4-4-4"/>
              </svg>{' '}
              Share
            </button>
          </div>

          <div className="freact-stack">
            {Object.entries(
              Object.values(f.reacts || {}).reduce<Record<string, number>>((acc, key) => {
                acc[key] = (acc[key] ?? 0) + 1
                return acc
              }, {}),
            )
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([emoji, count]) => {
                const label =
                  REACTS.find((r) => r[0] === emoji)?.[2] || emoji
                return (
                  <span
                    key={emoji}
                    className="freact-badge"
                    title={`${label} (${count})`}
                    aria-hidden="true"
                  >
                    {emoji}
                  </span>
                )
              })}
          </div>
        </div>
      </article>

      <section className="card stack" aria-label="Comments" style={{ gap: 12 }}>
        <b>
          Comments <span className="tiny muted tnum">({nCm})</span>
        </b>
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault()
            if (addForumComment(f.id, null, newComment)) {
              setNewComment('')
            }
          }}
        >
          <AvatarBadge account={currentAccount} size="sm" />
          <input
            className="input"
            id={`cm-${f.id}`}
            value={newComment}
            placeholder="Add a comment..."
            maxLength={500}
            aria-label="Add a comment"
            autoComplete="off"
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button type="submit" className="btn sm" aria-label="Post comment">
            <Icon name="send" size="sm" />
          </button>
        </form>
        <ScreeningNotice />

        {(f.comments || []).some((c) => !c.parent) ? (
          renderCommentTree(null, 0)
        ) : (
          <p className="small muted">No comments yet. Start the discussion.</p>
        )}
      </section>
    </div>
  )
}
