import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { monthYear } from '../../constants'
import { useTindahan } from '../../context/TindahanContext'
import './StaffToolsPage.css'

export function StaffToolsPage() {
  const {
    db,
    isStaffUser,
    storageOk,
    storageKb,
    postStaffAnnouncement,
    deleteStaffAnnouncement,
    exportDatabaseBackup,
    importDatabaseBackup,
    openModal,
    setDraft,
    setListStep,
  } = useTindahan()

  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')

  if (!isStaffUser) {
    return (
      <div className="card stack">
        <b>This page is for RTU staff accounts only.</b>
      </div>
    )
  }

  const members = db.accounts.filter((a) => a.role !== 'moderator')
  const waiting = db.flags.filter((f) => f.state === 'open').length
  const storeReq = db.txn.filter(
    (t) =>
      t.type === 'official' &&
      !t.sellerEmail &&
      (t.status === 'Pending' || t.status === 'Confirmed'),
  ).length

  return (
    <>
      <div className="row between wrap">
        <div>
          <span className="eyebrow">RTU STAFF</span>
          <h1>Staff tools</h1>
          <p className="muted small">
            Post campus notices, view members, and manage backups. Official RTU Store products are
            created via <b>Admin | Sell an Item</b> and managed in <b>Admin | RTU Shop</b>.
          </p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn yellow sm"
            onClick={() => navigate('shop')}
          >
            <Icon name="eye" size="sm" />
            Admin | RTU Shop
          </button>
          <button
            type="button"
            className="btn ghost sm"
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
        </div>
      </div>

      <div className="staff-stats">
        {(
          [
            ['Members', String(members.length)],
            ['Student listings', String(db.userListings.length)],
            [
              'Official products on sale',
              `${db.official.filter((p) => !p.hidden).length} of ${db.official.length}`,
            ],
            ['Waiting for approval', String(waiting)],
            ['Store requests open', String(storeReq)],
          ] as const
        ).map((x) => (
          <div key={x[0]} className="card flat stack" style={{ gap: 2 }}>
            <span className="small muted">{x[0]}</span>
            <b className="tnum" style={{ fontSize: 24 }}>
              {x[1]}
            </b>
          </div>
        ))}
      </div>

      <div className="staff-two two">
        <div className="stack">
          <form
            className="card stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (postStaffAnnouncement(annTitle, annBody)) {
                setAnnTitle('')
                setAnnBody('')
              }
            }}
          >
            <div>
              <b>Post an announcement</b>
              <p className="small muted">
                Members see it on their profile and get an alert.
              </p>
            </div>
            <div className="field">
              <label htmlFor="an-t">Title</label>
              <input
                className="input"
                id="an-t"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="an-b">Message</label>
              <textarea
                className="input"
                id="an-b"
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
              />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn">
                Post
              </button>
            </div>
          </form>

          <div className="card stack">
            <b>Posted announcements</b>
            {db.ann.length ? (
              db.ann.map((a, i) => (
                <div
                  key={a.id || i}
                  className="row between wrap"
                  style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}
                >
                  <div>
                    <b className="small">{a.t}</b>
                    <div className="tiny muted">{a.d}</div>
                  </div>
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() => deleteStaffAnnouncement(i)}
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p className="small muted">Nothing posted yet.</p>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card stack">
            <b>Members</b>
            {members.length ? (
              members.map((a) => (
                <div
                  key={a.email}
                  className="row between wrap"
                  style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}
                >
                  <div>
                    <b className="small">{a.name}</b>
                    <div className="tiny muted" style={{ overflowWrap: 'anywhere' }}>
                      {a.email}
                    </div>
                  </div>
                  <span className="tiny muted">Joined {monthYear(a.since)}</span>
                </div>
              ))
            ) : (
              <p className="small muted">Nobody has signed up yet.</p>
            )}
          </div>

          <div className="card stack">
            <div>
              <b>Backup and storage</b>
              <p className="small muted">
                {storageOk
                  ? 'Saved in this browser (localStorage). No server needed.'
                  : 'Browser storage is blocked, so data lives in memory only.'}{' '}
                Current size: <span className="tnum">{storageKb} KB</span>. Open the app in two
                tabs and changes show up in both.
              </p>
            </div>
            <div className="row wrap">
              <button
                type="button"
                className="btn"
                onClick={exportDatabaseBackup}
              >
                Download backup
              </button>
              <label className="btn ghost" style={{ cursor: 'pointer' }}>
                Import backup
                <input
                  type="file"
                  id="imp-file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) importDatabaseBackup(file)
                  }}
                />
              </label>
            </div>
          </div>

          <div
            className="card stack"
            style={{ background: 'var(--red-bg)', borderColor: 'transparent' }}
          >
            <b>Reset the prototype</b>
            <p className="small">
              Deletes every account, listing, order, request and announcement saved in this
              browser. Use it before a presentation to start clean.
            </p>
            <button
              type="button"
              className="btn danger"
              onClick={() => openModal({ kind: 'reset-all' })}
            >
              Reset everything
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
