'use client'

import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { apiFetch } from '@/common/api/client'
import { navigate } from '@/common/router/router'
import { useAuth } from '@/features/authentication'
import { useTindahan } from '../context/TindahanContext'
import './ProfileSettings.css'

interface ProfileSettingsProps {}

export function ProfileSettings({}: ProfileSettingsProps) {
  const { logout } = useAuth()
  const { toast } = useTindahan()

  const [open, setOpen] = useState<'password' | 'delete' | null>(null)

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
            <p className="small muted">Password and account management.</p>
          </div>
        </div>

        {psetRow(
          <Icon name="key" size="sm" />,
          'Change password',
          'Update your account password',
          () => setOpen('password')
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

      </div>
    </>
  )
}
