import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { playMessage, playPop } from '@/common/sounds'
import { navigate } from '@/common/router/router'
import { ago, isSvc, refLabel, stamp } from '../constants'
import { useTindahan } from '../context/TindahanContext'
import type { Conversation, MessageRef } from '../types'
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
    startEditListing,
    sendChatMessage,
    reactToChatMessage,
    markConvRead,
    openContextOrder,
  } = useTindahan()

  const [draftText, setDraftText] = useState('')
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
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

  if (!currentAccount) return null

  const pool = (c: Conversation) => !c.seller && isStaffUser
  const peer = (c: Conversation) =>
    currentAccount.email === c.buyer
      ? c.seller
        ? c.sellerName
        : 'RTU Pasig Campus Store'
      : c.buyerName
  const peerEmail = (c: Conversation) =>
    currentAccount.email === c.buyer ? c.seller : c.buyer

  const renderCtxChip = (r: MessageRef, c: Conversation) => {
    const isOrder = r.type === 'order'
    const listing = !isOrder && r.id ? byId(r.id) : undefined
    const isMyRejectedOrDraft =
      !isOrder &&
      r.id &&
      currentAccount.sellerList?.some((l) => l.lid === r.id)
    return (
      <div className="m-ctx">
        <span className="refchip">
          <span>{refLabel(r)}</span>· {r.name || ''}
        </span>
        {isOrder ? (
          <button
            type="button"
            className="link"
            onClick={() => {
              openContextOrder(r.id, c.id)
            }}
          >
            View order {r.id}
          </button>
        ) : listing ? (
          <button
            type="button"
            className="link"
            onClick={() => {
              openProduct(listing.id)
            }}
          >
            View {isSvc(listing) ? 'service' : 'listing'}
          </button>
        ) : isMyRejectedOrDraft ? (
          <button
            type="button"
            className="link"
            onClick={() => {
              startEditListing(r.id)
            }}
          >
            Edit & resubmit listing
          </button>
        ) : (
          <span className="tiny muted">Under review / not public</span>
        )}
      </div>
    )
  }

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
                          {c.ref.name}
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
                const canEditRejectedListing =
                  cur.ref.pid &&
                  currentAccount.sellerList?.some((l) => l.lid === cur.ref.pid)

                return (
                  <div className="m-head">
                    <button
                      type="button"
                      className="btn ghost sm m-back"
                      onClick={() => {
                        setSelectedConvId(null)
                      }}
                    >
                      <Icon name="back" size="sm" />
                      Back
                    </button>
                    <AvatarBadge
                      account={peerAcct}
                      name={nm}
                      isStaff={isStaffPeer}
                      size="md"
                    />
                    <div className="grow">
                      <b>{nm}</b>
                      <div className="row wrap" style={{ gap: 6 }}>
                        <span className="refchip">
                          {refLabel(cur.ref)}: {cur.ref.name}
                        </span>
                        {pool(cur) && (
                          <span className="tiny muted">Official RTU Store inbox</span>
                        )}
                      </div>
                    </div>
                    {listing ? (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => {
                          openProduct(listing.id)
                        }}
                      >
                        View {isSvc(listing) ? 'service' : 'listing'}
                      </button>
                    ) : canEditRejectedListing && cur.ref.pid ? (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => {
                          startEditListing(cur.ref.pid!)
                        }}
                      >
                        <Icon name="edit" size="sm" />
                        Edit & resubmit
                      </button>
                    ) : null}
                    {cur.ref.type === 'order' && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => {
                          navigate(
                            currentAccount.email === cur.buyer
                              ? 'orders'
                              : pool(cur)
                                ? 'transactions'
                                : 'shop',
                          )
                        }}
                      >
                        View order
                      </button>
                    )}
                  </div>
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

                  return (
                    <div
                      key={m.id || i}
                      className={`m-row ${me ? 'me' : 'them'}`}
                    >
                      {r && !same && renderCtxChip(r, cur)}
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
                          <small>
                            {me ? 'You' : m.name} · {stamp(m.ts)}
                          </small>
                        </div>

                        {/* Requirement #8: Reaction button and reaction pills anchored at the bottom corner of the message bubble */}
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
                  )
                })}
              </div>

              <form
                className="m-comp"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
              >
                <textarea
                  className="input"
                  id="mi-text"
                  rows={1}
                  placeholder="Write a message or reply to the review..."
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
                <button type="submit" className="btn">
                  <Icon name="send" size="sm" />
                  Send
                </button>
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
