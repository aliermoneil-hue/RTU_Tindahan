import {
  BAO_PILL,
  baoDate,
  baoIsOfficialTxn,
  baoItemType,
  baoReserved,
  baoStatusOf,
  baoUnit,
  baoUnitName,
} from '../baoHelpers'
import { hasVars, varLabel } from '../constants'
import { BaoProgressBar } from '../pages/OrdersPage'
import type { BaoStatus } from '../types'
import { useEffect, useId, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { setAfterLogin } from '@/common/utils/afterLogin'
import { navigate } from '@/common/router/router'
import { useAuth } from '@/features/authentication'
import {
  FR_ACTIONS,
  FR_REASONS,
  ORDER_REPORT_REASONS_BUYER,
  ORDER_REPORT_REASONS_SELLER,
  PROGRAMS,
  TX_PILL,
  initialsOf,
  peso,
  stamp,
} from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { imgAdd, imgSrc } from '../imageStore'
import { AvatarBadge } from './AvatarBadge'
import { RatingText } from './StarRating'
import './GlobalOverlays.css'

export function GlobalOverlays() {
  const {
    db,
    currentAccount,
    isStaffUser,
    toastMsg,
    toast,
    activeModal,
    openModal,
    closeModal,
    confirmDialog,
    closeConfirmDlg,
    allOnSale,
    byId,
    acctByEmail,
    sellerKeyByName,
    toggleSellerFav,
    browseFor,
    saveProfile,
    startEditListing,
    toggleSellerListingPause,
    deleteSellerListing,
    editForumPost,
    submitForumReport,
    applyForumModerationAction,
    adminSetUserStatus,
    adminRemoveListing,
    adminActTransaction,
    resetEverything,
    bumpImgVersion,
  } = useTindahan()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDialog) {
          closeConfirmDlg()
        } else if (activeModal) {
          closeModal()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmDialog, activeModal, closeConfirmDlg, closeModal])

  return (
    <>
      <div id="toast-host" aria-live="polite" aria-atomic="true">
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>

      {confirmDialog && (
        <>
          <div
            className="modal-scrim cfm-scrim show"
            onClick={closeConfirmDlg}
          />
          <div
            className="card dlg dlg-cfm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cfm-title"
          >
            <div className="row between">
              <h3 id="cfm-title">{confirmDialog.title || 'Are you sure?'}</h3>
              <button
                type="button"
                className="iconbtn"
                aria-label="Close"
                onClick={closeConfirmDlg}
              >
                <Icon name="x" />
              </button>
            </div>
            <p className="small" style={{ lineHeight: 1.55 }}>
              {confirmDialog.msg || ''}
            </p>
            <div className="row dlg-actions">
              <button type="button" className="btn ghost" onClick={closeConfirmDlg}>
                {confirmDialog.no || 'Cancel'}
              </button>
              <button
                type="button"
                className={`btn ${confirmDialog.danger ? 'danger' : ''}`.trim()}
                onClick={() => {
                  const fn = confirmDialog.run
                  closeConfirmDlg()
                  fn()
                }}
              >
                {confirmDialog.yes || 'Confirm'}
              </button>
            </div>
          </div>
        </>
      )}

      {activeModal && (
        <>
          <div
            className="modal-scrim show"
            onClick={closeModal}
          />
          <ModalContent
            activeModal={activeModal}
            db={db}
            currentAccount={currentAccount}
            isStaffUser={isStaffUser}
            toast={toast}
            openModal={openModal}
            closeModal={closeModal}
            allOnSale={allOnSale}
            byId={byId}
            acctByEmail={acctByEmail}
            sellerKeyByName={sellerKeyByName}
            toggleSellerFav={toggleSellerFav}
            browseFor={browseFor}
            saveProfile={saveProfile}
            startEditListing={startEditListing}
            toggleSellerListingPause={toggleSellerListingPause}
            deleteSellerListing={deleteSellerListing}
            editForumPost={editForumPost}
            submitForumReport={submitForumReport}
            applyForumModerationAction={applyForumModerationAction}
            adminSetUserStatus={adminSetUserStatus}
            adminRemoveListing={adminRemoveListing}
            adminActTransaction={adminActTransaction}
            resetEverything={resetEverything}
            bumpImgVersion={bumpImgVersion}
          />
        </>
      )}
    </>
  )
}

interface ModalContentProps {
  activeModal: NonNullable<ReturnType<typeof useTindahan>['activeModal']>
  db: ReturnType<typeof useTindahan>['db']
  currentAccount: ReturnType<typeof useTindahan>['currentAccount']
  isStaffUser: boolean
  toast: (msg: string) => void
  openModal: ReturnType<typeof useTindahan>['openModal']
  closeModal: () => void
  allOnSale: ReturnType<typeof useTindahan>['allOnSale']
  byId: ReturnType<typeof useTindahan>['byId']
  acctByEmail: ReturnType<typeof useTindahan>['acctByEmail']
  sellerKeyByName: ReturnType<typeof useTindahan>['sellerKeyByName']
  toggleSellerFav: ReturnType<typeof useTindahan>['toggleSellerFav']
  browseFor: ReturnType<typeof useTindahan>['browseFor']
  saveProfile: ReturnType<typeof useTindahan>['saveProfile']
  startEditListing: ReturnType<typeof useTindahan>['startEditListing']
  toggleSellerListingPause: ReturnType<typeof useTindahan>['toggleSellerListingPause']
  deleteSellerListing: ReturnType<typeof useTindahan>['deleteSellerListing']
  editForumPost: ReturnType<typeof useTindahan>['editForumPost']
  submitForumReport: ReturnType<typeof useTindahan>['submitForumReport']
  applyForumModerationAction: ReturnType<typeof useTindahan>['applyForumModerationAction']
  adminSetUserStatus: ReturnType<typeof useTindahan>['adminSetUserStatus']
  adminRemoveListing: ReturnType<typeof useTindahan>['adminRemoveListing']
  adminActTransaction: ReturnType<typeof useTindahan>['adminActTransaction']
  resetEverything: ReturnType<typeof useTindahan>['resetEverything']
  bumpImgVersion: () => void
}

