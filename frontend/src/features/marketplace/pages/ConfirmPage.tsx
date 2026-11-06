import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { peso } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import './ConfirmPage.css'

export function ConfirmPage() {
  const {
    currentAccount,
    lastOrderId,
    myConversations,
    sendOrderMessage,
  } = useTindahan()

  const [chatInput, setChatInput] = useState('')

  const orders = currentAccount?.orders || []
  const o = orders.find((x) => x.id === lastOrderId) || orders[0]

  if (!o) {
    return (
      <div
        className="card stack"
        style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
      >
        <b>No recent request</b>
        <p className="small muted">
          Open My Orders to see your requests, or browse the marketplace.
        </p>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => navigate('orders')}>
            My Orders
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate('browse')}>
            Browse listings
          </button>
        </div>
      </div>
    )
  }

  const isDelivery = o.fulfillment === 'delivery'

  // Build chat messages matching chatMsgs() in js/9b-services-messages-transactions.js
  const conv = myConversations.find((c) =>
    o.sellerEmail ? c.seller === o.sellerEmail : !c.seller,
  )
  const firstSystemMsg = {
    me: false,
    t: o.sellerEmail
      ? 'Your request was sent. This seller is a student on Tindahan. They will reply here and in Messages.'
      : 'Your request was sent to the Official RTU Store. Staff will confirm it and can reply here and in Messages.',
  }
  const threadMsgs = [
    firstSystemMsg,
    ...(conv
      ? conv.msgs
          .filter((m) => !m.ref || m.ref.type !== 'order' || m.ref.id === o.id)
          .map((m) => ({ me: m.from === currentAccount?.email, t: m.text }))
      : []),
  ]

  return (
    <>
      <div
        className="card stack"
        style={{ alignItems: 'center', textAlign: 'center', padding: 28 }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--green-bg)',
            color: 'var(--green)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="check" />
        </div>
        <div className="row wrap" style={{ justifyContent: 'center', gap: 6 }}>
          <span className="pill green">Request sent · #{o.id}</span>
          <span className={`pill ${isDelivery ? 'blue' : 'green'}`}>
            {isDelivery ? 'Delivery' : 'Pickup'}
          </span>
        </div>
        <h1>
          Your {isDelivery ? 'delivery' : 'pickup'} request is on its way
        </h1>
        <p className="muted small" style={{ maxWidth: 460 }}>
          {o.seller} has been notified. Coordinate below for{' '}
          <b>{isDelivery ? 'Campus Delivery' : 'Campus Pickup'}</b> at <b>{o.when}</b>.
        </p>
      </div>

      <div className="confirm-two two">
        <div className="card stack">
          <b>Order & fulfillment details</b>
          <div className="row between small">
            <span className="muted">Item</span>
            <b>{o.title}</b>
          </div>
          <div className="row between small">
            <span className="muted">Seller</span>
            <b>{o.seller}</b>
          </div>
          <div className="row between small">
            <span className="muted">Fulfillment method</span>
            <span className={`pill ${isDelivery ? 'blue' : 'green'}`}>
              {isDelivery ? 'Delivery' : 'Pickup'}
            </span>
          </div>
          <div className="row between small">
            <span className="muted">{isDelivery ? 'Delivery schedule' : 'Meetup'}</span>
            <b>{o.when}</b>
          </div>
          <div className="row between small">
            <span className="muted">Pay in person</span>
            <span className="price tnum">{peso(o.total)}</span>
          </div>
          <div className="note blue">
            <Icon name="shield" />
            <span>
              Meet only at visible campus spots during school hours. Inspect the item before
              handing over cash.
            </span>
          </div>
          <div className="row wrap">
            <button type="button" className="btn" onClick={() => navigate('orders')}>
              Track in My Orders
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => navigate('marketplace')}
            >
              Back to marketplace
            </button>
          </div>
        </div>

        <div className="card stack">
          <b>Message {o.seller}</b>
          <div
            className="stack"
            style={{
              background: 'var(--bg)',
              padding: 12,
              borderRadius: 10,
              maxHeight: 220,
              overflow: 'auto',
            }}
          >
            {threadMsgs.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.me ? 'flex-end' : 'flex-start',
                  background: m.me ? 'var(--blue)' : 'var(--card)',
                  color: m.me ? '#fff' : 'var(--ink)',
                  padding: '8px 11px',
                  borderRadius: 10,
                  maxWidth: '82%',
                  fontSize: 12.5,
                  border: '1px solid var(--line)',
                }}
              >
                {m.t}
              </div>
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              if (sendOrderMessage(o.id, chatInput, false)) {
                setChatInput('')
              }
            }}
          >
            <input
              className="input"
              id="chatmsg"
              placeholder="Write a message to the seller..."
              aria-label="Message"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button type="submit" className="btn">
              <Icon name="send" size="sm" />
              Send
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
