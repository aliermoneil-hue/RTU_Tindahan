import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { navigate } from '@/common/router/router'
import { catOf, peso, subOf } from '../../constants'
import { API_ID_PREFIX } from '../../api/listings'
import { useTindahan } from '../../context/TindahanContext'
import { IMG_RULES, imgSrc, imgsOf } from '../../imageStore'
import './ModerationPage.css'

export function ModerationPage() {
  const {
    db,
    canModerate,
    pendingListings,
    moderateListing,
    modTab,
    setModTab,
    selectedFlagId,
    setSelectedFlagId,
    decideFlag,
    reopenFlag,
    adminPauseListing,
    adminResumeListing,
    adminRemoveListing,
    openModal,
  } = useTindahan()

  const [modNote, setModNote] = useState('')
  const [activeImgIdx, setActiveImgIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // The real queue comes from Django. Each row is shaped like a flag so the
  // detail panel below can render it unchanged; `apiSlug` marks the ones whose
  // decision must go to the server rather than to the local prototype state.
  const apiRows = pendingListings.map(
    (dto) =>
      ({
        id: `api-flag:${dto.slug}`,
        lid: `${API_ID_PREFIX}${dto.slug}`,
        state: 'open',
        // AI-11: a row the screening rejected says so, because the moderator's
        // decision is the opposite one: confirm it, or publish over it.
        pri:
          dto.screening?.verdict === 'rejected'
            ? 'Screening rejected — confirm or reverse'
            : 'Waiting for approval',
        // The panel below reads these three straight off the row, so carry the
        // listing's own values instead of leaving them blank.
        title: dto.title,
        price: Number(dto.price),
        seller: dto.seller_name,
        // The screening card is red when the screening said no, green when it
        // merely passed the item along.
        risky: dto.screening ? dto.screening.verdict !== 'clean' : false,
      }) as (typeof db.flags)[number],
  )
  const openFlags = [...apiRows, ...db.flags.filter((x) => x.state === 'open')]
  const doneFlags = db.flags.filter((x) => x.state !== 'open')
  const list = modTab === 'open' ? openFlags : doneFlags
  const f = list.find((x) => x.id === selectedFlagId) || list[0]
  const apiSlug =
    f && String(f.id).startsWith('api-flag:') ? String(f.id).slice('api-flag:'.length) : ''
  const lst = f ? db.userListings.find((l) => l.lid === f.lid) : undefined
  const p = lst?.product
  const screeningNow = f
    ? pendingListings.find((d) => `${API_ID_PREFIX}${d.slug}` === f.lid)?.screening ?? null
    : null
  const screeningRejected = screeningNow?.verdict === 'rejected'

  // Reset image index when switching selected flag
  useEffect(() => {
    setActiveImgIdx(0)
    setLightboxOpen(false)
  }, [f?.id])

  if (!canModerate) {
    return (
      <div className="card stack">
        <b>Only a moderator or an administrator can approve listings.</b>
        <span className="tiny muted">
          Office Staff run the Official Store instead — see Store orders and Store inventory.
        </span>
      </div>
    )
  }

  const submittedImgIds = p ? imgsOf(p) : []
  const submittedUrls = submittedImgIds.map((id) => imgSrc(id)).filter(Boolean)
  const safeIdx =
    submittedUrls.length > 0 ? Math.min(activeImgIdx, submittedUrls.length - 1) : 0
  const currentImgUrl = submittedUrls[safeIdx] || ''

  const stats: [string, number][] = [
    ['Waiting for approval', openFlags.length],
    ['Approved', db.flags.filter((x) => x.state === 'approved').length],
    ['Rejected', db.flags.filter((x) => x.state === 'removed').length],
    ['Members', db.accounts.filter((a) => a.role !== 'moderator').length],
  ]

  const labelFor = (x: (typeof db.flags)[number]) =>
    x.state === 'open'
      ? x.pri
      : x.state === 'approved'
        ? 'Approved'
        : x.state === 'removed'
          ? 'Rejected'
          : 'Needs review'

  return (
    <>
      <div className="row between wrap">
        <div>
          <span className="eyebrow">STAFF · LISTING APPROVAL</span>
          <h1>Approve student listings</h1>
          <p className="muted small">
            Every new listing waits here. Inspect the submitted photos and details before approving
            or rejecting.
          </p>
        </div>
        <span className="row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => openModal({ kind: 'modguide' })}
          >
            Approval guide
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => navigate('staff')}
          >
            Staff tools
          </button>
        </span>
      </div>

      <div className="mod-stats">
        {stats.map((x) => (
          <div key={x[0]} className="card flat stack" style={{ gap: 2 }}>
            <span className="small muted">{x[0]}</span>
            <b className="tnum" style={{ fontSize: 24 }}>
              {x[1]}
            </b>
          </div>
        ))}
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ['open', 'Waiting', openFlags.length],
            ['done', 'Decided', doneFlags.length],
          ] as const
        ).map((t) => (
          <button
            key={t[0]}
            type="button"
            className={`tab ${modTab === t[0] ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={modTab === t[0]}
            onClick={() => {
              setModTab(t[0])
              const targetList = t[0] === 'open' ? openFlags : doneFlags
              setSelectedFlagId(targetList[0]?.id || null)
              setModNote('')
            }}
          >
            {t[1]} <span className="tnum">({t[2]})</span>
          </button>
        ))}
      </div>

      {!list.length ? (
        <div
          className="card stack"
          style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
        >
          <span style={{ color: 'var(--green)' }}>
            <Icon name="shield" />
          </span>
          <b>{modTab === 'open' ? 'Nothing is waiting' : 'No decisions yet'}</b>
          <p className="small muted" style={{ maxWidth: '48ch' }}>
            {modTab === 'open'
              ? 'When a student submits a listing, it shows up here for you to approve or reject.'
              : 'Approved and rejected listings are kept here.'}
          </p>
        </div>
      ) : (
        <div className="mod-two two">
          <div className="stack" style={{ gap: 8 }}>
            {list.map((x) => {
              const rowListing = db.userListings.find((l) => l.lid === x.lid)?.product
              const rowImgs = rowListing ? imgsOf(rowListing) : []
              const rowThumb = rowImgs.length ? imgSrc(rowImgs[0]) : ''
              return (
                <button
                  key={x.id}
                  type="button"
                  className="card flat stack"
                  style={{
                    gap: 6,
                    textAlign: 'left',
                    borderColor: f && f.id === x.id ? 'var(--blue)' : undefined,
                    background: f && f.id === x.id ? 'var(--soft)' : undefined,
                  }}
                  onClick={() => {
                    setSelectedFlagId(x.id)
                    setModNote('')
                  }}
                >
                  <div className="row between">
                    <span className="tiny muted">
                      {String(x.id).startsWith('api-flag:') ? 'New submission' : x.id}
                    </span>
                    <span
                      className={`pill ${
                        x.state === 'approved'
                          ? 'green'
                          : x.state === 'removed'
                            ? 'red'
                            : x.risky
                              ? 'red'
                              : 'yellow'
                      }`}
                    >
                      {labelFor(x)}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <div
                      className={`photo ${rowListing?.tone || 't-study'} ${
                        rowThumb ? 'has-img' : 'nophoto-tile'
                      }`.trim()}
                      style={{ width: 46, height: 46, aspectRatio: '1', flex: 'none' }}
                    >
                      {rowThumb ? <img className="pimg" src={rowThumb} alt={x.title} /> : null}
                      <Icon name={((rowListing?.icon || 'tag') as IconName)} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <b className="small" style={{ display: 'block', overflowWrap: 'anywhere' }}>
                        {x.title}
                      </b>
                      <span className="tiny muted">
                        {peso(x.price)} · {x.seller} · {rowImgs.length}/{IMG_RULES.listing} photos
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {f && (
            <div className="card stack">
              <div className="row between wrap">
                <b>Listing details & submitted photos</b>
                <span className="tiny muted">{f.id}</span>
              </div>
              <h2 style={{ fontSize: 19 }}>{f.title}</h2>
              <div className="row wrap">
                <span className="price tnum">{peso(f.price)}</span>
                <span className="small muted" style={{ overflowWrap: 'anywhere' }}>
                  {f.seller}
                </span>
              </div>

              {p ? (
                <>
                  {/* Requirement #2: Student Product Approval - Display Submitted Images */}
                  <div className="mod-gallery" aria-label="Submitted listing images">
                    <div className="row between wrap">
                      <b className="small">
                        Submitted Listing Photos ({submittedUrls.length}/{IMG_RULES.listing} Photos)
                      </b>
                      {submittedUrls.length > 0 && (
                        <span className="tiny muted">
                          Showing photo {safeIdx + 1} of {submittedUrls.length}
                          {safeIdx === 0 ? ' · Primary listing cover' : ''}
                        </span>
                      )}
                    </div>

                    {submittedUrls.length > 0 ? (
                      <>
                        <div className="mod-stage">
                          <img
                            className="mod-stage-img"
                            src={currentImgUrl}
                            alt={`${f.title} — photo ${safeIdx + 1}`}
                            onClick={() => setLightboxOpen(true)}
                          />
                          <span className="mod-stage-badge">
                            {safeIdx === 0 ? 'Main Cover · #1' : `Photo #${safeIdx + 1}`}
                          </span>
                          {submittedUrls.length > 1 && (
                            <>
                              <button
                                type="button"
                                className="mod-stage-nav prev"
                                aria-label="Previous submitted image"
                                onClick={() =>
                                  setActiveImgIdx(
                                    (idx) =>
                                      (idx - 1 + submittedUrls.length) % submittedUrls.length,
                                  )
                                }
                              >
                                ‹
                              </button>
                              <button
                                type="button"
                                className="mod-stage-nav next"
                                aria-label="Next submitted image"
                                onClick={() =>
                                  setActiveImgIdx((idx) => (idx + 1) % submittedUrls.length)
                                }
                              >
                                ›
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="mod-enlarge-btn"
                            onClick={() => setLightboxOpen(true)}
                          >
                            <Icon name="eye" size="sm" />
                            Enlarge image
                          </button>
                        </div>

                        <div className="mod-thumbs" role="list" aria-label="Image order">
                          {submittedUrls.map((url, idx) => (
                            <button
                              key={`${submittedImgIds[idx]}-${idx}`}
                              type="button"
                              role="listitem"
                              className={`mod-thumb ${idx === safeIdx ? 'on' : ''}`.trim()}
                              title={idx === 0 ? 'Main listing image (#1)' : `Image #${idx + 1}`}
                              onClick={() => setActiveImgIdx(idx)}
                            >
                              <img src={url} alt={`Submitted thumbnail ${idx + 1}`} />
                              <span className="mod-thumb-idx">
                                {idx === 0 ? 'Main' : `#${idx + 1}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div
                        className="card flat row"
                        style={{
                          background: 'var(--card)',
                          padding: 16,
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="img" size="sm" />
                        <span className="small muted">
                          No photos were uploaded for this submission (0/{IMG_RULES.listing} Photos).
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid2 small">
                    <div>
                      <span className="tiny muted">CATEGORY</span>
                      <br />
                      <b>
                        {catOf(p)}
                        {subOf(p) ? ` · ${subOf(p)}` : ''}
                      </b>
                    </div>
                    <div>
                      <span className="tiny muted">AVAILABLE</span>
                      <br />
                      <b>{p.left}</b>
                    </div>
                    <div>
                      <span className="tiny muted">PICKUP / SCHEDULE</span>
                      <br />
                      <b>{p.when}</b>
                    </div>
                    <div>
                      <span className="tiny muted">FULFILLMENT OFFERED</span>
                      <br />
                      <b>
                        {p.fulfillment === 'both'
                          ? 'Pickup & Delivery'
                          : p.fulfillment === 'delivery'
                            ? 'Delivery only'
                            : 'Pickup only'}
                      </b>
                    </div>
                  </div>
                  <div className="card flat" style={{ background: 'var(--bg)' }}>
                    <span className="tiny muted">DESCRIPTION</span>
                    <p
                      className="small"
                      style={{ marginTop: 4, overflowWrap: 'anywhere' }}
                    >
                      {p.desc}
                    </p>
                  </div>
                </>
              ) : (
                <p className="small muted">This listing was deleted by the seller.</p>
              )}

              <div
                className="card flat stack"
                style={{
                  gap: 4,
                  background: f.risky ? 'var(--red-bg)' : 'var(--green-bg)',
                  borderColor: 'transparent',
                }}
              >
                <b className="small">Automatic screening</b>
                <span className="small">{f.reason}</span>
                {screeningNow && (
                  <span className="small muted">
                    {screeningNow.verdict === 'rejected'
                      ? 'The screening rejected this listing'
                      : screeningNow.verdict === 'flagged'
                        ? 'The screening flagged this listing'
                        : 'The screening passed it'}{' '}
                    with{' '}
                    {screeningNow.confidence === null
                      ? 'no stated confidence'
                      : `${Math.round(screeningNow.confidence * 100)}% confidence`}
                    {screeningNow.confidence !== null &&
                    screeningNow.confidence < 0.7 &&
                      ' — below the floor, so a person decides'}
                    . The AI is never the final authority.
                  </span>
                )}
                <button
                  type="button"
                  className="link"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => openModal({ kind: 'policy' })}
                >
                  Open prohibited items policy
                </button>
              </div>

              {f.state === 'open' ? (
                <div className="stack" style={{ gap: 8 }}>
                  <b>Your decision</b>
                  <label className="field">
                    <span className="small muted">
                      Note to the seller (sent to Notifications and opens a two-way Inbox
                      conversation if rejected)
                    </span>
                    <textarea
                      className="input"
                      id="modnote"
                      placeholder="Write the approval note or the reason for rejection so the student can reply in Messages..."
                      value={modNote}
                      onChange={(e) => setModNote(e.target.value)}
                    />
                  </label>
                  <div className="row wrap">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        if (apiSlug) void moderateListing(apiSlug, 'approve')
                        else decideFlag('approved', modNote)
                        setModNote('')
                      }}
                    >
                      <Icon name="check" size="sm" />
                      {screeningRejected ? 'Reverse the rejection and publish' : 'Approve and publish'}
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => {
                        if (apiSlug) void moderateListing(apiSlug, 'reject', modNote)
                        else decideFlag('removed', modNote)
                        setModNote('')
                      }}
                    >
                      {screeningRejected ? 'Uphold the rejection' : 'Reject & message seller'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="note green">
                    <Icon name="check" />
                    <span className="grow">
                      Decision:{' '}
                      <b>
                        {lst?.modHold
                          ? 'Removed by staff (sent to student Inbox)'
                          : lst?.paused
                            ? 'Paused by staff (sent to student Inbox)'
                            : f.state === 'approved'
                              ? 'Approved and published'
                              : f.state === 'removed'
                                ? 'Rejected (sent to student Inbox)'
                                : 'Needs review'}
                      </b>
                      {f.note ? `. Note: ${f.note}` : ''}
                    </span>
                    <button
                      type="button"
                      className="link"
                      onClick={() => reopenFlag()}
                    >
                      Reopen
                    </button>
                  </div>

                  {lst && f.state === 'approved' && !lst.modHold && (
                    <div className="card flat stack" style={{ background: 'var(--bg)', gap: 8 }}>
                      <b className="small">Manage approved student listing</b>
                      <span className="tiny muted">
                        Pause or delete this published student listing. The student seller will be
                        notified and receive your reason in their Messages Inbox.
                      </span>
                      <input
                        className="input"
                        placeholder="Reason to send to the student seller (at least 5 characters for delete)..."
                        value={modNote}
                        onChange={(e) => setModNote(e.target.value)}
                      />
                      <div className="row wrap" style={{ gap: 8 }}>
                        {lst.paused ? (
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => adminResumeListing(lst.lid)}
                          >
                            Resume listing
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn yellow sm"
                            onClick={() => {
                              if (
                                adminPauseListing(
                                  lst.lid,
                                  modNote.trim() ||
                                    'Temporarily paused by administrator for review.',
                                )
                              ) {
                                setModNote('')
                              }
                            }}
                          >
                            Pause listing & notify student
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn danger sm"
                          onClick={() => {
                            if (modNote.trim().length < 5) {
                              openModal({ kind: 'admin-remove-listing', lid: lst.lid })
                              return
                            }
                            if (adminRemoveListing(lst.lid, modNote.trim())) {
                              setModNote('')
                            }
                          }}
                        >
                          Delete listing & notify student
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Enlarged Image Inspection Lightbox Modal (Requirement #2) */}
      {lightboxOpen && submittedUrls.length > 0 && f && (
        <>
          <div
            className="modal-scrim cfm-scrim show"
            onClick={() => setLightboxOpen(false)}
          />
          <div
            className="card dlg dlg-wide mod-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Inspect submitted image"
            style={{ zIndex: 112 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between wrap">
              <div>
                <b className="small">{f.title}</b>
                <div className="tiny muted">
                  Photo {safeIdx + 1} of {submittedUrls.length}
                  {safeIdx === 0 ? ' (Primary listing image)' : ''} · Submitted by {f.seller}
                </div>
              </div>
              <button
                type="button"
                className="iconbtn"
                aria-label="Close image preview"
                onClick={() => setLightboxOpen(false)}
              >
                <Icon name="x" />
              </button>
            </div>

            <div className="mod-lightbox-stage">
              <img
                src={currentImgUrl}
                alt={`${f.title} enlarged photo ${safeIdx + 1}`}
              />
              {submittedUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="mod-stage-nav prev"
                    aria-label="Previous photo"
                    onClick={() =>
                      setActiveImgIdx(
                        (idx) => (idx - 1 + submittedUrls.length) % submittedUrls.length,
                      )
                    }
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="mod-stage-nav next"
                    aria-label="Next photo"
                    onClick={() =>
                      setActiveImgIdx((idx) => (idx + 1) % submittedUrls.length)
                    }
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {submittedUrls.length > 1 && (
              <div className="mod-thumbs" style={{ justifyContent: 'center' }}>
                {submittedUrls.map((url, idx) => (
                  <button
                    key={`lb-${idx}`}
                    type="button"
                    className={`mod-thumb ${idx === safeIdx ? 'on' : ''}`.trim()}
                    onClick={() => setActiveImgIdx(idx)}
                  >
                    <img src={url} alt={`Thumbnail ${idx + 1}`} />
                    <span className="mod-thumb-idx">
                      {idx === 0 ? 'Main' : `#${idx + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