function DialogShell({
  title,
  wide,
  children,
  onClose,
}: {
  title: string
  wide?: boolean
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className={`card dlg ${wide ? 'dlg-wide' : ''}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-title"
    >
      <div className="row between">
        <h3 id="dlg-title">{title}</h3>
        <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      {children}
    </div>
  )
}

function ModalContent(props: ModalContentProps) {
  const { activeModal, closeModal } = props

  switch (activeModal.kind) {
    case 'guidelines':
      return (
        <DialogShell title="Community guidelines" onClose={closeModal}>
          <ul className="small dlg-ul">
            <li>Be honest about what you sell, including its condition.</li>
            <li>Meet only at visible spots inside Pasig Campus.</li>
            <li>Pay in person. RTU Tindahan never handles money or delivery.</li>
            <li>No exam answers, vaping products, medicines, resale tickets or weapons.</li>
            <li>Treat every student and staff member with respect.</li>
          </ul>
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )

    case 'policy':
      return (
        <DialogShell title="Prohibited items policy" onClose={closeModal}>
          <ul className="small dlg-ul">
            <li>Exam answers, test papers and similar material</li>
            <li>Medicines, supplements and regulated health products</li>
            <li>Vaping products and tobacco</li>
            <li>Tickets sold above face value</li>
            <li>Weapons and dangerous items</li>
            <li>Anything that cannot be handed over safely on campus</li>
          </ul>
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )

    case 'rules':
      return (
        <DialogShell title="Prohibited items guide" onClose={closeModal}>
          <ul className="small dlg-ul">
            <li>No exam answers or test papers</li>
            <li>No vaping products or tobacco</li>
            <li>No medicines, supplements or regulated health products</li>
            <li>No tickets above face value</li>
            <li>No weapons or dangerous items</li>
            <li>Risky-looking listings are held for a moderator before they go live</li>
          </ul>
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )

    case 'modguide':
      return (
        <DialogShell title="Moderation guide" onClose={closeModal}>
          <ul className="small dlg-ul">
            <li>Read the listing and the screening evidence before deciding.</li>
            <li>Approve when the item is allowed and the details are honest. It goes live right away.</li>
            <li>Reject when it breaks the prohibited items policy. The seller is told.</li>
            <li>Write a short note. It is kept in the audit log and sent to the seller.</li>
          </ul>
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )

    case 'gate':
      return (
        <DialogShell title="Sign in to continue" onClose={closeModal}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <span
              className="avatar"
              style={{
                background: 'var(--soft)',
                color: 'var(--blue)',
                width: 44,
                height: 44,
                flex: 'none',
              }}
            >
              <Icon name="lock" />
            </span>
            <p className="small" style={{ lineHeight: 1.55 }}>
              You need a verified RTU account to {activeModal.why || 'use this feature'}. Sign in
              with your RTU email, or create an account if you are new. You can keep browsing the
              Books and Merchandise pages as a guest.
            </p>
          </div>
          <div className="row wrap dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Not now
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setAfterLogin(activeModal.after || activeModal.route)
                closeModal()
                navigate('register')
              }}
            >
              Create account
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setAfterLogin(activeModal.after || activeModal.route)
                closeModal()
                navigate('login')
              }}
            >
              <Icon name="lock" size="sm" />
              Sign in
            </button>
          </div>
        </DialogShell>
      )

    case 'section-tips': {
      const isBooks = activeModal.section === 'books'
      return (
        <DialogShell
          title={isBooks ? 'Before you buy a used book or manual' : 'Uniform size guide'}
          onClose={closeModal}
        >
          {isBooks ? (
            <ul className="small dlg-ul">
              <li>Check that the edition matches your syllabus.</li>
              <li>Flip through every page. Look for torn or missing sheets.</li>
              <li>Ask the seller for extra photos if you cannot meet right away.</li>
              <li>Meet at the library entrance or main lobby.</li>
              <li>Pay only after you have checked the item.</li>
            </ul>
          ) : (
            <p className="small" style={{ lineHeight: 1.6 }}>
              The campus store posts its own size chart at the claim window. Ask the staff to
              measure you before you reserve a uniform. If you are between sizes, choose the larger
              one.
            </p>
          )}
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )
    }

    case 'seller-profile': {
      const name = activeModal.sellerName
      const clean = name.replace(' (You)', '').split(' · ')[0]
      const items = props.allOnSale.filter(
        (p) =>
          p.seller === name ||
          p.seller.replace(' (You)', '').split(' · ')[0] === clean,
      )
      const isSchool = name === 'RTU Pasig Campus Store'
      const sellerAcct = isSchool
        ? null
        : props.db.accounts.find((a) => a.name === clean) || null
      const skey = props.sellerKeyByName(name)
      const sfav = Boolean(props.currentAccount?.sfavs?.includes(skey))
      const isSelf =
        !isSchool &&
        props.currentAccount &&
        (skey === props.currentAccount.email || clean === props.currentAccount.name)

      return (
        <DialogShell title={name} onClose={closeModal}>
          <div className="row">
            {sellerAcct ? (
              <AvatarBadge account={sellerAcct} size="lg" />
            ) : (
              <AvatarBadge
                name={isSchool ? 'RTU Pasig Campus Store' : clean}
                isStaff={isSchool}
                size="lg"
              />
            )}
            <div>
              <b>{name}</b> <Icon name="check" size="sm" />
              <div className="small muted">Verified RTU seller · Pasig Campus</div>
              <div className="small">
                <RatingText kind="seller" targetKey={skey || name} />
              </div>
            </div>
          </div>
          <div className="small">
            {items.length
              ? 'Meetups happen on campus only.'
              : 'This seller has nothing on sale right now.'}
          </div>
          <div className="row wrap dlg-actions">
            {!isSelf && skey && (
              <button
                type="button"
                className={`btn ghost sm sfav ${sfav ? 'on' : ''}`.trim()}
                aria-pressed={sfav}
                onClick={() => props.toggleSellerFav(skey)}
              >
                <Icon name="heart" size="sm" />
                {sfav ? 'Favorite seller' : 'Add seller to favorites'}
              </button>
            )}
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                closeModal()
                props.browseFor({ q: name })
              }}
            >
              See their listings
            </button>
          </div>
        </DialogShell>
      )
    }

    case 'edit-profile':
      return <EditProfileDialog {...props} />

    case 'verif-status': {
      const u = props.currentAccount
      if (!u) return null
      const rows: [string, string][] = [
        ['RTU email', u.email],
        ['Email check', 'Code sent to your RTU email'],
        ['Student number', u.sid],
        ['Status', u.role === 'moderator' ? 'RTU staff account' : 'Verified with an emailed code'],
      ]
      return (
        <DialogShell title="Account verification" onClose={closeModal}>
          <div className="stack" style={{ gap: 8 }}>
            {rows.map((r) => (
              <div key={r[0]} className="row between small wrap">
                <span className="muted">{r[0]}</span>
                <b style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>{r[1]}</b>
              </div>
            ))}
          </div>
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )
    }

    case 'archive':
      return (
        <DialogShell title="Announcement archive" onClose={closeModal}>
          <div className="stack" style={{ gap: 10 }}>
            {props.db.ann.length ? (
              props.db.ann.map((a, idx) => (
                <button
                  key={a.id || idx}
                  type="button"
                  className="card flat stack"
                  style={{ textAlign: 'left', gap: 2 }}
                  onClick={() => props.openModal({ kind: 'announcement', title: a.t })}
                >
                  <span className="tiny muted">{a.d}</span>
                  <b className="small">{a.t}</b>
                </button>
              ))
            ) : (
              <p className="small muted">Nothing posted yet.</p>
            )}
          </div>
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )

    case 'announcement': {
      const a = props.db.ann.find((x) => x.t === activeModal.title) || {
        t: activeModal.title,
        d: '',
        b: 'Please check the Student Affairs desk for details.',
      }
      return (
        <DialogShell title={a.t} onClose={closeModal}>
          <span className="tiny muted">Office of Student Affairs · {a.d}</span>
          <p className="small" style={{ lineHeight: 1.6 }}>
            {a.b}
          </p>
          <div className="row between">
            <button
              type="button"
              className="btn ghost"
              onClick={() => props.openModal({ kind: 'archive' })}
            >
              All announcements
            </button>
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )
    }

    case 'export-record': {
      const u = props.currentAccount
      if (!u) return null
      const rows = u.orders.filter((o) => o.tab === 'Completed')
      const txt = rows.length
        ? `RTU Tindahan transaction record for ${u.name} (${u.email})\n` +
          rows.map((o) => `${o.id} | ${o.title} | ${o.seller} | ${peso(o.total)}`).join('\n')
        : 'No completed pickups yet.'

      return (
        <DialogShell title="Transaction record" onClose={closeModal}>
          {rows.length ? (
            <>
              <div className="scroll-x">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Item</th>
                      <th>Seller</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => (
                      <tr key={o.id}>
                        <td className="tnum">{o.id}</td>
                        <td>{o.title}</td>
                        <td>{o.seller}</td>
                        <td className="tnum">{peso(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <textarea
                className="input"
                id="exp-text"
                readOnly
                aria-label="Record as text"
                style={{ minHeight: 90 }}
                value={txt}
              />
              <div className="row dlg-actions">
                <button type="button" className="btn ghost" onClick={closeModal}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(txt).then(
                        () => props.toast('Copied to your clipboard.'),
                        () =>
                          props.toast(
                            'Copy was blocked. Select the text and copy it yourself.',
                          ),
                      )
                    } catch {
                      props.toast('Copy was blocked. Select the text and copy it yourself.')
                    }
                  }}
                >
                  Copy record
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="small muted">{txt} Finish a pickup and it will be listed here.</p>
              <div className="row dlg-actions">
                <button type="button" className="btn ghost" onClick={closeModal}>
                  Close
                </button>
              </div>
            </>
          )}
        </DialogShell>
      )
    }

    case 'manage-listings': {
      const u = props.currentAccount
      if (!u) return null
      return (
        <DialogShell title="Manage your listings" onClose={closeModal}>
          {u.sellerList.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {u.sellerList.map((l, i) => (
                <div
                  key={`${l.lid || l.name}-${i}`}
                  className="row between wrap"
                  style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}
                >
                  <div>
                    <b className="small">{l.name}</b>
                    <div className="tiny muted">
                      {l.status} · {peso(l.price)}
                    </div>
                  </div>
                  <span className="row">
                    {l.lid && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => {
                          closeModal()
                          props.startEditListing(l.lid)
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {(l.status === 'Active' || l.status === 'Paused') && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => props.toggleSellerListingPause(i)}
                      >
                        {l.status === 'Active' ? 'Pause' : 'Resume'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => props.deleteSellerListing(i)}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted">You have no listings yet.</p>
          )}
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )
    }

    case 'txn-view': {
      const t = props.db.txn.find((x) => x.id === activeModal.txnId)
      if (!t) return null
      const mine = !t.sellerEmail
      const acts: [string, string, string][] =
        t.status === 'Pending'
          ? [
              ['Confirmed', 'Confirm request', ''],
              ['Cancelled', 'Cancel request', 'danger'],
            ]
          : t.status === 'Confirmed'
            ? [
                ['Completed', 'Mark as completed', ''],
                ['Cancelled', 'Cancel request', 'danger'],
              ]
            : []

      const rows: [string, string][] = [
        ['Order', t.orderId],
        ['Date', stamp(t.created)],
        ['Buyer', t.buyerName + (t.buyerSid ? ` (${t.buyerSid})` : '')],
        ['Buyer email', t.buyerEmail],
        ['Seller', t.sellerName + (t.sellerSid ? ` (${t.sellerSid})` : '')],
        ['Meetup', t.meetup],
        ['Quantity', String(t.qty)],
        ['Total', peso(t.total)],
      ]

      return (
        <DialogShell title={`Transaction ${t.id}`} onClose={closeModal}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className={`pill ${TX_PILL[t.status] || ''}`.trim()}>{t.status}</span>
            <span className={`srcpill ${t.type === 'official' ? 'school' : 'student'}`}>
              {t.type === 'official' ? 'Official RTU Store' : 'Student to student'}
            </span>
            {t.kind !== 'product' && <span className="srcpill svc">Service</span>}
          </div>

          <div className="stack" style={{ gap: 6 }}>
            {rows.map((r) => (
              <div
                key={r[0]}
                className="row between small wrap"
                style={{ alignItems: 'flex-start' }}
              >
                <span className="muted">{r[0]}</span>
                <b style={{ textAlign: 'right', overflowWrap: 'anywhere', maxWidth: '70%' }}>
                  {r[1]}
                </b>
              </div>
            ))}
          </div>

          <div className="card flat stack" style={{ gap: 6, background: 'var(--bg)' }}>
            <b className="small">Items (saved when the request was made)</b>
            {(t.lines || []).map((l, idx) => (
              <div key={`${l.pid || idx}-${idx}`} className="row between small wrap">
                <span style={{ overflowWrap: 'anywhere' }}>
                  {l.name} × {l.qty}
                  {l.kind === 'service' ? ' (service)' : ''}
                </span>
                <span className="tnum">{peso(l.price * l.qty)}</span>
              </div>
            ))}
          </div>

          <div>
            <b className="small">Status history</b>
            <div className="tl" style={{ marginTop: 8 }}>
              {(t.history || []).map((h, idx) => (
                <div key={idx}>
                  <b className="small">{h.status}</b>{' '}
                  <span className="tiny muted">
                    {stamp(h.ts)} · {h.by}
                  </span>
                  <div className="tiny muted">{h.note || ''}</div>
                </div>
              ))}
            </div>
          </div>

          {acts.length > 0 && mine ? (
            <div className="row wrap dlg-actions">
              {acts.map((a) => (
                <button
                  key={a[0]}
                  type="button"
                  className={`btn ${a[2]}`.trim()}
                  onClick={() =>
                    props.adminActTransaction(
                      t.id,
                      a[0] as 'Confirmed' | 'Completed' | 'Cancelled',
                    )
                  }
                >
                  {a[1]}
                </button>
              ))}
            </div>
          ) : (
            <div className="note blue">
              <Icon name="info" size="sm" />
              <span className="small">
                {mine
                  ? 'This record is closed.'
                  : 'A student seller handles this one. The status changes when the seller or buyer confirms it. Staff can review it here.'}
              </span>
            </div>
          )}

          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )
    }

    case 'forum-photo': {
      const f = props.db.feed.find((x) => x.id === activeModal.postId)
      const id = f?.imgs?.[activeModal.index]
      const src = id ? imgSrc(id) : null
      if (!f || !src) return null
      return (
        <DialogShell title={f.title || 'Post photo'} wide onClose={closeModal}>
          <img className="fimg-big" src={src} alt={f.title || 'Post photo'} />
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={closeModal}>
              Close
            </button>
          </div>
        </DialogShell>
      )
    }

    case 'forum-edit-post':
      return <ForumEditPostDialog {...props} postId={activeModal.postId} />

    case 'forum-report':
      return (
        <ForumReportDialog
          {...props}
          postId={activeModal.postId}
          commentId={activeModal.commentId}
        />
      )

    case 'order-report':
      return (
        <OrderReportDialog
          {...props}
          orderId={activeModal.orderId}
          role={activeModal.role}
          targetEmail={activeModal.targetEmail}
          targetName={activeModal.targetName}
          itemTitle={activeModal.itemTitle}
        />
      )

    case 'forum-mod-action':
      return <ForumModActionDialog {...props} reportId={activeModal.reportId} />

    case 'admin-user':
      return <AdminUserDialog {...props} email={activeModal.email} />

    case 'admin-remove-listing':
      return <AdminRemoveListingDialog {...props} lid={activeModal.lid} />

    case 'reset-all':
      return <ResetAllDialog {...props} />

    case 'bao-ticket':
      return <BaoTicketDialog {...props} txnId={activeModal.txnId} />

    case 'bao-move':
      return (
        <BaoMoveDialog
          {...props}
          pid={activeModal.pid}
          vid={activeModal.vid}
          moveType={activeModal.type}
        />
      )

    case 'bao-item':
      return <BaoItemSettingsDialog {...props} pid={activeModal.pid} />

    case 'bao-email-prev':
      return <BaoEmailPreviewDialog {...props} emailId={activeModal.emailId} />

    default:
      return null
  }
}

function EditProfileDialog(props: ModalContentProps) {
  const { user } = useAuth()
  const u = props.currentAccount
  const fileInputId = useId()
  const [name, setName] = useState(u?.name || '')
  const [prog, setProg] = useState(u?.prog || PROGRAMS[0])
  const [yearLevel, setYearLevel] = useState<string>(
    user?.year_level != null ? String(user.year_level) : '2',
  )
  const [contactNumber, setContactNumber] = useState<string>(user?.contact_number || '')
  const [newAvatarId, setNewAvatarId] = useState<string | null>(null)
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarErr, setAvatarErr] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [saving, setSaving] = useState(false)

  if (!u) return null

  const isStudent = (user?.member_type || 'student') === 'student' && u.role !== 'moderator'
  const pendSrc = newAvatarId ? imgSrc(newAvatarId) : null
  const curSrc: string | null = removeAvatar
    ? null
    : (u.avatar ? imgSrc(u.avatar) : null) || user?.profile_photo || null
  const progs = PROGRAMS.includes(prog as (typeof PROGRAMS)[number])
    ? [...PROGRAMS]
    : [prog, ...PROGRAMS]

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return
    setAvatarBusy(true)
    setAvatarErr('')
    const res = await imgAdd(file, { minSide: 64, maxSide: 360, square: true })
    setAvatarBusy(false)
    if (res.err || !res.id) {
      setAvatarErr(res.err || 'Could not upload photo.')
      return
    }
    setNewAvatarId(res.id)
    setProfilePhotoFile(file)
    setRemoveAvatar(false)
    props.bumpImgVersion()
  }

  return (
    <DialogShell title="Edit profile" onClose={props.closeModal}>
      <form
        className="stack"
        style={{ gap: 14 }}
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          if (name.trim().length < 2) {
            setNameErr('Enter your display name (at least 2 letters).')
            return
          }
          setSaving(true)
          const ok = await props.saveProfile(
            name,
            prog,
            newAvatarId,
            removeAvatar,
            isStudent ? Number(yearLevel) || 1 : null,
            contactNumber,
            profilePhotoFile,
          )
          setSaving(false)
          if (ok) props.closeModal()
        }}
      >
        <div className="stack" style={{ gap: 10 }}>
          <div className="row between wrap">
            <b className="small">Profile picture</b>
            <span className="tiny muted">JPEG, PNG or WebP, up to 5 MB</span>
          </div>
          <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="av-prev" aria-label="Picture preview">
              {pendSrc ? (
                <span className="avw av-xl">
                  <span className="avatar">
                    <img
                      className="avimg"
                      src={pendSrc}
                      alt="Preview of your new picture"
                    />
                  </span>
                </span>
              ) : removeAvatar ? (
                <span className="avw av-xl">
                  <span className="avatar">{initialsOf(name || u.name)}</span>
                </span>
              ) : (
                <AvatarBadge
                  account={u}
                  photoUrl={curSrc}
                  size="xl"
                  noTip
                />
              )}
            </div>
            <div className="stack grow" style={{ gap: 8, minWidth: 0 }}>
              <p className="small muted">
                {pendSrc
                  ? 'New picture ready. It is saved when you press Save changes.'
                  : removeAvatar
                    ? 'Your picture will be removed when you press Save changes.'
                    : curSrc
                      ? 'Other students see this on your reviews, forum posts and shop.'
                      : 'You are using your initials. Add a photo so people can recognize you.'}
              </p>
              <div className="row wrap">
                <label
                  className={`btn sm ghost ${avatarBusy ? 'busy' : ''}`.trim()}
                  htmlFor={fileInputId}
                >
                  <Icon name="upload" size="sm" />
                  {avatarBusy
                    ? 'Preparing photo'
                    : pendSrc || curSrc
                      ? 'Replace picture'
                      : 'Upload picture'}
                </label>
                {(pendSrc || removeAvatar) && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      setNewAvatarId(null)
                      setProfilePhotoFile(null)
                      setRemoveAvatar(false)
                      setAvatarErr('')
                    }}
                  >
                    Undo
                  </button>
                )}
                {!pendSrc && !removeAvatar && curSrc && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setRemoveAvatar(true)}
                  >
                    Remove picture
                  </button>
                )}
              </div>
              <input
                type="file"
                id={fileInputId}
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={avatarBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  void handleAvatarFile(file)
                }}
              />
              {avatarErr && (
                <span className="err" role="alert">
                  {avatarErr}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="pname">Display name</label>
          <input
            className="input"
            id="pname"
            value={name}
            maxLength={60}
            autoComplete="name"
            aria-invalid={Boolean(nameErr)}
            onChange={(e) => {
              setName(e.target.value)
              setNameErr('')
            }}
          />
          {nameErr && (
            <span className="err" id="pname-err" role="alert">
              {nameErr}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="pprog">Program</label>
          <select
            className="input"
            id="pprog"
            value={prog}
            onChange={(e) => setProg(e.target.value)}
          >
            {progs.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="grid2">
          {isStudent && (
            <div className="field">
              <label htmlFor="pyear">Year level</label>
              <select
                className="input"
                id="pyear"
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6].map((yr) => (
                  <option key={yr} value={String(yr)}>
                    Year {yr}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="pcontact">Contact number (optional)</label>
            <input
              className="input"
              id="pcontact"
              value={contactNumber}
              maxLength={20}
              placeholder="09XX XXX XXXX"
              onChange={(e) => setContactNumber(e.target.value)}
            />
          </div>
        </div>

        <div className="row dlg-actions">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={avatarBusy || saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function ForumEditPostDialog(props: ModalContentProps & { postId: string }) {
  const f = props.db.feed.find((x) => x.id === props.postId)
  const [title, setTitle] = useState(f?.title || '')
  const [body, setBody] = useState(f?.body || '')
  const [err, setErr] = useState('')

  if (!f) return null

  return (
    <DialogShell title="Edit post" onClose={props.closeModal}>
      <form
        className="stack"
        style={{ gap: 12 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim() && !body.trim() && !(f.imgs || []).length) {
            setErr('Write some text or a title. A post with no photos cannot be empty.')
            return
          }
          const ok = props.editForumPost(f.id, title, body)
          if (ok) props.closeModal()
        }}
      >
        <div className="field">
          <label htmlFor="ep-t">Title (optional)</label>
          <input
            id="ep-t"
            className="input"
            maxLength={120}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setErr('')
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="ep-b">Post text</label>
          <textarea
            id="ep-b"
            className="input"
            rows={4}
            maxLength={2000}
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setErr('')
            }}
          />
          {err && (
            <span className="err" role="alert">
              {err}
            </span>
          )}
        </div>
        <div className="row dlg-actions">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Save changes
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function OrderReportDialog(
  props: ModalContentProps & {
    orderId: string
    role: 'buyer' | 'seller'
    targetEmail: string | null
    targetName: string
    itemTitle: string
  },
) {
  const { submitOrderReport } = useTindahan()
  const reasons =
    props.role === 'seller' ? ORDER_REPORT_REASONS_SELLER : ORDER_REPORT_REASONS_BUYER
  const [reason, setReason] = useState<string>(reasons[0])
  const [details, setDetails] = useState('')
  const [err, setErr] = useState('')

  return (
    <DialogShell
      title={
        props.role === 'seller'
          ? `Report buyer (${props.targetName})`
          : `Report seller (${props.targetName})`
      }
      onClose={props.closeModal}
    >
      <form
        className="stack"
        style={{ gap: 12 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (details.trim().length < 5) {
            setErr('Please describe what happened (at least 5 characters).')
            return
          }
          const ok = submitOrderReport(
            props.orderId,
            props.role,
            props.targetEmail,
            props.targetName,
            props.itemTitle,
            reason,
            details,
          )
          if (ok) props.closeModal()
        }}
      >
        <p className="small muted">
          Report a transaction or meetup problem for <b>Order {props.orderId}</b> ({props.itemTitle}
          ). RTU administrators will review this report and can warn, suspend, or ban the reported
          account if needed.
        </p>
        <div className="field">
          <label htmlFor="orp-reason">Problem / Reason</label>
          <select
            id="orp-reason"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="orp-text">What happened? (Required)</label>
          <textarea
            id="orp-text"
            className="input"
            rows={3}
            maxLength={400}
            placeholder={
              props.role === 'seller'
                ? 'e.g. Waited 2 hours at the Main Lobby during our agreed time window and the buyer never showed up or replied...'
                : 'e.g. Waited at the meetup point and the seller never arrived, or the item had undisclosed issues...'
            }
            value={details}
            onChange={(e) => {
              setDetails(e.target.value)
              setErr('')
            }}
          />
          {err && (
            <span className="err" role="alert">
              {err}
            </span>
          )}
        </div>
        <div className="row dlg-actions">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn danger">
            Submit report
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function ForumReportDialog(
  props: ModalContentProps & { postId: string; commentId: string | null },
) {
  const f = props.db.feed.find((x) => x.id === props.postId)
  const cm = props.commentId ? f?.comments?.find((x) => x.id === props.commentId) : null
  const [reason, setReason] = useState<string>(FR_REASONS[0])
  const [details, setDetails] = useState('')

  if (!f) return null

  return (
    <DialogShell
      title={`Report ${cm ? 'comment' : 'post'}`}
      onClose={props.closeModal}
    >
      <form
        className="stack"
        style={{ gap: 12 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const ok = props.submitForumReport(f.id, props.commentId, reason, details)
          if (ok) props.closeModal()
        }}
      >
        <p className="small muted">
          Tell RTU staff why this {cm ? 'comment' : 'post'} breaks the community guidelines.
        </p>
        <div className="field">
          <label htmlFor="rp-reason">Reason</label>
          <select
            id="rp-reason"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {FR_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rp-text">Additional details (optional)</label>
          <textarea
            id="rp-text"
            className="input"
            rows={3}
            maxLength={300}
            placeholder="Anything else staff should know"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
        <div className="row dlg-actions">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn danger">
            Send report
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function ForumModActionDialog(props: ModalContentProps & { reportId: string }) {
  const r = props.db.freports.find((x) => x.id === props.reportId)
  const [action, setAction] = useState<'hide' | 'restore' | 'delete' | 'warn'>('hide')
  const [note, setNote] = useState('')

  if (!r) return null

  return (
    <DialogShell title="Take moderation action" onClose={props.closeModal}>
      <form
        className="stack"
        style={{ gap: 12 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const ok = props.applyForumModerationAction(r.id, action, note)
          if (ok) props.closeModal()
        }}
      >
        <p className="small">
          Reported {r.type} by <b>{r.targetName}</b> · Reason: <b>{r.reason}</b>
        </p>
        <div className="field">
          <label htmlFor="fma-act">Action</label>
          <select
            id="fma-act"
            className="input"
            value={action}
            onChange={(e) =>
              setAction(e.target.value as 'hide' | 'restore' | 'delete' | 'warn')
            }
          >
            <option value="hide">{FR_ACTIONS.hide[0]}</option>
            <option value="restore">{FR_ACTIONS.restore[0]}</option>
            <option value="delete">{FR_ACTIONS.delete[0]}</option>
            <option value="warn">{FR_ACTIONS.warn[0]}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="fma-note">Note for the moderation log (optional)</label>
          <textarea
            id="fma-note"
            className="input"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="row dlg-actions">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Apply action
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function AdminUserDialog(props: ModalContentProps & { email: string }) {
  const t = props.acctByEmail(props.email)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  if (!t) {
    return (
      <DialogShell title="Manage account" onClose={props.closeModal}>
        <p className="small">That account no longer exists.</p>
        <div className="row dlg-actions">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Close
          </button>
        </div>
      </DialogShell>
    )
  }

  const cur = t.status || 'active'
  const can =
    t.role !== 'moderator' &&
    !(props.currentAccount && t.email === props.currentAccount.email)
  const posts = props.db.feed.filter((f) => f.authorEmail === t.email).length
  const uListings = props.db.userListings.filter((l) => l.ownerEmail === t.email)
  const live = uListings.filter((l) => l.state === 'live' && !l.modHold).length
  const listingTotal = t.adminListingCount ?? uListings.length
  const orderTotal = t.adminOrderCount ?? t.orders.length
  const postTotal = t.adminPostCount ?? posts

  const info: [string, string][] = [
    ['Email', t.email],
    ['Student number', t.sid || 'Not set'],
    ['Program', t.prog || 'Not set'],
    ['Role', t.role === 'moderator' ? 'Staff' : 'Student'],
    [
      'Joined',
      t.since
        ? new Date(t.since).toLocaleDateString('en-PH', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Not set',
    ],
    ['Listings', `${listingTotal}${live ? ` (${live} live)` : ''}`],
    ['Orders placed', String(orderTotal)],
    ['Forum posts', String(postTotal)],
  ]

  const handleSetStatus = (to: 'active' | 'suspended' | 'banned') => {
    if (to !== 'active' && reason.trim().length < 5) {
      setErr('Write a short reason (at least 5 characters).')
      return
    }
    const ok = props.adminSetUserStatus(t.email, to, reason.trim())
    if (ok) props.closeModal()
  }

  return (
    <DialogShell title="Manage account" onClose={props.closeModal}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="row between wrap">
          <b style={{ fontSize: 16 }}>{t.name}</b>
          <span
            className={`pill ${
              cur === 'banned' ? 'red' : cur === 'suspended' ? 'yellow' : 'green'
            }`}
          >
            {cur === 'banned' ? 'Banned' : cur === 'suspended' ? 'Suspended' : 'Active'}
          </span>
        </div>

        <dl className="adm-dl">
          {info.map((x) => (
            <div key={x[0]}>
              <dt>{x[0]}</dt>
              <dd>{x[1]}</dd>
            </div>
          ))}
        </dl>

        {(t.statusNote || (cur !== 'active' && t.statusAt)) && (
          <p className="small note-box">
            Last status change{t.statusAt ? ` on ${stamp(t.statusAt)}` : ''}
            {t.statusBy
              ? ` by ${props.acctByEmail(t.statusBy)?.name || t.statusBy}`
              : ''}
            . {t.statusNote ? `Reason: ${t.statusNote}` : ''}
          </p>
        )}

        {can ? (
          <>
            <div className="field">
              <label htmlFor="adm-reason">
                Reason{' '}
                {cur === 'active'
                  ? '(required to suspend or ban)'
                  : '(optional when restoring)'}
              </label>
              <textarea
                className="input"
                id="adm-reason"
                maxLength={200}
                rows={2}
                placeholder="For example: repeated no-shows, or a post that broke the guidelines"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setErr('')
                }}
              />
              {err && (
                <span className="err" id="adm-err" role="alert">
                  {err}
                </span>
              )}
            </div>
            <p className="small muted">
              Suspended and banned members cannot sign in and their listings are hidden. Their
              orders, messages and posts stay in the records. You can restore access at any time.
            </p>
          </>
        ) : (
          <p className="small muted">
            {t.role === 'moderator'
              ? 'Staff accounts cannot be suspended or banned here.'
              : 'You cannot change your own account here.'}{' '}
            Roles cannot be changed from this page.
          </p>
        )}

        <div className="row dlg-actions wrap">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Close
          </button>
          {can &&
            (cur === 'active' ? (
              <>
                <button
                  type="button"
                  className="btn yellow"
                  onClick={() => handleSetStatus('suspended')}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => handleSetStatus('banned')}
                >
                  Ban
                </button>
              </>
            ) : cur === 'suspended' ? (
              <>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => handleSetStatus('banned')}
                >
                  Ban
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleSetStatus('active')}
                >
                  Restore access
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => handleSetStatus('active')}
              >
                Restore access
              </button>
            ))}
        </div>
      </div>
    </DialogShell>
  )
}

function AdminRemoveListingDialog(props: ModalContentProps & { lid: string }) {
  const { adminPauseListing } = useTindahan()
  const l = props.db.userListings.find((x) => x.lid === props.lid)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  if (!l || !l.product) return null

  const handleAction = (mode: 'pause' | 'remove') => {
    if (reason.trim().length < 5) {
      setErr('Write a short reason (at least 5 characters) so the student seller knows what to fix.')
      return
    }
    const ok =
      mode === 'pause'
        ? adminPauseListing(l.lid, reason.trim())
        : props.adminRemoveListing(l.lid, reason.trim())
    if (ok) props.closeModal()
  }

  return (
    <DialogShell title="Pause or delete student listing" onClose={props.closeModal}>
      <form
        className="stack"
        style={{ gap: 12 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          handleAction('remove')
        }}
      >
        <p className="small" style={{ lineHeight: 1.55 }}>
          Choose whether to <b>Pause</b> or <b>Delete / Remove</b> “{l.product.name}”. The student
          seller will receive a notification and a two-way message in their Inbox with your reason.
        </p>
        <div className="field">
          <label htmlFor="adm-lreason">Reason to send to the student seller</label>
          <textarea
            className="input"
            id="adm-lreason"
            maxLength={200}
            rows={3}
            placeholder="Write the reason for pausing or removing this listing..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setErr('')
            }}
          />
          {err && (
            <span className="err" id="adm-lerr" role="alert">
              {err}
            </span>
          )}
        </div>
        <div className="row dlg-actions wrap" style={{ gap: 8 }}>
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Cancel
          </button>
          {!l.paused && (
            <button
              type="button"
              className="btn yellow"
              onClick={() => handleAction('pause')}
            >
              Pause listing
            </button>
          )}
          <button type="submit" className="btn danger">
            Delete / Remove listing
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function ResetAllDialog(props: ModalContentProps) {
  return (
    <DialogShell title="Reset everything?" onClose={props.closeModal}>
      <p className="small" style={{ lineHeight: 1.55 }}>
        This deletes every account, listing, order, request and announcement saved in this browser,
        then reloads the page as a clean slate. The staff account stays. This cannot be undone.
      </p>
      <div className="row dlg-actions">
        <button type="button" className="btn ghost" onClick={props.closeModal}>
          Cancel
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            props.closeModal()
            props.resetEverything()
          }}
        >
          Yes, reset it
        </button>
      </div>
    </DialogShell>
  )
}

function BaoTicketDialog(props: ModalContentProps & { txnId: string }) {
  const { baoTransitionTicket } = useTindahan()
  const t = props.db.txn.find((x) => x.id === props.txnId)
  const st = t ? baoStatusOf(t) : 'Request Received'
  const nextAllowed = t ? props.db.bao.settings.transitions[st] || [] : []
  const reqReason = props.db.bao.settings.reasonRequired || []

  const [toStatus, setToStatus] = useState<BaoStatus>(
    () => nextAllowed[0] || st,
  )
  const [pickupDate, setPickupDate] = useState<string>(() => t?.pickup || '')
  const [note, setNote] = useState<string>('')

  useEffect(() => {
    if (nextAllowed.length && !nextAllowed.includes(toStatus)) {
      setToStatus(nextAllowed[0])
    }
  }, [nextAllowed, toStatus])

  if (!t || !baoIsOfficialTxn(t)) return null

  const rows: [string, string][] = [
    ['Requested', stamp(t.created)],
    ['Source', (t.src || 'Online') + (t.staff ? `, entered by ${t.staff}` : '')],
    ['Student', t.buyerName + (t.buyerSid ? ` (${t.buyerSid})` : '')],
    ['Email', t.buyerEmail || 'No account linked'],
    ['Pickup date', t.pickup ? baoDate(t.pickup) : 'Not set'],
    ['Quantity', String(t.qty)],
    ['Total', peso(t.total)],
  ]

  return (
    <DialogShell title={`Ticket ${t.id}`} wide onClose={props.closeModal}>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className={`pill ${BAO_PILL[st] || ''}`.trim()}>{st}</span>
        <span className="srcpill school">Official RTU Store</span>
        <span className="srcpill student">{t.src || 'Online'}</span>
        {t.queue && <span className="pill">Queue {t.queue}</span>}
      </div>

      <BaoProgressBar txn={t} />

      <div className="stack" style={{ gap: 6 }}>
        {rows.map((r) => (
          <div
            key={r[0]}
            className="row between small wrap"
            style={{ alignItems: 'flex-start' }}
          >
            <span className="muted">{r[0]}</span>
            <b style={{ textAlign: 'right', overflowWrap: 'anywhere', maxWidth: '70%' }}>
              {r[1]}
            </b>
          </div>
        ))}
      </div>

      <div className="card flat stack" style={{ gap: 6, background: 'var(--bg)' }}>
        <b className="small">Items</b>
        {t.lines.map((l, idx) => (
          <div key={idx} className="row between small wrap">
            <span style={{ overflowWrap: 'anywhere' }}>
              {l.name} × {l.qty}
            </span>
            <span className="tnum">{peso(l.price * l.qty)}</span>
          </div>
        ))}
      </div>

      <div>
        <b className="small">Status history (never edited)</b>
        <div className="tl" style={{ marginTop: 8 }}>
          {(t.bhist || []).map((h, idx) => (
            <div key={idx}>
              <b className="small">
                {h.from ? `${h.from} to ` : ''}
                {h.to}
              </b>{' '}
              <span className="tiny muted">
                {stamp(h.ts)} · {h.by}
              </span>
              {h.note && <div className="tiny muted">{h.note}</div>}
            </div>
          ))}
        </div>
      </div>

      {nextAllowed.length ? (
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const res = baoTransitionTicket(t.id, toStatus, {
              note,
              pickup: pickupDate,
            })
            if (!res.ok) {
              props.toast(res.msg || 'Could not update ticket status.')
              return
            }
            setNote('')
            props.toast(`Ticket ${t.id} is now ${toStatus}.`)
          }}
        >
          <b className="small">Change the status</b>
          <div className="grid2">
            <div className="field">
              <label htmlFor="bt-to">New status</label>
              <select
                className="input"
                id="bt-to"
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value as BaoStatus)}
              >
                {nextAllowed.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bt-pickup">Pickup date (optional)</label>
              <input
                className="input"
                id="bt-pickup"
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="bt-note">
              Reason or note (the student can see this
              {reqReason.length ? `. Required for ${reqReason.join(' and ')}` : ''})
            </label>
            <textarea
              className="input"
              id="bt-note"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={props.closeModal}>
              Close
            </button>
            <button type="submit" className="btn">
              Save status
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="note blue">
            <Icon name="info" />
            <span className="small">
              This ticket is {st}. No further change is allowed.
            </span>
          </div>
          <div className="row dlg-actions">
            <button type="button" className="btn ghost" onClick={props.closeModal}>
              Close
            </button>
          </div>
        </>
      )}
    </DialogShell>
  )
}

function BaoMoveDialog(
  props: ModalContentProps & {
    pid: string
    vid: string
    moveType: 'Stock In' | 'Adjustment' | 'Sold'
  },
) {
  const { baoApplyStockMove } = useTindahan()
  const p = props.db.official.find((x) => x.id === props.pid)
  const u = p ? baoUnit(p, props.vid) : null

  const [dir, setDir] = useState<'1' | '-1'>('1')
  const [qty, setQty] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  // FF-02: optional, and only meaningful for a sale.
  const [buyer, setBuyer] = useState<string>('')

  if (!p || !u) return null

  return (
    <DialogShell
      title={`${
        props.moveType === 'Stock In'
          ? 'Stock in: '
          : props.moveType === 'Sold'
            ? 'Record sale: '
            : 'Adjust stock: '
      }${baoUnitName(u)}`}
      onClose={props.closeModal}
    >
      <div className="note blue">
        <Icon name="info" />
        <span className="small">
          Now: {u.onHand} on hand, {baoReserved(u)} reserved, {u.available} available.
        </span>
      </div>

      {props.moveType === 'Sold' && (
        <p className="small muted" style={{ margin: 0 }}>
          A walk-in sale at the window: on hand and available both drop by the
          number sold, and the item's best-selling count moves. Naming the student
          is optional — with an address or student number the sale is theirs, and
          their limit is checked (the ordering window never applies at the counter).
        </p>
      )}

      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const q = parseInt(qty, 10)
          const sign = props.moveType === 'Adjustment' ? parseInt(dir, 10) || 1 : 1
          if (!(q >= 1)) {
            props.toast('Enter a whole number of units, 1 or more.')
            return
          }
          const r = baoApplyStockMove([
            {
              pid: props.pid,
              vid: props.vid,
              type: props.moveType,
              qty: q * sign,
              ...(props.moveType === 'Sold' && buyer.trim() ? { buyer: buyer.trim() } : {}),
              reason:
                reason.trim() ||
                (props.moveType === 'Stock In'
                  ? 'Stock in'
                  : props.moveType === 'Sold'
                    ? 'Walk-in sale'
                    : ''),
            },
          ])
          if (!r.ok) {
            props.toast(r.msg || 'Could not update stock.')
            return
          }
          props.closeModal()
          props.toast(
            props.moveType === 'Stock In'
              ? 'Stock added.'
              : props.moveType === 'Sold'
                ? 'Sale recorded.'
                : 'Stock adjusted.',
          )
        }}
      >
        {props.moveType === 'Sold' && (
          <div className="field">
            <label htmlFor="mv-buyer">Student (email or student number) — optional</label>
            <input
              id="mv-buyer"
              className="input"
              value={buyer}
              maxLength={120}
              placeholder="2024-200797 or 2024-200797@rtu.edu.ph"
              onChange={(e) => setBuyer(e.target.value)}
            />
            <span className="tiny muted">
              Leave it empty for a walk-in without an account.
            </span>
          </div>
        )}

        {props.moveType === 'Adjustment' && (
          <div className="field">
            <label htmlFor="mv-dir">Change</label>
            <select
              className="input"
              id="mv-dir"
              value={dir}
              onChange={(e) => setDir(e.target.value as '1' | '-1')}
            >
              <option value="1">Add to the count</option>
              <option value="-1">Remove from the count</option>
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="mv-q">Units</label>
          <input
            className="input tnum"
            id="mv-q"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="mv-r">
            {props.moveType === 'Adjustment'
              ? 'Reason (required)'
              : props.moveType === 'Sold'
                ? 'Note (optional, for example cash sale)'
                : 'Reason (optional, for example what arrived)'}
          </label>
          <textarea
            className="input"
            id="mv-r"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="row dlg-actions">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn">
            {props.moveType === 'Sold' ? 'Record sale' : 'Save'}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function BaoItemSettingsDialog(props: ModalContentProps & { pid: string }) {
  const {
    baoSaveItemSettings,
    baoStartItemSizes,
    baoAddItemSizeRow,
    baoRemoveItemSizeRow,
  } = useTindahan()

  const p = props.db.official.find((x) => x.id === props.pid)
  const curType = p ? baoItemType(props.db.bao, p) : null
  const inv = p?.inv || {
    type: curType?.id || 'ty-other',
    low: null,
    win: null,
    limit: 0,
    claimNote: '',
  }
  const win = inv.win || { enabled: false, start: '', end: '', message: '' }
  const vr = Boolean(p && hasVars(p) && p.vars)

  const [typeId, setTypeId] = useState<string>(curType?.id || 'ty-other')
  const [lowText, setLowText] = useState<string>(
    inv.low == null ? '' : String(inv.low),
  )
  const [winEnabled, setWinEnabled] = useState<boolean>(Boolean(win.enabled))
  const [winStart, setWinStart] = useState<string>(
    win.start ? String(win.start).slice(0, 16) : '',
  )
  const [winEnd, setWinEnd] = useState<string>(
    win.end ? String(win.end).slice(0, 16) : '',
  )
  const [winMsg, setWinMsg] = useState<string>(win.message || '')
  const [limitText, setLimitText] = useState<string>(String(inv.limit || 0))
  const [claimNote, setClaimNote] = useState<string>(inv.claimNote || '')
  const [varName, setVarName] = useState<string>(
    p && hasVars(p) && p.vars ? p.vars.attrs[0].name : 'Size',
  )
  const [rowLows, setRowLows] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    if (p && hasVars(p) && p.vars) {
      p.vars.rows.forEach((r) => {
        map[r.id] = r.low == null ? '' : String(r.low)
      })
    }
    return map
  })
  const [newSizeLabel, setNewSizeLabel] = useState<string>('')
  const [newSizeQty, setNewSizeQty] = useState<string>('0')
  const [firstSizeLabel, setFirstSizeLabel] = useState<string>('')

  if (!p) return null

  const parseIntOrNull = (val: string): number | null => {
    const trimmed = String(val).trim()
    if (!trimmed) return null
    const parsed = parseInt(trimmed, 10)
    return Number.isNaN(parsed) ? null : Math.max(0, parsed)
  }

  return (
    <DialogShell title={`Item settings: ${p.name}`} wide onClose={props.closeModal}>
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const parsedRowLows: Record<string, number | null> = {}
          Object.entries(rowLows).forEach(([rid, val]) => {
            parsedRowLows[rid] = parseIntOrNull(val)
          })
          const ok = baoSaveItemSettings(p.id, {
            typeId,
            low: parseIntOrNull(lowText),
            limit: parseInt(limitText, 10) || 0,
            claimNote,
            win: {
              enabled: winEnabled,
              start: winStart,
              end: winEnd,
              message: winMsg,
            },
            varAttrName: varName,
            rowLows: parsedRowLows,
          })
          if (ok) props.closeModal()
        }}
      >
        <div className="grid2">
          <div className="field">
            <label htmlFor="is-type">Item type</label>
            <select
              className="input"
              id="is-type"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              {props.db.bao.types
                .filter((x) => x.active || (curType && curType.id === x.id))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                    {x.active ? '' : ' (off)'}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="is-low">Low stock at (blank = no warning)</label>
            <input
              className="input tnum"
              id="is-low"
              type="number"
              min="0"
              value={lowText}
              onChange={(e) => setLowText(e.target.value)}
            />
          </div>
        </div>

        <div className="card flat stack" style={{ background: 'var(--bg)' }}>
          <b className="small">Ordering window for this item</b>
          <label className="row small" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={winEnabled}
              onChange={(e) => setWinEnabled(e.target.checked)}
            />
            Use an ordering window
          </label>
          <div className="grid2">
            <div className="field">
              <label htmlFor="is-ws">Opens</label>
              <input
                className="input"
                id="is-ws"
                type="datetime-local"
                value={winStart}
                onChange={(e) => setWinStart(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="is-wd">Closes</label>
              <input
                className="input"
                id="is-wd"
                type="datetime-local"
                value={winEnd}
                onChange={(e) => setWinEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="is-wm">Message shown to students (optional)</label>
            <input
              className="input"
              id="is-wm"
              maxLength={140}
              value={winMsg}
              onChange={(e) => setWinMsg(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="is-lim">Limit per student (0 = none)</label>
          <input
            className="input tnum"
            id="is-lim"
            type="number"
            min="0"
            value={limitText}
            style={{ maxWidth: 160 }}
            onChange={(e) => setLimitText(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="is-cn">
            Claim notes for this item (shown on the product page and on tickets)
          </label>
          <textarea
            className="input"
            id="is-cn"
            maxLength={300}
            placeholder="Leave empty until the BAO gives the wording"
            value={claimNote}
            onChange={(e) => setClaimNote(e.target.value)}
          />
        </div>

        {vr && p.vars ? (
          <>
            <div className="field">
              <label htmlFor="is-vn">What the variations are called</label>
              <input
                className="input"
                id="is-vn"
                maxLength={20}
                value={varName}
                style={{ maxWidth: 220 }}
                onChange={(e) => setVarName(e.target.value)}
              />
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <b className="small">{varName}s</b>
              {p.vars.rows.map((r) => {
                const u = baoUnit(p, r.id)
                return (
                  <div
                    key={r.id}
                    className="row between wrap"
                    style={{
                      gap: 8,
                      borderTop: '1px solid var(--line)',
                      paddingTop: 6,
                    }}
                  >
                    <span className="small">
                      <b>{varLabel(p, r)}</b>{' '}
                      {u && (
                        <span className="muted">
                          on hand {u.onHand}, reserved {baoReserved(u)}, available{' '}
                          {u.available}
                        </span>
                      )}
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <label className="tiny muted" htmlFor={`vl-${r.id}`}>
                        Low at
                      </label>
                      <input
                        className="input tnum"
                        id={`vl-${r.id}`}
                        type="number"
                        min="0"
                        value={rowLows[r.id] ?? (r.low == null ? '' : String(r.low))}
                        style={{ width: 80 }}
                        aria-label={`Low stock for ${varLabel(p, r)}`}
                        onChange={(e) =>
                          setRowLows((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn danger sm"
                        onClick={() => baoRemoveItemSizeRow(p.id, r.id)}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                )
              })}

              <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
                <div className="field">
                  <label htmlFor="nv-l">New {varName.toLowerCase()}</label>
                  <input
                    className="input"
                    id="nv-l"
                    maxLength={30}
                    value={newSizeLabel}
                    onChange={(e) => setNewSizeLabel(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="nv-q">Opening stock</label>
                  <input
                    className="input tnum"
                    id="nv-q"
                    type="number"
                    min="0"
                    value={newSizeQty}
                    style={{ width: 110 }}
                    onChange={(e) => setNewSizeQty(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    if (
                      baoAddItemSizeRow(
                        p.id,
                        newSizeLabel,
                        parseInt(newSizeQty, 10) || 0,
                      )
                    ) {
                      setNewSizeLabel('')
                      setNewSizeQty('0')
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="card flat stack" style={{ background: 'var(--bg)' }}>
            <b className="small">Track by size or variation</b>
            <p className="tiny muted">
              Move this item&rsquo;s stock into a first size. It needs nothing reserved by open
              tickets. The move is written to the ledger as two adjustments.
            </p>
            <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
              <div className="field">
                <label htmlFor="nv-first">Name of the first size or variation</label>
                <input
                  className="input"
                  id="nv-first"
                  maxLength={30}
                  value={firstSizeLabel}
                  onChange={(e) => setFirstSizeLabel(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  if (baoStartItemSizes(p.id, firstSizeLabel)) {
                    setFirstSizeLabel('')
                  }
                }}
              >
                Start tracking sizes
              </button>
            </div>
          </div>
        )}

        <div className="row dlg-actions">
          <button type="button" className="btn ghost" onClick={props.closeModal}>
            Close
          </button>
          <button type="submit" className="btn">
            Save settings
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function BaoEmailPreviewDialog(props: ModalContentProps & { emailId: string }) {
  const e = props.db.bao.outbox.find((x) => x.id === props.emailId)
  if (!e) return null

  return (
    <DialogShell title={`Prepared message ${e.id}`} onClose={props.closeModal}>
      <div className="note">
        <Icon name="lock" />
        <span className="small">
          Not sent. This is only a preview of what would be sent.
        </span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <div className="small">
          <span className="muted">To:</span>{' '}
          {e.to.length ? e.to.join(', ') : 'No address'}
        </div>
        <div className="small">
          <span className="muted">Subject:</span> <b>{e.subject}</b>
        </div>
      </div>
      <pre
        className="card flat"
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          fontFamily: 'inherit',
          fontSize: 13,
          background: 'var(--bg)',
          margin: 0,
        }}
      >
        {e.text}
      </pre>
      <div className="row dlg-actions">
        <button type="button" className="btn ghost" onClick={props.closeModal}>
          Close
        </button>
      </div>
    </DialogShell>
  )
}
