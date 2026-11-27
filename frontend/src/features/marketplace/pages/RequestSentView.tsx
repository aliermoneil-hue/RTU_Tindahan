import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { ItemTitleWithVariant } from '@/common/components/ItemTitleWithVariant'
import { imgSrc, imgsOf } from '../imageStore'
import { peso } from '../constants'
import type { OrderRecord, PrototypeProduct } from '../types'

interface RequestSentViewProps {
  batchOrders: OrderRecord[]
  byId: (id?: string | null) => PrototypeProduct | undefined
  remainingCartCount: number
  onMessageSeller: (order: OrderRecord) => void
  onTrackOrders: () => void
  onBackToMarketplace: () => void
  onBackToCart: () => void
}

export function RequestSentView({
  batchOrders,
  byId,
  remainingCartCount,
  onMessageSeller,
  onTrackOrders,
  onBackToMarketplace,
  onBackToCart,
}: RequestSentViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    batchOrders[0]?.id ?? null
  )

  useEffect(() => {
    setExpandedId(batchOrders[0]?.id ?? null)
  }, [batchOrders])

  const totalUnits = batchOrders.reduce(
    (acc, o) => acc + (o.lines?.reduce((s, l) => s + l.qty, 0) ?? 0),
    0
  )
  const totalAcrossBatch = batchOrders.reduce((acc, o) => acc + o.total, 0)

  const thumbnailFor = (ord: OrderRecord) => {
    const product = ord.lines?.[0] ? byId(ord.lines[0].pid) : undefined
    if (!product) return <Icon name="tag" />
    return imgsOf(product).length ? (
      <img className="pimg" src={imgSrc(imgsOf(product)[0])} alt={product.name} />
    ) : (
      <Icon name={(product.icon || 'tag') as import('@/common/components/icons').IconName} />
    )
  }

  const fulfillmentPill = (ord: OrderRecord) => (
    <span className={`pill ${ord.fulfillment === 'delivery' ? 'blue' : 'green'}`}>
      {ord.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
    </span>
  )

  return (
    <div className="cart-two two">
      {/* Left column — expandable order cards */}
      <div className="stack">
        {batchOrders.map((ord) => {
          const isExpanded = expandedId === ord.id
          const isDelivery = ord.fulfillment === 'delivery'
          const cleanWhen = ord.when.replace(/^(Pickup|Delivery)\s*·\s*/i, '')
          return (
            <div
              key={ord.id}
              className={`card stack sent-card ${isExpanded ? 'expanded' : ''}`}
            >
              <button
                type="button"
                className="sent-card-head row between wrap"
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : ord.id)}
              >
                <div className="row wrap" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
                  <div className="photo cart-photo" style={{ flex: 'none' }}>
                    {thumbnailFor(ord)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <ItemTitleWithVariant
                      as="b"
                      title={ord.title}
                      style={{ overflowWrap: 'anywhere', display: 'block', marginBottom: 2 }}
                    />
                    <div className="row wrap" style={{ gap: 6, marginBottom: 2 }}>
                      <span className="pill">#{ord.id}</span>
                      {fulfillmentPill(ord)}
                    </div>
                    <div className="small muted">Seller: {ord.seller}</div>
                    <span className="price tnum">{peso(ord.total)}</span>
                  </div>
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <span className="tiny muted">
                    {isExpanded ? 'Hide details' : 'View details'}
                  </span>
                  <Icon name="chev" size="sm" className="sent-chev" />
                </div>
              </button>
              {isExpanded && (
                <div className="card flat stack sent-details">
                  {(ord.lines || []).length > 1 && (
                    <>
                      {(ord.lines || []).map((line) => {
                        const lp = line.pid ? byId(line.pid) : undefined
                        const lineName = line.name || lp?.name || 'Item'
                        return (
                          <div
                            key={line.pid || line.name || ''}
                            className="row between small"
                            style={{ gap: 8 }}
                          >
                            <span style={{ overflowWrap: 'anywhere' }}>
                              {line.qty} × <ItemTitleWithVariant title={lineName} variant={line.vlabel || undefined} />
                            </span>
                            <span>{peso((lp?.price ?? 0) * line.qty)}</span>
                          </div>
                        )
                      })}
                    </>
                  )}
                  <div className="sent-meta-row">
                    <span className="muted">{isDelivery ? 'Delivery' : 'Meetup'}</span>
                    <b>{cleanWhen}</b>
                  </div>
                  <button
                    type="button"
                    className={`btn sm sent-msg-btn`}
                    onClick={() => onMessageSeller(ord)}
                  >
                    <Icon name="msg" size="sm" /> Message {ord.seller}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Right column — summary */}
      <div className="card stack cart-summary">
        <div className="sent-status-banner">
          <Icon name="check" size="sm" />
          <div>
            <b style={{ display: 'block' }}>
              {batchOrders.length === 1
                ? 'Request sent'
                : `${batchOrders.length} requests sent`}
            </b>
            <span className="tiny muted">
              {batchOrders.length === 1
                ? 'Your seller has been notified.'
                : 'Your sellers have been notified.'}
            </span>
          </div>
        </div>

        <div className="row between small" style={{ width: '100%', gap: 8, marginTop: 10 }}>
          <span className="tiny muted">Items ({totalUnits})</span>
          <span className="tnum">{peso(totalAcrossBatch)}</span>
        </div>
        <div className="row between small" style={{ width: '100%', gap: 8, marginTop: 4 }}>
          <span className="tiny muted">Sellers</span>
          <span className="tnum">
            {batchOrders.length} (
            {batchOrders.length > 1 ? 'separate requests' : '1 request'}
            )
          </span>
        </div>

        <div style={{ marginTop: 10 }}>
          <span className="tiny muted">SUBMITTED ORDERS</span>
          {batchOrders.map((ord) => (
            <div
              key={ord.id}
              className="sent-summary-item row between small"
              style={{ gap: 8, marginTop: 4, cursor: 'pointer' }}
              onClick={() => setExpandedId(ord.id)}
            >
              <span
                className="sent-summary-title"
                style={{
                  overflowWrap: 'anywhere',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 165,
                }}
              >
                <ItemTitleWithVariant
                  as="span"
                  title={ord.title}
                  style={{
                    overflowWrap: 'anywhere',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 165,
                    display: 'block',
                  }}
                />
              </span>
              {fulfillmentPill(ord)}
            </div>
          ))}
        </div>

        <div className="row between small" style={{ width: '100%', gap: 8, marginTop: 10 }}>
          <span className="tiny muted">Platform fee</span>
          <span>₱0 (student service)</span>
        </div>

        <hr className="sent-divider" style={{ margin: 8 }} />

        <div className="row between" style={{ gap: 8 }}>
          <b>Pay in person</b>
          <span className="price tnum" style={{ fontSize: 22 }}>
            {peso(totalAcrossBatch)}
          </span>
        </div>

        <div className="note blue" style={{ marginTop: 10 }}>
          <Icon name="info" size="sm" />
          <span className="small">
            Meet only at visible campus spots during school hours. Inspect the item before handing over cash.
          </span>
        </div>

        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
          <button type="button" className="btn yellow block lg" onClick={onTrackOrders}>
            Track in My Orders
          </button>
          <button
            type="button"
            className="btn ghost block sm"
            onClick={onBackToMarketplace}
          >
            Back to marketplace
          </button>
          {remainingCartCount > 0 && (
            <button
              type="button"
              className="btn ghost block sm"
              onClick={onBackToCart}
            >
              Back to cart ({remainingCartCount} left)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
