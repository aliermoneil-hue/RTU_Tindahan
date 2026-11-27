import { useEffect, useRef, useState } from 'react'
import { ItemTitleWithVariant } from '@/common/components/ItemTitleWithVariant'
import { Icon } from '@/common/components/Icon'
import { playMessage, playPop } from '@/common/sounds'
import { navigate } from '@/common/router/router'
import { ago, isSvc, refLabel, peso } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import type { Conversation } from '../types'
import { AvatarBadge } from '../components/AvatarBadge'
import './MessagesPage.css'

const CHAT_EMOJIS = ['👍', '❤️', '😊', '😮', '🙏', '🎉']

export function MessagesPage() {
  const {
    currentAccount,
    isStaffUser,
    selectedConvId,
    setSelectedConvId,
    myConversations,
    unreadMessagesCount,
    unreadInConv,
    byId,
    acctByEmail,
    openProduct,
    sendChatMessage,
    reactToChatMessage,
    markConvRead,
  } = useTindahan()

  const [draftText, setDraftText] = useState('')
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const cur = selectedConvId
    ? myConversations.find(
        (c) => c.id === selectedConvId || (c.alias || []).includes(selectedConvId),
      ) || null
    : null

  useEffect(() => {
    if (cur && currentAccount && unreadInConv(cur) > 0) {
      markConvRead(cur.id)
    }
  }, [cur, currentAccount, unreadInConv, markConvRead])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [cur?.id, cur?.msgs.length])

  // Close overflow menu when clicking outside
  useEffect(() => {
    if (!overflowOpen) return
    const onDocClick = (e: MouseEvent) => {
      const head = document.querySelector('.m-head')
      if (head && !head.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [overflowOpen])

  if (!currentAccount) return null

  const peer = (c: Conversation) =>
    currentAccount.email === c.buyer
      ? c.seller
        ? c.sellerName
        : 'RTU Pasig Campus Store'
      : c.buyerName
  const peerEmail = (c: Conversation) =>
    currentAccount.email === c.buyer ? c.seller : c.buyer

  const handleSend = () => {
    if (!cur) return
    if (sendChatMessage(cur.id, draftText)) {
      setDraftText('')
      playMessage()
    }
  }

  const handleReactionClick = (msgIdx: number, emoji: string) => {
    if (!cur) return
    playPop()
    reactToChatMessage(cur.id, msgIdx, emoji)
    setPickerIndex(null)
  }

  return (
    <>
      <div>
        <span className="eyebrow">COMMUNITY · MESSAGES</span>
        <h1>Messages</h1>
        <p className="muted small">
          Chat with sellers, service providers, buyers, and RTU administrators.{' '}
          {unreadMessagesCount > 0 && <b>{unreadMessagesCount} unread. </b>}
          Only the people in a conversation can read it.
          {isStaffUser ? ' As staff you also see chats with the Official RTU Store.' : ''}
        </p>
      </div>

      <div className={`msgs ${cur ? 'has-thread' : ''}`.trim()}>
        <div className="m-list" aria-label="Conversations">
          {myConversations.length ? (
            myConversations.map((c) => {
              const un = unreadInConv(c)
              const last = c.msgs[c.msgs.length - 1]
              const nm = peer(c)
              const pe = peerEmail(c)
              const peerAcct = pe ? acctByEmail(pe) : undefined
              const isStaffPeer =
                (!c.seller && currentAccount.email === c.buyer) ||
                peerAcct?.role === 'moderator'
              const hasAdminReview = c.msgs.some((m) => Boolean(m.adminReview))

              return (
                <button
                  key={c.id}
                  type="button"
                  className={`m-item ${cur && cur.id === c.id ? 'on' : ''} ${
                    un ? 'unread' : ''
                  }`.trim()}
                  onClick={() => {
                    setSelectedConvId(c.id)
                  }}
                >
                  <AvatarBadge
                    account={peerAcct}
                    name={nm}
                    isStaff={isStaffPeer}
                    size="md"
                    noTip
                  />
                  <span className="m-t">
                    <span className="row between" style={{ gap: 6 }}>
                      <b
                        className="small"
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {nm}
                      </b>
                      <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                        {last ? ago(last.ts) : ''}
                      </span>
                    </span>
                    <span className="row wrap" style={{ gap: 4 }}>
                      {hasAdminReview && (
                        <span className="pill red" style={{ fontSize: 10, padding: '1px 6px' }}>
                          Admin Review
                        </span>
                      )}
                      <span className="refchip" style={{ alignSelf: 'flex-start' }}>
                        <span>{refLabel(c.ref)}</span>·{' '}
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 135,
                          }}
                        >
                          {c.ref.name && <ItemTitleWithVariant title={c.ref.name} />}
                        </span>
                      </span>
                    </span>
                    <span className="m-prev">
                      {last
                        ? (last.from === currentAccount.email ? 'You: ' : '') + last.text
                        : 'No messages yet'}
                    </span>
                  </span>
                  {un > 0 && <span className="m-dot">{un}</span>}
                </button>
              )
            })
          ) : (
            <div className="m-empty" style={{ padding: 24 }}>
              <b className="small">No conversations</b>
              <p className="small muted">Your chats will be listed here.</p>
            </div>
          )}
        </div>

        <div className="m-thread">
          {cur ? (
            <>
              {(() => {
                const nm = peer(cur)
                const pe = peerEmail(cur)
                const peerAcct = pe ? acctByEmail(pe) : undefined
                const isStaffPeer =
                  (!cur.seller && currentAccount.email === cur.buyer) ||
                  peerAcct?.role === 'moderator'
                const listing = cur.ref.pid ? byId(cur.ref.pid) : undefined

                return (
                  <>
                    <div className="m-head">
                      <div className="m-head-row-1">
                        <button
                          type="button"
                          className="btn ghost sm m-back"
                          onClick={() => {
                            setSelectedConvId(null)
                          }}
                        >
                          <Icon name="back" size="sm" />
                        </button>
                        <AvatarBadge
                          account={peerAcct}
                          name={nm}
                          isStaff={isStaffPeer}
                          size="md"
                        />
                        <div className="m-head-identity">
                          <b className="m-head-name">{nm}</b>
                          <span className="m-head-subtitle">
                            {currentAccount?.aff === 'Student'
                              ? currentAccount.prog.replace(/^BS /, '').split(' ').map((w) => w[0]).join('') + ' · ColaCT'
                              : currentAccount?.aff}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="m-overflow-btn"
                          aria-label="More options"
                          aria-expanded={overflowOpen}
                          onClick={(e) => {
                            e.stopPropagation()
                            setOverflowOpen((prev) => !prev)
                          }}
                        >
                          <Icon name="dots" size="sm" />
                        </button>
                        {overflowOpen && (
                          <div className="m-overflow-dropdown">
                            {listing ? (
                              <>
                                <button
                                  type="button"
                                  className="m-overflow-item"
                                  onClick={() => {
                                    setOverflowOpen(false)
                                    openProduct(listing.id)
                                  }}
                                >
                                  View listing
                                </button>
                                {cur.ref.type === 'order' && (
                                  <button
                                    type="button"
                                    className="m-overflow-item"
                                    onClick={() => {
                                      setOverflowOpen(false)
                                      navigate('orders')
                                    }}
                                  >
                                    View order
                                  </button>
                                )}
                              </>
                            ) : cur.ref.type === 'order' ? (
                              <button
                                type="button"
                                className="m-overflow-item"
                                onClick={() => {
                                  setOverflowOpen(false)
                                  navigate('orders')
                                }}
                              >
                                View order
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="m-overflow-item"
                                onClick={() => {
                                  setOverflowOpen(false)
                                }}
                              >
                                No related item
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {cur.ref && (
                      <div className="m-order-strip" onClick={() => {
                        if (listing) {
                          openProduct(listing.id)
                        } else if (cur.ref.type === 'order') {
                          navigate('orders')
                        }
                      }}>
                        <div className="m-order-thumb">
                          {listing ? (
                            <span className="m-order-thumb-ico">
                              <Icon name={isSvc(listing) ? 'print' : 'shop'} size="sm" />
                            </span>
                          ) : (
                            <span className="m-order-thumb-ico">
                              <Icon name="order" size="sm" />
                            </span>
                          )}
                        </div>
                        <div className="m-order-info">
                          <div className="m-order-title">
                            {listing ? listing.name : cur.ref.name || 'Order'}
                          </div>
                          <div className="m-order-meta">
                            {listing ? peso(listing.price) : '₱0'} · Campus pickup · {cur.ref.id}
                          </div>
                        </div>
                        <div className="m-order-status">
                          {cur.ref.type === 'order' ? (
                            <span className="pill pill-sm yellow">Pending</span>
                          ) : (
                            <span className="pill pill-sm blue">Active</span>
                          )}
                          <Icon name="chevR" size="sm" />
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}

              <div
                ref={bodyRef}
                className="m-body"
                aria-live="polite"
                onClick={() => {
                  if (pickerIndex !== null) setPickerIndex(null)
                }}
              >
                {cur.msgs.map((m, i) => {
                  const me = m.from === currentAccount.email
                  const pr = i ? cur.msgs[i - 1].ref : null
                  const r = m.ref
                  const same = pr && r && pr.type === r.type && pr.id === r.id

                  // Count reactions grouped by emoji
                  const counts: Record<string, { count: number; hasMine: boolean }> = {}
                  if (m.reacts) {
                    Object.entries(m.reacts).forEach(([userEmail, emoji]) => {
                      if (!counts[emoji]) counts[emoji] = { count: 0, hasMine: false }
                      counts[emoji].count++
                      if (userEmail === currentAccount.email) {
                        counts[emoji].hasMine = true
                      }
                    })
                  }
                  const reactionEntries = Object.entries(counts)

                  // Date divider when the date changes
                  const msgDate = new Date(m.ts).toDateString()
                  const prevMsg = i > 0 ? cur.msgs[i - 1] : null
                  const prevDate = prevMsg ? new Date(prevMsg.ts).toDateString() : null
                  const showDateDivider = i === 0 || msgDate !== prevDate

                  // Order switch divider when the ref changes
                  const prevRef = prevMsg ? prevMsg.ref : null
                  const showOrderDivider =
                    prevRef &&
                    (!r || prevRef.type !== r.type || prevRef.id !== r.id)

                  return (
                    <>
                      {showDateDivider && (
                        <div className="m-date-divider">
                          {new Date(m.ts).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: new Date(m.ts).getFullYear() !== new Date().getFullYear()
                              ? 'numeric'
                              : undefined,
                          })}
                        </div>
                      )}
                      {showOrderDivider && r && !same && (
                        <div className="m-order-divider">
                          {r.type === 'order' ? `Order ${r.id}` : refLabel(r)} · {r.name}
                        </div>
                      )}
                      <div
                        key={m.id || i}
                        className={`m-row ${me ? 'me' : 'them'}`}
                      >
                        <div className="m-bub-wrap">
                          <div
                            className={`bub ${me ? 'me' : 'them'} ${
                              m.adminReview ? 'admin-review-bub' : ''
                            }`.trim()}
                          >
                            {m.adminReview && (
                              <div className="m-admin-review-head">
                                <Icon name="shield" size="sm" />
                                <span>
                                  Administrative Listing Review · {m.adminReview.decision}
                                </span>
                              </div>
                            )}
                            {m.text}
                          </div>
                          <div className="m-msg-footer">
                            <span className={`m-msg-time ${me ? 'me' : 'them'}`}>
                              {new Date(m.ts).toLocaleTimeString('en-PH', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </span>

                            {/* Reaction button and reaction pills anchored at the bottom corner of the message bubble */}
                            <div className="m-react-dock">
                            {reactionEntries.length > 0 && (
                              <div className={`m-react-pills ${me ? 'me' : 'them'}`}>
                                {reactionEntries.map(([emoji, data]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className={`m-react-pill ${data.hasMine ? 'active' : ''}`}
                                    title={data.hasMine ? 'Remove reaction' : 'Add reaction'}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleReactionClick(i, emoji)
                                    }}
                                  >
                                    <span>{emoji}</span>
                                    <span className="tiny tnum">{data.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              className={`m-react-trigger ${pickerIndex === i ? 'is-open' : ''}`.trim()}
                              title="Add reaction"
                              aria-label="Add reaction"
                              onClick={(e) => {
                                e.stopPropagation()
                                playPop()
                                setPickerIndex(pickerIndex === i ? null : i)
                              }}
                            >
                              <Icon name="star" size="sm" />
                            </button>

                            {pickerIndex === i && (
                              <div
                                className="m-react-picker"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {CHAT_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="m-react-emoji-btn"
                                    onClick={() => handleReactionClick(i, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })}
              </div>

                {/* Quick-reply chips strip */}
                <div className="m-quick-replies">
                  <button
                    type="button"
                    className="m-quick-chip"
                    onClick={() => {
                      if (!cur) return
                      if (sendChatMessage(cur.id, 'On my way')) {
                        setDraftText('')
                        playMessage()
                      }
                    }}
                  >
                    On my way
                  </button>
                  <button
                    type="button"
                    className="m-quick-chip"
                    onClick={() => {
                      if (!cur) return
                      if (sendChatMessage(cur.id, 'Where to meet?')) {
                        setDraftText('')
                        playMessage()
                      }
                    }}
                  >
                    Where to meet?
                  </button>
                  <button
                    type="button"
                    className="m-quick-chip"
                    onClick={() => {
                      if (!cur) return
                      if (sendChatMessage(cur.id, 'Confirm pickup')) {
                        setDraftText('')
                        playMessage()
                      }
                    }}
                  >
                    Confirm pickup
                  </button>
                </div>

                {/* Pill composer */}
                <form
                  className="m-comp-wrap"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSend()
                  }}
                >
                  <div className="m-comp">
                    <textarea
                      className="input"
                      id="mi-text"
                      rows={1}
                      placeholder="Message"
                      aria-label="Message"
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                    />
                    <button
                      type="submit"
                      className="m-comp-send"
                      aria-label="Send"
                    >
                      <Icon name="send" size="sm" />
                    </button>
                  </div>
                </form>
              </>
          ) : (
            <div className="m-empty" style={{ margin: 'auto' }}>
              <span style={{ color: 'var(--blue)' }}>
                <Icon name="msg" />
              </span>
              <b>{myConversations.length ? 'Pick a conversation' : 'No messages yet'}</b>
              <p className="small muted">
                {myConversations.length
                  ? 'Choose a chat on the left to read it and reply.'
                  : 'Open any listing or service and tap Message seller or Contact provider. When a buyer or administrator writes to you, the chat shows up here.'}
              </p>
              {!myConversations.length && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    navigate('browse')
                  }}
                >
                  Browse listings
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
