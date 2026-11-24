import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { REACTS, TOPICS, ago, peso, priceLabel, stamp } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { IMG_RULES, imgSrc, imgsOf } from '../imageStore'
import type { ForumPost } from '../types'
import { AvatarBadge } from '../components/AvatarBadge'
import { PhotoUploader } from '../components/PhotoUploader'
import './ForumPage.css'

function postTitle(f: ForumPost): string {
  const t = String(f.title || '').trim()
  if (t) return t
  const b = String(f.body || '').trim().replace(/\s+/g, ' ')
  return b ? (b.length > 70 ? b.slice(0, 70).trim() + '...' : b) : 'Untitled post'
}

export function ForumPage() {
  const {
    db,
    currentAccount,
    isStaffUser,
    allOnSale,
    acctByEmail,
    openProduct,
    openPost,
    createForumPost,
    deleteForumPost,
    toggleForumReaction,
    togglePinPost,
    toggleHidePost,
    openModal,
  } = useTindahan()

  const [forumTab, setForumTab] = useState<'all' | 'post' | 'listing' | 'notice'>('all')
  const [forumSort, setForumSort] = useState<'latest' | 'popular'>('latest')
  const [fpLimit, setFpLimit] = useState(10)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState<string>(TOPICS[0])
  const [asNotice, setAsNotice] = useState(false)
  const [imgs, setImgs] = useState<string[]>([])
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)

  useEffect(() => {
    if (!openMenuKey) return
    const onDocClick = () => setOpenMenuKey(null)
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
  }, [openMenuKey])

  if (!currentAccount) return null

  const fpVisible = (f: ForumPost) =>
    (!f.hidden && !f.held) || isStaffUser || f.authorEmail === currentAccount.email
  const cmLive = (c: { deleted?: boolean; hidden?: unknown }) => !c.deleted && !c.hidden
  const cmCount = (f: ForumPost) => (f.comments || []).filter(cmLive).length
  const popScore = (f: ForumPost) => Object.keys(f.reacts || {}).length + cmCount(f)

  const inTab = (f: ForumPost, k: 'all' | 'post' | 'listing' | 'notice') =>
    k === 'all' ||
    (k === 'post'
      ? f.kind === 'post'
      : k === 'listing'
        ? f.kind === 'student' || f.kind === 'school'
        : f.kind === 'notice')

  const vis = db.feed.filter(fpVisible)
  const list = vis
    .filter((f) => inTab(f, forumTab))
    .sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        (forumSort === 'popular' ? popScore(b) - popScore(a) : 0) ||
        String(b.ts).localeCompare(String(a.ts)),
    )
  const shown = list.slice(0, fpLimit)
  const nOpenReports = isStaffUser
    ? db.freports.filter((r) => r.status === 'open').length
    : 0
  const notice = isStaffUser && asNotice

  const tabs: ['all' | 'post' | 'listing' | 'notice', string][] = [
    ['all', 'All posts'],
    ['post', 'Discussions'],
    ['listing', 'New listings'],
    ['notice', 'Notices'],
  ]

  return (
    <div className="fcol">
      <div>
        <span className="eyebrow">COMMUNITY · FORUM</span>
        <h1>Campus forum</h1>
        <p className="muted small">
          Ask questions, share tips and talk with other RTU Pasig students. Open a post to read it
          all and join the discussion.
        </p>
      </div>

      {nOpenReports > 0 && (
        <div
          className="note"
          role="status"
          style={{ background: 'var(--red-bg)', borderColor: 'transparent' }}
        >
          <Icon name="flag" />
          <span>
            <b>
              {nOpenReports} forum report{nOpenReports === 1 ? ' is' : 's are'} waiting.
            </b>{' '}
            <button
              type="button"
              className="link"
              onClick={() => navigate('forum-reports')}
            >
              Open Forum Reports
            </button>
          </span>
        </div>
      )}

      <form
        className="card stack"
        style={{ gap: 10 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (createForumPost(title, body, topic, notice, imgs)) {
            setTitle('')
            setBody('')
            setImgs([])
            setAsNotice(false)
            setForumSort('latest')
          }
        }}
      >
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <AvatarBadge account={currentAccount} isStaff={isStaffUser} size="md" />
          <div className="stack grow" style={{ gap: 8, minWidth: 0 }}>
            <input
              className="input"
              id="fp-title"
              maxLength={120}
              value={title}
              placeholder={notice ? 'Notice title' : 'Title (optional)'}
              aria-label={notice ? 'Notice title' : 'Post title'}
              autoComplete="off"
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="input"
              id="fp-text"
              maxLength={2000}
              placeholder={`What is on your mind, ${currentAccount.first}?`}
              aria-label="Write a post"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>

        <PhotoUploader
          ids={imgs}
          max={IMG_RULES.post}
          label="Photos (optional)"
          onChange={setImgs}
        />

        <div className="row between wrap">
          <span className="row wrap" style={{ gap: 10 }}>
            <label className="row small" style={{ gap: 6 }}>
              Topic{' '}
              <select
                className="input"
                id="fp-topic"
                style={{ width: 'auto' }}
                disabled={notice}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {isStaffUser && (
              <label className="check">
                <input
                  type="checkbox"
                  id="fp-notice"
                  checked={asNotice}
                  onChange={(e) => setAsNotice(e.target.checked)}
                />
                Official notice (alerts every member)
              </label>
            )}
          </span>
          <button type="submit" className="btn yellow">
            <Icon name="send" size="sm" />
            {notice ? 'Post notice' : 'Post'}
          </button>
        </div>
      </form>

      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="tabs" role="tablist" aria-label="Forum filter">
          {tabs.map((t) => (
            <button
              key={t[0]}
              type="button"
              className={`tab ${forumTab === t[0] ? 'on' : ''}`.trim()}
              role="tab"
              aria-selected={forumTab === t[0]}
              onClick={() => setForumTab(t[0])}
            >
              {t[1]}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 6 }} role="group" aria-label="Sort posts">
          <button
            type="button"
            className={`btn sm ${forumSort === 'latest' ? '' : 'ghost'}`.trim()}
            aria-pressed={forumSort === 'latest'}
            onClick={() => setForumSort('latest')}
          >
            Latest
          </button>
          <button
            type="button"
            className={`btn sm ${forumSort === 'popular' ? '' : 'ghost'}`.trim()}
            aria-pressed={forumSort === 'popular'}
            onClick={() => setForumSort('popular')}
          >
            Popular
          </button>
        </div>
      </div>

      <p className="tiny muted" role="status">
        {forumSort === 'popular'
          ? 'Popular puts posts with the most reactions plus comments first. Pinned posts stay on top.'
          : 'Latest shows the newest posts first. Pinned posts stay on top.'}
      </p>

      {shown.length ? (
        shown.map((f) => {
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
          const nReact = Object.keys(f.reacts || {}).length
          const nCm = cmCount(f)
          const showTitle = f.kind !== 'student' && f.kind !== 'school'
          const bodyStr = String(f.body || '')
          const menuKey = `p:${f.id}`
          const menuOpen = openMenuKey === menuKey

          const liveProd =
            f.pid && allOnSale.some((p) => p.id === f.pid)
              ? allOnSale.find((p) => p.id === f.pid)
              : undefined
          const prodImgs = liveProd ? imgsOf(liveProd) : []
          const postImgs = f.imgs || []

          return (
            <article
              key={f.id}
              className={`card fpost ${f.pinned ? 'pinned' : ''} ${
                f.hidden || f.held ? 'is-hidden' : ''
              }`.trim()}
              id={`post-${f.id}`}
            >
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
                    {isStaffUser && f.held && f.screening?.reasons?.length ? (
                      <span className="tiny muted" title={f.screening.reasons.join(' ')}>
                        {f.screening.reasons[0]}
                      </span>
                    ) : null}
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
                    aria-expanded={menuOpen}
                    aria-label="More actions for this post"
                    title="More actions"
                    onClick={() =>
                      setOpenMenuKey((cur) => (cur === menuKey ? null : menuKey))
                    }
                  >
                    <Icon name="dots" size="sm" />
                  </button>
                  {menuOpen && (
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

              {showTitle && (
                <h3 className="ftitle">
                  <button
                    type="button"
                    className="ftitle-btn"
                    onClick={() => openPost(f.id)}
                  >
                    {postTitle(f)}
                  </button>
                </h3>
              )}

              {showTitle ? (
                bodyStr &&
                !(f.kind === 'post' && !String(f.title || '').trim() && bodyStr.length <= 70) && (
                  <div className="fbody">
                    {bodyStr.length > 280
                      ? bodyStr.slice(0, 280).trim() + '...'
                      : bodyStr}
                    {bodyStr.length > 280 && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="link"
                          onClick={() => openPost(f.id)}
                        >
                          Read more
                        </button>
                      </>
                    )}
                  </div>
                )
              ) : (
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
              )}

              {postImgs.length > 0 && (
                <div className={`fimgs n${Math.min(postImgs.length, 4)}`}>
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

              <div className="fcount">
                <span>
                  {nReact ? `${nReact} reaction${nReact === 1 ? '' : 's'}` : 'No reactions yet'}
                </span>
                <span>
                  {nCm ? `${nCm} comment${nCm === 1 ? '' : 's'}` : 'No comments yet'}
                </span>
              </div>

              <div className="freacts" role="group" aria-label="React to this post">
                {REACTS.map((r) => {
                  const myReact = f.reacts[currentAccount.email]
                  const n = Object.values(f.reacts || {}).filter((x) => x === r[0]).length
                  return (
                    <button
                      key={r[0]}
                      type="button"
                      className={`rbtn ${myReact === r[0] ? 'on' : ''}`.trim()}
                      aria-pressed={myReact === r[0]}
                      aria-label={`${r[2]}${n ? `, ${n}` : ''}`}
                      onClick={() => toggleForumReaction(f.id, r[0])}
                    >
                      <span className="e">{r[1]}</span>
                      {n ? <span className="tnum">{n}</span> : <span className="muted">{r[2]}</span>}
                    </button>
                  )
                })}
                <span className="grow" />
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => openPost(f.id)}
                >
                  <Icon name="msg" size="sm" />
                  {nCm ? `Comments (${nCm})` : 'Comment'}
                </button>
              </div>
            </article>
          )
        })
      ) : (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
        >
          <span style={{ color: 'var(--blue)' }}>
            <Icon name="msg" />
          </span>
          <b>
            {forumTab === 'all' || forumTab === 'post'
              ? 'Be the first to post'
              : 'Nothing here yet'}
          </b>
          <p className="small muted" style={{ maxWidth: '48ch' }}>
            {forumTab === 'notice'
              ? 'Notices from RTU staff will show up here.'
              : forumTab === 'listing'
                ? 'When a listing is approved or the school adds an official product, it is announced here.'
                : 'Start a conversation above. Other students can react and reply.'}
          </p>
        </div>
      )}

      {list.length > shown.length && (
        <button
          type="button"
          className="btn ghost"
          style={{ alignSelf: 'center' }}
          onClick={() => setFpLimit((n) => n + 10)}
        >
          Show more posts
        </button>
      )}
    </div>
  )
}
