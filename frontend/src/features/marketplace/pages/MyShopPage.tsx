import { useMemo, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { baoItemType, baoReserved, baoUnits } from '../baoHelpers'
import { isSvc, peso, stamp } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { imgSrc } from '../imageStore'
import { API_ID_PREFIX, type ApiListing } from '../api/listings'
import { AvatarBadge } from '../components/AvatarBadge'
import { RatingText, StarsDisplay } from '../components/StarRating'
import './MyShopPage.css'

/** How one of the member's own listings reads on screen. */
function myListingState(listing: ApiListing): {
  label: string
  tone: string
} {
  if (listing.moderation_status === 'pending_screening')
    return { label: 'Waiting for approval', tone: 'yellow' }
  if (listing.moderation_status === 'needs_review')
    return { label: 'Needs review', tone: 'yellow' }
  if (listing.moderation_status === 'rejected')
    return { label: 'Rejected', tone: 'red' }
  if (listing.moderation_status === 'draft') return { label: 'Draft', tone: 'navy' }
  if (listing.availability_status === 'sold') return { label: 'Sold', tone: 'navy' }
  if (listing.availability_status !== 'available')
    return { label: 'Unavailable', tone: 'navy' }
  return { label: 'Live', tone: 'green' }
}

export function MyShopPage() {
  const {
    db,
    currentAccount,
    isStaffUser,
    shopTab,
    setShopTab,
    byId,
    acctByEmail,
    ratingOf,
    salesIndex,
    startEditListing,
    toggleSellerListingPause,
    deleteSellerListing,
    saveOfficialProduct,
    toggleHideOfficialProduct,
    deleteOfficialProduct,
    respondSellerRequest,
    openSellerRequestChat,
    toggleChecklist,
    continueSellerSetup,
    confirmDeleteReview,
    openModal,
    setDraft,
    setListStep,
    myListings,
    refreshMyListings,
    apiOrders,
    refreshOrders,
    actOnOrder,
    openThreadWith,
  } = useTindahan()

  // Quick inline edit state for Official RTU Store products in Admin | RTU Shop
  const [editId, setEditId] = useState<string | null>(null)
  const [opName, setOpName] = useState('')
  const [opType, setOpType] = useState('Uniform')
  const [opPrice, setOpPrice] = useState('')
  const [opStock, setOpStock] = useState('')
  const [opDesc, setOpDesc] = useState('')

  if (!currentAccount) return null

  const sellerList = currentAccount.sellerList || []
  const sellerReq = currentAccount.sellerReq || []
  // Requests that reached the server. These are what the seller actually
  // receives; the prototype's sellerReq only ever holds same-browser rows.
  const incomingApi = apiOrders.filter(
    (o) => o.seller_email === currentAccount.email,
  )
  const openApi = incomingApi.filter((o) => o.is_open)

  const views = sellerList.reduce((a, l) => a + l.views, 0)
  const reqs = sellerList.reduce((a, l) => a + l.req, 0)
  const rate = views ? Math.round((reqs / views) * 100) + '%' : '0%'
  const openReqs = sellerReq.filter(
    (r) => r.state === 'new' || r.state === 'accepted',
  )
  const newCount = sellerReq.filter((r) => r.state === 'new').length
  const pastReqs = sellerReq.filter(
    (r) => r.state === 'done' || r.state === 'declined',
  )
  const completedCount = sellerReq.filter((r) => r.state === 'done').length
  const pendingApproval = sellerList.filter((l) => l.status === 'Pending approval')
  const rejected = sellerList.filter((l) => l.status === 'Rejected')
  const maxViews = Math.max(1, ...sellerList.map((l) => l.views))

  const sellerKey = isStaffUser ? 'official' : currentAccount.email
  const sellerRating = ratingOf('seller', sellerKey)
  const myListingIds = useMemo(
    () =>
      new Set([
        ...db.userListings
          .filter((l) => l.ownerEmail === currentAccount.email)
          .map((l) => l.lid),
        ...(isStaffUser ? db.official.map((p) => p.id) : []),
      ]),
    [db.userListings, db.official, currentAccount.email, isStaffUser],
  )

  const shopReviews = useMemo(
    () =>
      db.reviews
        .filter(
          (r) =>
            (r.kind === 'seller' && r.sellerKey === sellerKey) ||
            (r.kind === 'item' && r.pid && myListingIds.has(r.pid)),
        )
        .sort((a, b) => b.ts - a.ts),
    [db.reviews, sellerKey, myListingIds],
  )

  const sellerDirectReviews = useMemo(
    () => db.reviews.filter((r) => r.kind === 'seller' && r.sellerKey === sellerKey),
    [db.reviews, sellerKey],
  )

  // Active BAO item types for Official RTU Store editing
  const activeTypeNames = db.bao.types.filter((t) => t.active).map((t) => t.name)
  const typeOptions =
    opType && !activeTypeNames.includes(opType)
      ? [opType, ...activeTypeNames]
      : activeTypeNames

  const totalListingsCount = isStaffUser
    ? db.official.length + sellerList.filter((l) => !db.official.some((o) => o.id === l.lid)).length
    : sellerList.length

  const renderReqRow = (r: (typeof sellerReq)[number]) => (
    <div
      key={r.id}
      className="row between wrap"
      style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}
    >
      <div>
        <div className="row wrap" style={{ gap: 6 }}>
          <b>{r.who}</b>
          <span className="muted small">wants</span>
          <b>{r.what}</b>
          <span
            className={`pill ${
              r.state === 'accepted'
                ? 'green'
                : r.state === 'done'
                  ? 'blue'
                  : r.state === 'declined'
                    ? 'red'
                    : 'yellow'
            }`}
          >
            {r.state === 'done'
              ? r.fulfillment === 'delivery'
                ? 'Delivered'
                : 'Picked up'
              : r.state === 'new'
                ? 'New request'
                : r.state}
          </span>
          <span className={`pill ${r.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
            {r.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
          </span>
        </div>
        <div className="tiny muted">
          {r.fulfillment === 'delivery' ? 'Delivery schedule:' : 'Proposed meetup:'} {r.when} · Cash in person {peso(r.amt)}
        </div>
      </div>

      {r.proofPhoto && imgSrc(r.proofPhoto) && (
        <div
          className="row"
          style={{
            gap: 8,
            background: 'var(--bg)',
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--line)',
          }}
        >
          <img
            src={imgSrc(r.proofPhoto)}
            alt="Meetup proof"
            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }}
          />
          <div>
            <span className="pill green" style={{ fontSize: 10 }}>
              Proof photo attached
            </span>
            <div className="tiny muted">
              By {r.proofBy || r.who}
              {r.proofAt ? ` · ${stamp(r.proofAt)}` : ''}
            </div>
          </div>
        </div>
      )}

      <div className="row wrap">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => openSellerRequestChat(r.id)}
        >
          <Icon name="msg" size="sm" />
          Message
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() =>
            openModal({
              kind: 'order-report',
              orderId: r.orderId,
              role: 'seller',
              targetEmail: r.buyerEmail,
              targetName: r.who,
              itemTitle: r.what,
            })
          }
        >
          <Icon name="flag" size="sm" />
          Report buyer
        </button>
        {r.state === 'new' ? (
          <>
            <button
              type="button"
              className="btn sm"
              onClick={() => respondSellerRequest(r.id, 'accept')}
            >
              Accept
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => respondSellerRequest(r.id, 'decline')}
            >
              Decline
            </button>
          </>
        ) : r.state === 'accepted' ? (
          <>
            <button
              type="button"
              className="btn sm"
              onClick={() => respondSellerRequest(r.id, 'done')}
            >
              <Icon name="check" size="sm" />
              Mark picked up
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => respondSellerRequest(r.id, 'undo')}
            >
              Undo
            </button>
          </>
        ) : r.state === 'done' ? (
          <span className="tiny muted">Completed</span>
        ) : (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => respondSellerRequest(r.id, 'undo')}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="row between wrap">
        <div>
          <span className="eyebrow">{isStaffUser ? 'ADMIN | RTU SHOP' : 'MY SHOP'}</span>
          <h1>{isStaffUser ? 'Admin | RTU Shop' : 'Seller dashboard'}</h1>
          <p className="muted small">
            {isStaffUser
              ? 'Manage Official RTU Store products, publish new official items via Admin | Sell an Item, and review incoming requests.'
              : 'Track your listings, answer incoming meetup requests and see how your shop is doing.'}
          </p>
          <div className="small" style={{ marginTop: 4 }}>
            {isStaffUser ? 'Official RTU Store rating: ' : 'Your seller rating: '}
            <RatingText kind="seller" targetKey={sellerKey} />
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {isStaffUser && (
            <>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => navigate('baoorders')}
              >
                <Icon name="bag" size="sm" />
                Store orders
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => navigate('baostock')}
              >
                <Icon name="tag" size="sm" />
                Store inventory
              </button>
            </>
          )}
          <button
            type="button"
            className="btn yellow"
            onClick={() => {
              setDraft((prev) => (prev.editLid ? prev : { ...prev, type: 'product' }))
              setListStep(1)
              navigate('create')
            }}
          >
            <Icon name="plus" size="sm" />
            {isStaffUser ? 'Admin | Sell an Item' : 'New listing'}
          </button>
        </div>
      </div>

      {/* Shop tabs */}
      <div className="tabs shop-tabs" role="tablist" aria-label="My shop sections">
        {(
          [
            ['overview', 'Overview', ''],
            [
              'orders',
              'Incoming orders',
              newCount
                ? `${newCount} new`
                : String(openApi.length || openReqs.length),
            ],
            [
              'listings',
              isStaffUser ? 'Official store products' : 'Listings',
              String(totalListingsCount),
            ],
            ['reviews', 'Shop ratings', String(shopReviews.length)],
          ] as const
        ).map((t) => (
          <button
            key={t[0]}
            type="button"
            className={`tab ${shopTab === t[0] ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={shopTab === t[0]}
            onClick={() => setShopTab(t[0])}
          >
            {t[1]}
            {t[2] !== '' && (
              <span
                className={
                  t[0] === 'orders' && (newCount || openApi.length)
                    ? 'pill yellow'
                    : 'tnum muted'
                }
              >
                {t[0] === 'orders' && (newCount || openApi.length)
                  ? t[2]
                  : ` (${t[2]})`}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {shopTab === 'overview' && (
        <>
          {pendingApproval.length > 0 && (
            <div className="note" role="status">
              <Icon name="clock" />
              <span>
                <b>
                  {pendingApproval.length} listing
                  {pendingApproval.length === 1 ? ' is' : 's are'} waiting for staff approval:
                </b>{' '}
                {pendingApproval.map((l) => l.name).join(', ')}. Buyers will see{' '}
                {pendingApproval.length === 1 ? 'it' : 'them'} once a moderator approves{' '}
                {pendingApproval.length === 1 ? 'it' : 'them'}.
              </span>
            </div>
          )}

          {rejected.length > 0 && (
            <div
              className="note"
              role="status"
              style={{ background: 'var(--red-bg)', borderColor: 'transparent' }}
            >
              <Icon name="info" />
              <span>
                <b>
                  {rejected.length} listing{rejected.length === 1 ? ' was' : 's were'} not approved:
                </b>{' '}
                {rejected.map((l) => l.name).join(', ')}. Check your Messages inbox or notifications to read the administrator’s review and reply.
              </span>
            </div>
          )}

          {/* 4 KPI cards matching prototype SCREENS.seller */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
            }}
          >
            {(
              isStaffUser
                ? ([
                    [
                      'Official products on sale',
                      `${db.official.filter((p) => !p.hidden).length} of ${db.official.length}`,
                      'Live in the Official RTU Store',
                    ],
                    [
                      'Listing views',
                      String(views),
                      views ? 'From students who opened items' : 'Tracked across store items',
                    ],
                    [
                      'Open store requests',
                      String(
                        db.txn.filter(
                          (t) =>
                            t.type === 'official' &&
                            !t.sellerEmail &&
                            (t.status === 'Pending' || t.status === 'Confirmed'),
                        ).length,
                      ),
                      'Managed in Store orders',
                    ],
                    ['Completed pickups', String(completedCount), 'Confirmed on campus'],
                  ] as const)
                : ([
                    [
                      'Listing views',
                      String(views),
                      views ? 'From students who opened your items' : 'Views appear once approved',
                    ],
                    [
                      'Request rate',
                      rate,
                      reqs ? `${reqs} request${reqs === 1 ? '' : 's'} received` : 'No requests yet',
                    ],
                    [
                      'Open orders',
                      String(openReqs.length),
                      openReqs.length ? 'Waiting for you below' : 'Nothing waiting',
                    ],
                    ['Completed pickups', String(completedCount), 'Confirmed on campus'],
                  ] as const)
            ).map((k) => (
              <div key={k[0]} className="card stack" style={{ gap: 4 }}>
                <span className="small muted">{k[0]}</span>
                <b className="tnum" style={{ fontSize: 24 }}>
                  {k[1]}
                </b>
                <span className="tiny" style={{ color: 'var(--green)' }}>
                  {k[2]}
                </span>
              </div>
            ))}
          </div>

          {/* Requests from other students. These live on the server, which is
              what makes them appear here at all — they used to be written into
              the buyer's own browser and never arrived. */}
          {(() => {
            const incoming = apiOrders.filter(
              (o) => o.seller_email === currentAccount.email,
            )
            if (!incoming.length) return null
            return (
              <div className="card stack">
                <div className="row between">
                  <b>Incoming requests</b>
                  <span className="tiny muted">{incoming.length} total</span>
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  {incoming.map((order) => (
                    <div
                      key={order.reference}
                      className="row between wrap small"
                      style={{ gap: 8 }}
                    >
                      <span style={{ overflowWrap: 'anywhere', flex: 1 }}>
                        <b>{order.reference}</b> · {order.buyer_name} ·{' '}
                        {order.lines
                          .map((l) => `${l.quantity} × ${l.title}`)
                          .join(', ')}{' '}
                        · {peso(Number(order.total_amount))}{' '}
                        <span className="tiny muted">
                          {order.meetup_place || 'Pickup'}
                        </span>
                      </span>
                      <span
                        className={`pill ${
                          order.status === 'requested'
                            ? 'yellow'
                            : order.status === 'accepted'
                              ? 'green'
                              : order.status === 'completed'
                                ? 'navy'
                                : 'red'
                        }`}
                      >
                        {order.status_display}
                      </span>
                      {order.status === 'requested' && (
                        <>
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => void actOnOrder(order.reference, 'accepted')}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn ghost sm"
                            onClick={() => void actOnOrder(order.reference, 'declined')}
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {order.status === 'accepted' && (
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => void actOnOrder(order.reference, 'completed')}
                        >
                          Mark completed
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => void refreshOrders()}
                >
                  Refresh
                </button>
              </div>
            )
          })()}

          {/* The marketplace only shows published rows, so a listing that is
              still waiting for approval would otherwise disappear from the
              seller's view the moment they posted it. */}
          <div className="card stack">
            <div className="row between">
              <b>My listings</b>
              <span className="tiny muted">
                {myListings.length
                  ? `${myListings.length} total`
                  : 'Nothing posted yet'}
              </span>
            </div>
            {myListings.length ? (
              <>
                <div className="stack" style={{ gap: 10 }}>
                  {myListings.map((listing) => {
                    const state = myListingState(listing)
                    return (
                      <div
                        key={listing.slug}
                        className="row between small"
                        style={{ gap: 10 }}
                      >
                        <span style={{ overflowWrap: 'anywhere', flex: 1 }}>
                          {listing.title}
                          <span className="tiny muted">
                            {' '}
                            · {peso(Number(listing.price))}
                          </span>
                        </span>
                        <span className={`pill ${state.tone}`}>{state.label}</span>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => {
                            navigate(`product?id=${API_ID_PREFIX}${listing.slug}`)
                          }}
                        >
                          Open
                        </button>
                      </div>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => void refreshMyListings()}
                >
                  Refresh
                </button>
              </>
            ) : (
              <p className="small muted">
                A listing appears here the moment you post it, and stays while it
                waits for approval.
              </p>
            )}
          </div>

          {/* Requirement #1: Removed ADMIN | RTU Shop Guide for staff; keep First-time seller guide for students */}
          {isStaffUser ? (
            <div className="card stack">
              <div className="row between">
                <b>Views by listing</b>
                <span className="tiny muted">Since you posted each item</span>
              </div>
              {sellerList.length ? (
                <div className="stack" style={{ gap: 10 }}>
                  {sellerList.map((l, i) => (
                    <div key={`${l.lid || l.name}-${i}`} className="stack" style={{ gap: 4 }}>
                      <div className="row between small">
                        <span style={{ overflowWrap: 'anywhere' }}>{l.name}</span>
                        <span className="tnum muted">
                          {l.views} view{l.views === 1 ? '' : 's'} · {l.req} req
                        </span>
                      </div>
                      <div style={{ height: 8, background: 'var(--soft)', borderRadius: 6 }}>
                        <div
                          style={{
                            width: `${Math.round((l.views / maxViews) * 100)}%`,
                            height: 8,
                            background: 'var(--blue)',
                            borderRadius: 6,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small muted">
                  Post a listing to see how many students view and request it.
                </p>
              )}
            </div>
          ) : (
            <div className="seller-overview-two two">
              <div
                className="card stack"
                style={{ background: 'var(--navy)', color: '#fff', border: 0 }}
              >
                <span className="pill yellow" style={{ alignSelf: 'flex-start' }}>
                  First-time seller guide
                </span>
                <h3>Build trust from your first listing</h3>
                <p className="small" style={{ opacity: 0.85 }}>
                  Finish these three quick steps so buyers know who they are meeting.
                </p>
                {(
                  [
                    ['profile', 'Profile verified (RTU email & student ID)'],
                    ['pickup', 'Pickup location added'],
                    ['rules', 'Read prohibited items guide'],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="check" style={{ color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(currentAccount.checklist[k])}
                      onChange={(e) => toggleChecklist(k, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
                <button
                  type="button"
                  className="btn yellow block"
                  onClick={continueSellerSetup}
                >
                  Continue setup
                </button>
              </div>

              <div className="card stack">
                <div className="row between">
                  <b>Views by listing</b>
                  <span className="tiny muted">Since you posted each item</span>
                </div>
                {sellerList.length ? (
                  <div className="stack" style={{ gap: 10 }}>
                    {sellerList.map((l, i) => (
                      <div key={`${l.lid || l.name}-${i}`} className="stack" style={{ gap: 4 }}>
                        <div className="row between small">
                          <span style={{ overflowWrap: 'anywhere' }}>{l.name}</span>
                          <span className="tnum muted">
                            {l.views} view{l.views === 1 ? '' : 's'} · {l.req} req
                          </span>
                        </div>
                        <div style={{ height: 8, background: 'var(--soft)', borderRadius: 6 }}>
                          <div
                            style={{
                              width: `${Math.round((l.views / maxViews) * 100)}%`,
                              height: 8,
                              background: 'var(--blue)',
                              borderRadius: 6,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">
                    Post a listing to see how many students view and request it.
                  </p>
                )}
              </div>
            </div>
          )}

          {openApi.length > 0 && (
            <div className="card stack">
              <div className="row between wrap">
                <b>Incoming orders waiting for you ({openApi.length})</b>
                <button
                  type="button"
                  className="link"
                  onClick={() => setShopTab('orders')}
                >
                  Open Incoming orders
                </button>
              </div>
              {openApi.slice(0, 3).map((order) => (
                <div key={order.reference} className="row between wrap small" style={{ gap: 8 }}>
                  <span style={{ overflowWrap: 'anywhere', flex: 1 }}>
                    <b>{order.reference}</b> · {order.buyer_name} ·{' '}
                    {order.lines.map((l) => `${l.quantity} × ${l.title}`).join(', ')}
                  </span>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => void actOnOrder(order.reference, 'accepted')}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => void actOnOrder(order.reference, 'declined')}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      void openThreadWith({
                        buyerEmail: order.buyer_email,
                        listingSlug: order.lines[0]?.listing_slug || null,
                      })
                    }
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          )}

          {openReqs.length > 0 && (
            <div className="card stack">
              <div className="row between wrap">
                <b>Incoming orders waiting for you ({openReqs.length})</b>
                <button
                  type="button"
                  className="link"
                  onClick={() => setShopTab('orders')}
                >
                  Open Incoming orders
                </button>
              </div>
              {openReqs.slice(0, 3).map(renderReqRow)}
            </div>
          )}
        </>
      )}

      {/* Incoming orders tab */}
      {shopTab === 'orders' && (
        <>
          <div className="card stack">
            <div className="row between wrap">
              <div>
                <b>Open orders and meetup requests</b>
                <p className="small muted">
                  Accept to confirm the campus meetup, or message the buyer to agree on a time.
                </p>
              </div>
              <span className="pill">{openApi.length || openReqs.length} open</span>
            </div>
            {incomingApi.length ? (
              <div className="stack" style={{ gap: 10 }}>
                {incomingApi.map((order) => (
                  <div
                    key={order.reference}
                    className="row between wrap small"
                    style={{ gap: 8 }}
                  >
                    <span style={{ overflowWrap: 'anywhere', flex: 1 }}>
                      <b>{order.reference}</b> · {order.buyer_name} ·{' '}
                      {order.lines
                        .map((l) => `${l.quantity} × ${l.title}`)
                        .join(', ')}{' '}
                      · {peso(Number(order.total_amount))}{' '}
                      <span className="tiny muted">
                        {order.meetup_place || 'Pickup'}
                      </span>
                    </span>
                    <span
                      className={`pill ${
                        order.status === 'requested'
                          ? 'yellow'
                          : order.status === 'accepted'
                            ? 'green'
                            : order.status === 'completed'
                              ? 'navy'
                              : 'red'
                      }`}
                    >
                      {order.status_display}
                    </span>
                    {order.status === 'requested' && (
                      <>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => void actOnOrder(order.reference, 'accepted')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => void actOnOrder(order.reference, 'declined')}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => void actOnOrder(order.reference, 'completed')}
                      >
                        Mark completed
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() =>
                        void openThreadWith({
                          buyerEmail: order.buyer_email,
                          listingSlug: order.lines[0]?.listing_slug || null,
                        })
                      }
                    >
                      Message
                    </button>
                  </div>
                ))}
              </div>
            ) : openReqs.length ? (
              openReqs.map(renderReqRow)
            ) : (
              <p className="small muted">
                No open requests right now. When a student reserves one of your items or services,
                it appears here.
              </p>
            )}
          </div>

          <div className="card stack">
            <div className="row between wrap">
              <b>Past requests</b>
              <span className="tiny muted tnum">{pastReqs.length}</span>
            </div>
            {pastReqs.length ? (
              pastReqs.map(renderReqRow)
            ) : (
              <p className="small muted">Completed and declined requests are kept here.</p>
            )}
          </div>
        </>
      )}

      {/* Listings tab */}
      {shopTab === 'listings' && (
        <div className="stack">
          {/* Requirement #2: Official RTU Store products rendered in the clean table UI matching Your listings */}
          {isStaffUser && (
            <>
              {editId && (
                <form
                  className="card stack"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (
                      saveOfficialProduct({
                        id: editId,
                        name: opName,
                        tag: opType,
                        price: Number(opPrice),
                        stock: Number(opStock),
                        desc: opDesc,
                      })
                    ) {
                      setEditId(null)
                      setOpName('')
                      setOpType(activeTypeNames[0] || 'Uniform')
                      setOpPrice('')
                      setOpStock('')
                      setOpDesc('')
                    }
                  }}
                >
                  <div className="row between wrap">
                    <div>
                      <b>Quick edit official store product</b>
                      <p className="small muted">
                        Changes show right away in the Official RTU Store, the category lists, and
                        the marketplace counts.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => startEditListing(editId)}
                    >
                      Open full editor (photos & variations)
                    </button>
                  </div>
                  <div className="grid2">
                    <div className="field">
                      <label htmlFor="op-n">Product name</label>
                      <input
                        className="input"
                        id="op-n"
                        value={opName}
                        placeholder="Name of the item"
                        onChange={(e) => setOpName(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="op-t">Type</label>
                      <select
                        className="input"
                        id="op-t"
                        value={opType}
                        onChange={(e) => setOpType(e.target.value)}
                      >
                        {typeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid2">
                    <div className="field">
                      <label htmlFor="op-p">Price (₱)</label>
                      <input
                        className="input tnum"
                        id="op-p"
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={opPrice}
                        onChange={(e) => setOpPrice(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="op-s">In stock</label>
                      <input
                        className="input tnum"
                        id="op-s"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={opStock}
                        readOnly
                        title="Stock is changed in Store inventory"
                      />
                      <span className="tiny muted">
                        Available now. Change stock in{' '}
                        <button
                          type="button"
                          className="link"
                          onClick={() => navigate('baostock')}
                        >
                          Store inventory
                        </button>
                        .
                      </span>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="op-d">Short description</label>
                    <textarea
                      className="input"
                      id="op-d"
                      placeholder="Sizes, edition or other details"
                      value={opDesc}
                      onChange={(e) => setOpDesc(e.target.value)}
                    />
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setEditId(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn">
                      Save changes
                    </button>
                  </div>
                </form>
              )}

              <div className="card stack">
                <div className="row between wrap">
                  <div>
                    <b>Official RTU Store products</b>
                    <p className="small muted">
                      Official products you have posted. Edit details, publish/hide, or remove an
                      item at any time.
                    </p>
                  </div>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        setDraft((prev) => (prev.editLid ? prev : { ...prev, type: 'product' }))
                        setListStep(1)
                        navigate('create')
                      }}
                    >
                      <Icon name="plus" size="sm" />
                      Admin | Sell an Item
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => navigate('baostock')}
                    >
                      Store inventory
                    </button>
                  </div>
                </div>

                {db.official.length ? (
                  <div className="scroll-x">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Stock</th>
                          <th>Reserved / Req</th>
                          <th>Available</th>
                          <th>Sold</th>
                          <th>Views</th>
                          <th>Price</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {db.official.map((p) => {
                          const it = baoItemType(db.bao, p)
                          const typeName = it ? it.name : p.tag || 'Official'
                          const sl = sellerList.find((l) => l.lid === p.id)
                          const itemViews = sl ? sl.views : 0
                          const units = baoUnits(p)
                          const onHand = units.reduce((a, u) => a + u.onHand, 0)
                          const available = units.reduce((a, u) => a + u.available, 0)
                          const reserved = units.reduce((a, u) => a + baoReserved(u), 0)
                          const sold = salesIndex.get(p.id)?.units || 0
                          return (
                            <tr key={p.id}>
                              <td>
                                <b>{p.name}</b>
                              </td>
                              <td>
                                <span
                                  className={`pill ${
                                    typeName === 'Uniform' ? 'blue' : ''
                                  }`.trim()}
                                >
                                  {typeName}
                                </span>
                              </td>
                              <td>
                                <span className={`pill ${p.hidden ? 'yellow' : 'green'}`}>
                                  {p.hidden ? 'Hidden' : 'On sale'}
                                </span>
                              </td>
                              <td className="tnum" title={`${available} available + ${reserved} reserved = ${onHand} on hand`}>
                                <b>{onHand}</b>
                              </td>
                              <td className="tnum">
                                <span className={`pill ${reserved > 0 ? 'yellow' : ''}`.trim()}>
                                  {reserved}
                                </span>
                              </td>
                              <td className="tnum">
                                <b style={{ color: available > 0 ? 'var(--green)' : 'var(--red)' }}>
                                  {available}
                                </b>
                              </td>
                              <td className="tnum">
                                <span className={`pill ${sold > 0 ? 'blue' : ''}`.trim()}>
                                  {sold}
                                </span>
                              </td>
                              <td className="tnum">{itemViews}</td>
                              <td className="tnum">{peso(p.price)}</td>
                              <td>
                                <div className="row wrap" style={{ gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn ghost sm"
                                    onClick={() => navigate(`product?id=${p.id}`)}
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="btn ghost sm"
                                    onClick={() => {
                                      setEditId(p.id)
                                      setOpName(p.name)
                                      setOpType(typeName)
                                      setOpPrice(String(p.price))
                                      setOpStock(String(p.left))
                                      setOpDesc(p.desc || '')
                                      window.scrollTo({ top: 0, behavior: 'smooth' })
                                    }}
                                  >
                                    Quick edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn ghost sm"
                                    onClick={() => startEditListing(p.id)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn ghost sm"
                                    onClick={() => toggleHideOfficialProduct(p.id)}
                                  >
                                    {p.hidden ? 'Publish' : 'Hide'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn danger sm"
                                    onClick={() => deleteOfficialProduct(p.id)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="small muted">
                    No official products yet. Use “Admin | Sell an Item” to post an official
                    product.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Standard Listings table (for students, or any additional services posted by staff) */}
          {(!isStaffUser ||
            sellerList.some((l) => !db.official.some((o) => o.id === l.lid))) && (
            <div className="card stack">
              <div className="row between wrap">
                <div>
                  <b>{isStaffUser ? 'Your services & other listings' : 'Your listings'}</b>
                  <p className="small muted">
                    Products and services you have posted. Edit details, pause or remove an item at
                    any time.
                  </p>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setDraft((prev) => (prev.editLid ? prev : { ...prev, type: 'product' }))
                      setListStep(1)
                      navigate('create')
                    }}
                  >
                    <Icon name="plus" size="sm" />
                    {isStaffUser ? 'Admin | Sell an Item' : 'Add listing'}
                  </button>
                  {sellerList.length > 0 && (
                    <button
                      type="button"
                      className="link"
                      onClick={() => openModal({ kind: 'manage-listings' })}
                    >
                      Manage all
                    </button>
                  )}
                </div>
              </div>

              {sellerList.filter((l) => !isStaffUser || !db.official.some((o) => o.id === l.lid))
                .length ? (
                <div className="scroll-x">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Stock</th>
                        <th>Reserved / Req</th>
                        <th>Available</th>
                        <th>Sold</th>
                        <th>Views</th>
                        <th>Price</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerList.map((l, i) => {
                        if (isStaffUser && db.official.some((o) => o.id === l.lid)) return null
                        const p = l.lid ? byId(l.lid) : undefined
                        const sv = p && isSvc(p)
                        const available = sv ? null : p ? p.left : 0
                        const reserved = l.lid
                          ? db.txn
                              .filter(
                                (t) =>
                                  t.status === 'Pending' || t.status === 'Confirmed',
                              )
                              .reduce(
                                (acc, t) =>
                                  acc +
                                  (t.lines || [])
                                    .filter((ln) => ln.pid === l.lid)
                                    .reduce((s, ln) => s + ln.qty, 0),
                                0,
                              )
                          : 0
                        const sold = l.lid ? salesIndex.get(l.lid)?.units || 0 : 0
                        const totalStock =
                          available === null ? null : available + reserved
                        return (
                          <tr key={`${l.lid || l.name}-${i}`}>
                            <td>
                              <b>{l.name}</b>
                            </td>
                            <td>
                              <span className={`pill ${sv ? 'purple' : ''}`.trim()}>
                                {sv ? 'Service' : 'Product'}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`pill ${
                                  l.status === 'Active'
                                    ? 'green'
                                    : l.status === 'Rejected' || l.status === 'Removed'
                                      ? 'red'
                                      : 'yellow'
                                }`}
                              >
                                {l.status}
                              </span>
                            </td>
                            <td className="tnum">
                              {sv ? (
                                <span className="tiny muted">By schedule</span>
                              ) : (
                                <b>{totalStock}</b>
                              )}
                            </td>
                            <td className="tnum">
                              <span className={`pill ${reserved > 0 ? 'yellow' : ''}`.trim()}>
                                {reserved}
                              </span>
                            </td>
                            <td className="tnum">
                              {sv ? (
                                <span className="tiny muted">Open</span>
                              ) : (
                                <b
                                  style={{
                                    color:
                                      (available || 0) > 0 ? 'var(--green)' : 'var(--red)',
                                  }}
                                >
                                  {available}
                                </b>
                              )}
                            </td>
                            <td className="tnum">
                              <span className={`pill ${sold > 0 ? 'blue' : ''}`.trim()}>
                                {sold}
                              </span>
                            </td>
                            <td className="tnum">{l.views}</td>
                            <td className="tnum">{peso(l.price)}</td>
                            <td>
                              <div className="row wrap" style={{ gap: 6 }}>
                                {l.lid && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn ghost sm"
                                      onClick={() => navigate(`product?id=${l.lid}`)}
                                    >
                                      View
                                    </button>
                                    <button
                                      type="button"
                                      className="btn ghost sm"
                                      onClick={() => startEditListing(l.lid!)}
                                    >
                                      Edit
                                    </button>
                                  </>
                                )}
                                {(l.status === 'Active' || l.status === 'Paused') && (
                                  <button
                                    type="button"
                                    className="btn ghost sm"
                                    onClick={() => toggleSellerListingPause(i)}
                                  >
                                    {l.status === 'Active' ? 'Pause' : 'Resume'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn danger sm"
                                  onClick={() => deleteSellerListing(i)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small muted">
                  You have no listings yet. Use “Sell an item” to post your first product or
                  service.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shop ratings tab */}
      {shopTab === 'reviews' && (
        <div className="card stack">
          <div className="row between wrap">
            <div>
              <b>Shop ratings and reviews</b>
              <p className="small muted">
                Ratings from buyers who completed a pickup with you, for your shop and for your
                items.
              </p>
            </div>
            <div>
              <RatingText kind="seller" targetKey={sellerKey} />
            </div>
          </div>

          {sellerDirectReviews.length > 0 && (
            <div className="shop-rate-grid">
              <div className="row" style={{ gap: 10 }}>
                <b className="tnum" style={{ fontSize: 30 }}>
                  {sellerRating.avg.toFixed(1)}
                </b>
                <div>
                  <StarsDisplay avg={sellerRating.avg} />
                  <div className="tiny muted tnum">
                    {sellerRating.n} seller {sellerRating.n === 1 ? 'rating' : 'ratings'}
                  </div>
                </div>
              </div>
              <div className="stack" style={{ gap: 4 }}>
                {[5, 4, 3, 2, 1].map((s) => {
                  const c = sellerDirectReviews.filter((r) => r.stars === s).length
                  return (
                    <div key={s} className="row tiny" style={{ gap: 6 }}>
                      <span className="tnum" style={{ width: 28 }}>
                        {s} ★
                      </span>
                      <div className="bar">
                        <div
                          style={{
                            width: `${Math.round((c / sellerRating.n) * 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className="tnum muted"
                        style={{ width: 24, textAlign: 'right' }}
                      >
                        {c}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {shopReviews.length ? (
            <div className="stack" style={{ gap: 10 }}>
              {shopReviews.map((x) => {
                const p = x.kind === 'item' && x.pid ? byId(x.pid) : undefined
                const reviewerAcct = acctByEmail(x.buyerEmail)
                return (
                  <div
                    key={x.id}
                    className="card flat stack"
                    style={{ gap: 6, background: 'var(--bg)' }}
                  >
                    <div className="row between wrap">
                      <span className="row wrap" style={{ gap: 8 }}>
                        <AvatarBadge
                          account={reviewerAcct}
                          name={x.buyerName}
                          size="sm"
                        />
                        <b>{x.buyerName}</b>
                        <span className="pill green">Verified pickup</span>
                        <span className="pill">
                          {x.kind === 'seller'
                            ? 'Seller rating'
                            : `Item: ${p ? p.name : 'Listing'}`}
                        </span>
                        <StarsDisplay avg={x.stars} />
                      </span>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="tiny muted">
                          {new Date(x.ts).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {rDateSuffix(x.edited)}
                        </span>
                        {isStaffUser && (
                          <button
                            type="button"
                            className="link"
                            style={{ color: 'var(--red)' }}
                            onClick={() => confirmDeleteReview(x.id)}
                          >
                            Remove
                          </button>
                        )}
                      </span>
                    </div>
                    {x.text ? (
                      <p className="small" style={{ overflowWrap: 'anywhere' }}>
                        {x.text}
                      </p>
                    ) : (
                      <p className="tiny muted">Rated with stars only.</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="small muted">
              No ratings yet. After a buyer completes a pickup, they can rate you and the item from
              My Orders.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function rDateSuffix(edited?: number | null): string {
  return edited ? ' · edited' : ''
}
