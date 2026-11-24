'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { apiFetch } from '@/common/api/client'
import { navigate } from '@/common/router/router'
import { useAuth } from '@/features/authentication'
import { useTindahan } from '../context/TindahanContext'
import { AvatarBadge } from './AvatarBadge'
import { useProfileSettings } from '../profileSettingsStore'
import './ProfileSettings.css'

interface ProfileSettingsProps {}

export function ProfileSettings({}: ProfileSettingsProps) {
  const { user, logout } = useAuth()
  const { toast, db, currentAccount } = useTindahan()
  const email = currentAccount?.email || user?.email || ''
  const {
    friends,
    sent,
    received,
    blocked,
    privacy,
    addFriend,
    cancelRequest,
    acceptRequest,
    declineRequest,
    unfriend,
    block,
    unblock,
    setPrivacy,
  } = useProfileSettings(email)

  const [open, setOpen] = useState<'password' | 'friends' | 'blocked' | 'privacy' | 'delete' | null>(null)

  // Change password dialog state
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passErr, setPassErr] = useState('')
  const [passLoading, setPassLoading] = useState(false)

  // Delete account dialog state
  const [delConfirm, setDelConfirm] = useState('')
  const [delPass, setDelPass] = useState('')
  const [delErr, setDelErr] = useState('')
  const [delLoading, setDelLoading] = useState(false)

  // Find people / block someone state
  const [searchQuery, setSearchQuery] = useState('')
  const [blockSearchQuery, setBlockSearchQuery] = useState('')

  // Pre-computed search results for Find people and Block someone
  const findResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return db.accounts.filter(
      (a) =>
        a.email !== email &&
        !blocked.includes(a.email) &&
        !friends.includes(a.email) &&
        !sent.includes(a.email) &&
        !received.includes(a.email) &&
        (a.name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
          a.email.toLowerCase().includes(searchQuery.toLowerCase())),
    )
  }, [searchQuery, email, blocked, friends, sent, received, db.accounts])

  const blockResults = useMemo(() => {
    if (!blockSearchQuery.trim()) return []
    return db.accounts.filter(
      (a) =>
        a.email !== email &&
        !blocked.includes(a.email) &&
        (a.name
          ?.toLowerCase()
          .includes(blockSearchQuery.toLowerCase()) ||
          a.email.toLowerCase().includes(blockSearchQuery.toLowerCase())),
    )
  }, [blockSearchQuery, email, blocked, db.accounts])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassErr('')
    if (!newPass || newPass.length < 8) {
      setPassErr('New password must be at least 8 characters.')
      return
    }
    if (newPass !== confirmPass) {
      setPassErr('The two passwords do not match.')
      return
    }
    setPassLoading(true)
    try {
      await apiFetch('/auth/change-password/', {
        method: 'POST',
        body: { current_password: curPass, new_password: newPass },
      })
      toast('Password changed')
      setCurPass('')
      setNewPass('')
      setConfirmPass('')
      setOpen(null)
    } catch (err: any) {
      setPassErr(
        err?.response?.data?.detail || err?.message || 'Password change failed.'
      )
    } finally {
      setPassLoading(false)
    }
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDelErr('')
    setDelLoading(true)
    try {
      await apiFetch('/auth/delete-account/', {
        method: 'POST',
        body: { password: delPass },
      })
      await logout()
      navigateToHome()
    } catch (err: any) {
      setDelErr(
        err?.response?.data?.detail || err?.message || 'Account deletion failed.'
      )
    } finally {
      setDelLoading(false)
    }
  }

  const navigateToHome = () => {
    navigate('', { replace: true })
  }

  const chevR = <Icon name="chevR" size="sm" />

  const psetRow = (
    icon: React.ReactNode,
    title: string,
    hint: string,
    onClick: () => void,
    danger = false
  ) => (
    <button
      type="button"
      className={`pset-row${danger ? ' danger' : ''}`}
      onClick={onClick}
      aria-label={title}
    >
      <span className="pset-icon">{icon}</span>
      <div className="pset-body">
        <b className="pset-title">{title}</b>
        <span className="pset-hint">{hint}</span>
      </div>
      {chevR}
    </button>
  )

  return (
    <>
      {/* Account settings card */}
      <div className="card stack">
        <div className="row between">
          <div>
            <b>Account settings</b>
            <p className="small muted">Password, connections and privacy.</p>
          </div>
        </div>

        {psetRow(
          <Icon name="key" size="sm" />,
          'Change password',
          'Update your account password',
          () => setOpen('password')
        )}

        {psetRow(
          <Icon name="user" size="sm" />,
          'Manage connections',
          'Friends, requests and finding people',
          () => setOpen('friends')
        )}

        {psetRow(
          <Icon name="x" size="sm" />,
          'Blocklist',
          'Blocked accounts and blocking controls',
          () => setOpen('blocked')
        )}

        {psetRow(
          <Icon name="eye" size="sm" />,
          'Privacy settings',
          'Who can see your profile, shop and messages',
          () => setOpen('privacy')
        )}

        {psetRow(
          <Icon name="trash" size="sm" />,
          'Delete account',
          'Permanently remove your account and data',
          () => setOpen('delete'),
          true
        )}

        {/* Dialogs */}
        {open === 'password' && (
          <div className="pset-overlay" onClick={() => setOpen(null)}>
            <div
              className="pset-box"
              role="dialog"
              aria-modal="true"
              aria-label="Change password"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="pset-close"
                aria-label="Close"
                onClick={() => setOpen(null)}
              >
                <Icon name="x" />
              </button>
              <h3>Change password</h3>
              <p className="small muted">
                Enter your current password and choose a new one (at least 8 characters).
              </p>
              <form onSubmit={handleChangePassword} className="pset-form">
                <div className="pset-field">
                  <label>Current password</label>
                  <div className="pset-password-input">
                    <input
                      type={showCur ? 'text' : 'password'}
                      value={curPass}
                      onChange={(e) => setCurPass(e.target.value)}
                      placeholder="Current password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="pset-password-toggle"
                      onClick={() => setShowCur(!showCur)}
                      aria-label={showCur ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showCur ? 'eye' : 'eyeoff'} size="sm" />
                    </button>
                  </div>
                </div>
                <div className="pset-field">
                  <label>New password</label>
                  <div className="pset-password-input">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="New password (at least 8 characters)"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pset-password-toggle"
                      onClick={() => setShowNew(!showNew)}
                      aria-label={showNew ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showNew ? 'eye' : 'eyeoff'} size="sm" />
                    </button>
                  </div>
                </div>
                <div className="pset-field">
                  <label>Confirm new password</label>
                  <div className="pset-password-input">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pset-password-toggle"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showConfirm ? 'eye' : 'eyeoff'} size="sm" />
                    </button>
                  </div>
                </div>
                {passErr && <p className="pset-err" role="alert">{passErr}</p>}
                <div className="pset-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setOpen(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={passLoading}
                  >
                    {passLoading ? 'Changing...' : 'Change password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {open === 'delete' && (
          <div className="pset-overlay" onClick={() => setOpen(null)}>
            <div
              className="pset-box"
              role="dialog"
              aria-modal="true"
              aria-label="Delete account"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="pset-close"
                aria-label="Close"
                onClick={() => setOpen(null)}
              >
                <Icon name="x" />
              </button>
              <h3>Delete account</h3>
              <p className="small muted pset-warn">
                This cannot be undone. Your listings, requests and data will be removed.
              </p>
              <form onSubmit={handleDeleteAccount} className="pset-form">
                <div className="pset-field">
                  <label>Password</label>
                  <input
                    type="password"
                    value={delPass}
                    onChange={(e) => setDelPass(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>
                <div className="pset-field">
                  <label>Type DELETE to confirm</label>
                  <input
                    type="text"
                    value={delConfirm}
                    onChange={(e) => setDelConfirm(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </div>
                {delErr && <p className="pset-err" role="alert">{delErr}</p>}
                <div className="pset-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setOpen(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn danger"
                    disabled={
                      delLoading ||
                      delConfirm !== 'DELETE' ||
                      !delPass
                    }
                  >
                    {delLoading ? 'Deleting...' : 'Delete my account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {open === 'friends' && (
          <div className="pset-overlay" onClick={() => setOpen(null)}>
            <div
              className="pset-box"
              role="dialog"
              aria-modal="true"
              aria-label="Manage connections"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="pset-close"
                aria-label="Close"
                onClick={() => setOpen(null)}
              >
                <Icon name="x" />
              </button>
              <h3>Manage connections</h3>
              <div className="pset-tabs">
                <button
                  type="button"
                  className="pset-tab"
                  onClick={() => {}}
                >
                  Friends
                </button>
                <button
                  type="button"
                  className="pset-tab"
                  onClick={() => {}}
                >
                  Requests
                </button>
                <button
                  type="button"
                  className="pset-tab"
                  onClick={() => {}}
                >
                  Find people
                </button>
              </div>
              <div className="pset-tab-panel">
                {/* Friends */}
                <div className="pset-friends">
                  {friends.length === 0 ? (
                    <p className="small muted">No friends yet.</p>
                  ) : (
                    friends.map((fEmail: string) => {
                      const acct = db.accounts.find((a) => a.email === fEmail)
                      return (
                        <div
                          key={fEmail}
                          className="pset-friend-row"
                        >
                          <AvatarBadge
                            account={acct ?? undefined}
                            name={acct?.name || fEmail}
                            size="sm"
                            noTip
                          />
                          <span className="pset-friend-name">
                            {acct?.name || fEmail}
                          </span>
                          <div className="pset-row-actions">
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => unfriend(fEmail)}
                            >
                              Unfriend
                            </button>
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => block(fEmail)}
                            >
                              Block
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Requests */}
                <div className="pset-requests" style={{ marginTop: 16 }}>
                  <b className="pset-section-title">Friend requests</b>
                  <div className="pset-request-section">
                    <b className="pset-request-subtitle">Sent</b>
                    {sent.length === 0 ? (
                      <p className="small muted">No pending requests.</p>
                    ) : (
                      sent.map((sEmail: string) => {
                        const acct = db.accounts.find((a) => a.email === sEmail)
                        return (
                          <div key={sEmail} className="pset-friend-row">
                            <AvatarBadge
                              account={acct ?? undefined}
                              name={acct?.name || sEmail}
                              size="sm"
                              noTip
                            />
                            <span className="pset-friend-name">
                              {acct?.name || sEmail}
                            </span>
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => cancelRequest(sEmail)}
                            >
                              Cancel
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="pset-request-section" style={{ marginTop: 10 }}>
                    <b className="pset-request-subtitle">Received</b>
                    {received.length === 0 ? (
                      <p className="small muted">No incoming requests.</p>
                    ) : (
                      received.map((rEmail: string) => {
                        const acct = db.accounts.find((a) => a.email === rEmail)
                        return (
                          <div key={rEmail} className="pset-friend-row">
                            <AvatarBadge
                              account={acct ?? undefined}
                              name={acct?.name || rEmail}
                              size="sm"
                              noTip
                            />
                            <span className="pset-friend-name">
                              {acct?.name || rEmail}
                            </span>
                            <div className="pset-row-actions">
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => acceptRequest(rEmail)}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="btn ghost sm"
                                onClick={() => declineRequest(rEmail)}
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Find people */}
                <div className="pset-find" style={{ marginTop: 16 }}>
                  <b className="pset-section-title">Find people</b>
                  <div className="pset-field">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or RTU email"
                    />
                  </div>
                  <div className="pset-find-results">
                    {searchQuery.trim() === '' ? (
                      <p className="small muted">Type to search for people.</p>
                    ) : findResults.length === 0 ? (
                      <p className="small muted">No one found.</p>
                    ) : (
                      findResults.map((a) => (
                        <div key={a.email} className="pset-friend-row">
                          <AvatarBadge account={a} size="sm" noTip />
                          <span className="pset-friend-name">{a.name}</span>
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => addFriend(a.email)}
                          >
                            Add friend
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="pset-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setOpen(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {open === 'blocked' && (
          <div className="pset-overlay" onClick={() => setOpen(null)}>
            <div
              className="pset-box"
              role="dialog"
              aria-modal="true"
              aria-label="Blocklist"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="pset-close"
                aria-label="Close"
                onClick={() => setOpen(null)}
              >
                <Icon name="x" />
              </button>
              <h3>Blocklist</h3>
              <div className="pset-blocked-list">
                {blocked.length === 0 ? (
                  <p className="small muted">No blocked accounts.</p>
                ) : (
                  blocked.map((bEmail: string) => {
                    const acct = db.accounts.find((a) => a.email === bEmail)
                    return (
                      <div key={bEmail} className="pset-friend-row">
                        <AvatarBadge
                          account={acct ?? undefined}
                          name={acct?.name || bEmail}
                          size="sm"
                          noTip
                        />
                        <span className="pset-friend-name">
                          {acct?.name || bEmail}
                        </span>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => unblock(bEmail)}
                        >
                          Unblock
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="pset-block-add" style={{ marginTop: 16 }}>
                <b className="pset-section-title">Block someone</b>
                <div className="pset-field">
                  <input
                    type="text"
                    value={blockSearchQuery}
                    onChange={(e) => setBlockSearchQuery(e.target.value)}
                    placeholder="Search by name or RTU email"
                  />
                </div>
                <div className="pset-find-results">
                  {blockSearchQuery.trim() === '' ? (
                    <p className="small muted">Type to search for someone to block.</p>
                  ) : blockResults.length === 0 ? (
                    <p className="small muted">No one found.</p>
                  ) : (
                    blockResults.map((a) => (
                      <div key={a.email} className="pset-friend-row">
                        <AvatarBadge account={a} size="sm" noTip />
                        <span className="pset-friend-name">{a.name}</span>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => block(a.email)}
                        >
                          Block
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="pset-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setOpen(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {open === 'privacy' && (
          <div className="pset-overlay" onClick={() => setOpen(null)}>
            <div
              className="pset-box"
              role="dialog"
              aria-modal="true"
              aria-label="Privacy settings"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="pset-close"
                aria-label="Close"
                onClick={() => setOpen(null)}
              >
                <Icon name="x" />
              </button>
              <h3>Privacy settings</h3>
              <p className="small muted">
                Control who can see your profile, shop and messages.
              </p>

              <div className="pset-field" style={{ marginTop: 16 }}>
                <b className="pset-section-title">Who can see my profile</b>
                <div className="pset-choice-group">
                  {['Everyone', 'Friends only', 'Only me'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`btn sm ${privacy.profile === val ? '' : 'ghost'}`.trim()}
                      aria-pressed={privacy.profile === val}
                      onClick={() => setPrivacy({ profile: val as any })}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pset-field" style={{ marginTop: 16 }}>
                <b className="pset-section-title">Who can see my shop and listings</b>
                <div className="pset-choice-group">
                  {['Everyone', 'Friends only'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`btn sm ${privacy.shop === val ? '' : 'ghost'}`.trim()}
                      aria-pressed={privacy.shop === val}
                      onClick={() => setPrivacy({ shop: val as any })}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pset-field" style={{ marginTop: 16 }}>
                <b className="pset-section-title">Who can message me</b>
                <div className="pset-choice-group">
                  {['Everyone', 'Friends only', 'No one'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`btn sm ${privacy.messages === val ? '' : 'ghost'}`.trim()}
                      aria-pressed={privacy.messages === val}
                      onClick={() => setPrivacy({ messages: val as any })}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pset-field" style={{ marginTop: 16 }}>
                <b className="pset-section-title">Show my contact number</b>
                <div className="pset-choice-group">
                  {['On', 'Off'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`btn sm ${privacy.showContact === (val === 'On') ? '' : 'ghost'}`.trim()}
                      aria-pressed={privacy.showContact === (val === 'On')}
                      onClick={() =>
                        setPrivacy({ showContact: val === 'On' })
                      }
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <p className="small muted" style={{ marginTop: 6 }}>
                  When off, your contact number is hidden from other users.
                </p>
              </div>

              <div className="pset-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setOpen(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
