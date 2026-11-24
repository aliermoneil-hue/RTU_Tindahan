import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { catOf, isSvc, peso, stamp } from '../../constants'
import { useTindahan } from '../../context/TindahanContext'
import type { UserListingRecord } from '../../types'
import './UsersAuditPage.css'

const ADM_TABS = [
  ['users', 'Users'],
  ['listings', 'Listings'],
  ['audit', 'Audit log'],
] as const

export function UsersAuditPage() {
  const {
    db,
    isStaffUser,
    acctByEmail,
    openProduct,
    openModal,
    confirmDlg,
    adminRestoreListing,
    adminResumeListing,
    toggleHideOfficialProduct,
    toast,
  } = useTindahan()

  const [tab, setTab] = useState<'users' | 'listings' | 'audit'>('users')

  // Users filters
  const [uq, setUq] = useState('')
  const [ust, setUst] = useState('all')
  const [urole, setUrole] = useState('all')

  // Listings filters
  const [lq, setLq] = useState('')
  const [lst, setLst] = useState('all')
  const [lkind, setLkind] = useState('all')
  const [lowner, setLowner] = useState('')

  // Audit filters
  const [aq, setAq] = useState('')
  const [aact, setAact] = useState('all')
  const [atype, setAtype] = useState('all')
  const [alimit, setAlimit] = useState(50)

  if (!isStaffUser) {
    return (
      <div className="card stack">
        <b>This page is for RTU staff accounts only.</b>
      </div>
    )
  }

  const admCount = (n: number, one: string, many?: string) =>
    `${n} ${n === 1 ? one : many || `${one}s`}`

  const admListState = (l: UserListingRecord): [string, string, string] => {
    const o = acctByEmail(l.ownerEmail)
    if (l.modHold) return ['Removed by staff', 'red', 'staff']
    if (o && o.status && o.status !== 'active')
      return [`Hidden, seller ${o.status}`, 'yellow', 'hidden']
    if (l.state === 'live')
      return l.paused ? ['Paused', 'yellow', 'paused'] : ['Live', 'green', 'live']
    if (l.state === 'review') return ['Pending review', 'yellow', 'review']
    if (l.state === 'removed') return ['Not approved', 'red', 'rejected']
    return [String(l.state), 'yellow', 'other']
  }

  const blocked = db.accounts.filter((a) => a.status && a.status !== 'active').length
  const held = db.userListings.filter((l) => l.modHold).length
  const reports = db.freports.filter((r) => r.status !== 'resolved').length
  const waiting = db.flags.filter((f) => f.state === 'open').length

  const filteredUsers = db.accounts
    .filter((a) => {
      const st = a.status || 'active'
      if (ust !== 'all' && st !== ust) return false
      if (urole !== 'all' && (urole === 'staff') !== (a.role === 'moderator'))
        return false
      const q = uq.trim().toLowerCase()
      if (!q) return true
      return [a.name, a.email, a.sid].some((x) =>
        String(x || '').toLowerCase().includes(q),
      )
    })
    .sort(
      (x, y) =>
        Number(x.role === 'moderator') - Number(y.role === 'moderator') ||
        x.name.localeCompare(y.name),
    )

  const filteredListings = db.userListings
    .map((l) => ({ l, st: admListState(l), o: acctByEmail(l.ownerEmail) }))
    .filter((r) => {
      const p = r.l.product
      if (lst !== 'all' && r.st[2] !== lst) return false
      if (lkind !== 'all' && (lkind === 'service') !== isSvc(p)) return false
      if (lowner && r.l.ownerEmail !== lowner) return false
      const q = lq.trim().toLowerCase()
      if (!q) return true
      return [p.name, r.o ? r.o.name : '', r.l.ownerEmail].some((x) =>
        String(x || '').toLowerCase().includes(q),
      )
    })

  const auditActs = Array.from(new Set(db.audit.map((a) => a.action))).sort()
  const auditTypes = Array.from(new Set(db.audit.map((a) => a.targetType))).sort()
  const allAudit = db.audit.slice().reverse()
  const filteredAudit = allAudit.filter((a) => {
    if (aact !== 'all' && a.action !== aact) return false
    if (atype !== 'all' && a.targetType !== atype) return false
    const q = aq.trim().toLowerCase()
    if (!q) return true
    return [a.byName, a.by, a.action, a.targetName, a.targetId, a.note].some((x) =>
      String(x || '').toLowerCase().includes(q),
    )
  })
  const shownAudit = filteredAudit.slice(0, alimit)
  const ownerAcct = lowner ? acctByEmail(lowner) : undefined

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <span className="eyebrow">STAFF · USERS AND AUDIT</span>
        <h1>Users and audit</h1>
        <p className="muted small" style={{ maxWidth: '68ch' }}>
          See every account, suspend or ban a member, restore access, remove or restore listings,
          and read the record of what staff did. Nothing here deletes an account or a transaction.
        </p>
      </div>

      <div className="adm-stats">
        {(
          [
            ['Accounts', db.accounts.length, ''],
            ['Suspended or banned', blocked, ''],
            ['Listings removed by staff', held, ''],
            ['Open forum reports', reports, 'forum-reports'],
            ['Listings waiting for approval', waiting, 'moderation'],
          ] as const
        ).map((x) =>
          x[2] ? (
            <button
              key={x[0]}
              type="button"
              className="card flat stack adm-stat"
              style={{ gap: 2, textAlign: 'left' }}
              onClick={() => navigate(x[2])}
            >
              <span className="small muted">{x[0]}</span>
              <b className="tnum" style={{ fontSize: 22 }}>
                {x[1]}
              </b>
            </button>
          ) : (
            <div key={x[0]} className="card flat stack adm-stat" style={{ gap: 2 }}>
              <span className="small muted">{x[0]}</span>
              <b className="tnum" style={{ fontSize: 22 }}>
                {x[1]}
              </b>
            </div>
          ),
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Users and audit sections">
        {ADM_TABS.map((t) => (
          <button
            key={t[0]}
            type="button"
            className={`tab ${tab === t[0] ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={tab === t[0]}
            onClick={() => setTab(t[0])}
          >
            {t[1]}
            {t[0] === 'audit' && <span className="tnum"> ({db.audit.length})</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="stack" style={{ gap: 12 }}>
        {tab === 'users' && (
          <>
            <div className="card flat adm-filters">
              <div className="field">
                <label htmlFor="adm-q">Search</label>
                <input
                  className="input"
                  id="adm-q"
                  value={uq}
                  placeholder="Name, email or student number"
                  autoComplete="off"
                  onChange={(e) => setUq(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="adm-st">Status</label>
                <select
                  className="input"
                  id="adm-st"
                  value={ust}
                  onChange={(e) => setUst(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="adm-role">Role</label>
                <select
                  className="input"
                  id="adm-role"
                  value={urole}
                  onChange={(e) => setUrole(e.target.value)}
                >
                  <option value="all">Students and staff</option>
                  <option value="student">Students</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>

            <p className="small muted" role="status">
              {filteredUsers.length} of {admCount(db.accounts.length, 'account')}
              {(uq || ust !== 'all' || urole !== 'all') && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setUq('')
                      setUst('all')
                      setUrole('all')
                    }}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </p>

            {filteredUsers.length ? (
              <div className="scroll-x">
                <table className="tbl adm-tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Listings</th>
                      <th>Orders</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((a) => {
                      const st = a.status || 'active'
                      return (
                        <tr key={a.email}>
                          <td>
                            <b>{a.name}</b>
                            <div className="tiny muted">{a.sid || ''}</div>
                          </td>
                          <td style={{ overflowWrap: 'anywhere' }}>{a.email}</td>
                          <td>{a.role === 'moderator' ? 'Staff' : 'Student'}</td>
                          <td>
                            <span
                              className={`pill ${
                                st === 'banned'
                                  ? 'red'
                                  : st === 'suspended'
                                    ? 'yellow'
                                    : 'green'
                              }`}
                            >
                              {st === 'banned'
                                ? 'Banned'
                                : st === 'suspended'
                                  ? 'Suspended'
                                  : 'Active'}
                            </span>
                          </td>
                          <td className="tnum">
                            {a.since
                              ? new Date(a.since).toLocaleDateString('en-PH', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : ''}
                          </td>
                          <td className="tnum">
                            {a.adminListingCount ??
                              db.userListings.filter((l) => l.ownerEmail === a.email).length}
                          </td>
                          <td className="tnum">{a.adminOrderCount ?? a.orders.length}</td>
                          <td>
                            <button
                              type="button"
                              className="btn ghost sm"
                              aria-label={`Manage ${a.name}`}
                              onClick={() =>
                                openModal({ kind: 'admin-user', email: a.email })
                              }
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className="card stack"
                style={{ alignItems: 'center', textAlign: 'center', padding: 32 }}
              >
                <b>No accounts match</b>
                <p className="small muted">
                  Try a different search or clear the filters.
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setUq('')
                    setUst('all')
                    setUrole('all')
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'listings' && (
          <>
            <div className="card flat adm-filters">
              <div className="field">
                <label htmlFor="adm-lq">Search</label>
                <input
                  className="input"
                  id="adm-lq"
                  value={lq}
                  placeholder="Listing or seller"
                  autoComplete="off"
                  onChange={(e) => setLq(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="adm-lst">Status</label>
                <select
                  className="input"
                  id="adm-lst"
                  value={lst}
                  onChange={(e) => setLst(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="live">Live</option>
                  <option value="paused">Paused by seller</option>
                  <option value="review">Pending review</option>
                  <option value="rejected">Not approved</option>
                  <option value="staff">Removed by staff</option>
                  <option value="hidden">Hidden, seller suspended or banned</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="adm-lkind">Type</label>
                <select
                  className="input"
                  id="adm-lkind"
                  value={lkind}
                  onChange={(e) => setLkind(e.target.value)}
                >
                  <option value="all">Products and services</option>
                  <option value="product">Products</option>
                  <option value="service">Services</option>
                </select>
              </div>
            </div>

            {ownerAcct && (
              <p className="small">
                <span className="chip">
                  Seller: {ownerAcct.name}{' '}
                  <button
                    type="button"
                    aria-label="Clear seller filter"
                    onClick={() => setLowner('')}
                  >
                    <Icon name="x" size="sm" />
                  </button>
                </span>
              </p>
            )}

            <p className="small muted" role="status">
              {filteredListings.length} of{' '}
              {admCount(db.userListings.length, 'student listing')}
              {(lst !== 'all' || lq || lkind !== 'all' || lowner) && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setLq('')
                      setLst('all')
                      setLkind('all')
                      setLowner('')
                    }}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </p>

            {filteredListings.length ? (
              <div className="scroll-x">
                <table className="tbl adm-tbl">
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th>Seller</th>
                      <th>Type</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredListings.map((r) => {
                      const p = r.l.product
                      return (
                        <tr key={r.l.lid}>
                          <td>
                            <b>{p.name}</b>
                            {r.l.modHold && (
                              <div className="tiny muted">
                                Reason: {r.l.modHold.note}
                              </div>
                            )}
                          </td>
                          <td>{r.o ? r.o.name : r.l.ownerEmail}</td>
                          <td>{isSvc(p) ? 'Service' : catOf(p)}</td>
                          <td className="tnum">{peso(p.price)}</td>
                          <td>
                            <span className={`pill ${r.st[1]}`}>{r.st[0]}</span>
                          </td>
                          <td>
                            <span className="row wrap" style={{ gap: 6 }}>
                              <button
                                type="button"
                                className="btn ghost sm"
                                onClick={() => openProduct(p.id)}
                              >
                                View
                              </button>
                              {r.l.modHold ? (
                                <button
                                  type="button"
                                  className="btn sm"
                                  onClick={() =>
                                    confirmDlg({
                                      title: 'Restore this listing?',
                                      msg: `“${p.name}” goes back to the state it had before it was removed, and the seller is told.`,
                                      yes: 'Restore listing',
                                      no: 'Cancel',
                                      run: () => {
                                        if (adminRestoreListing(r.l.lid)) {
                                          toast('Listing restored.')
                                        }
                                      },
                                    })
                                  }
                                >
                                  Restore
                                </button>
                              ) : (
                                <>
                                  {r.l.state === 'live' &&
                                    (r.l.paused ? (
                                      <button
                                        type="button"
                                        className="btn ghost sm"
                                        onClick={() => adminResumeListing(r.l.lid)}
                                      >
                                        Resume
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn ghost sm"
                                        onClick={() =>
                                          openModal({
                                            kind: 'admin-remove-listing',
                                            lid: r.l.lid,
                                          })
                                        }
                                      >
                                        Pause
                                      </button>
                                    ))}
                                  <button
                                    type="button"
                                    className="btn danger sm"
                                    onClick={() =>
                                      openModal({
                                        kind: 'admin-remove-listing',
                                        lid: r.l.lid,
                                      })
                                    }
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className="card stack"
                style={{ alignItems: 'center', textAlign: 'center', padding: 32 }}
              >
                <b>No listings match</b>
                <p className="small muted">
                  Student listings appear here once members create them.
                </p>
                {(lst !== 'all' || lq || lkind !== 'all' || lowner) && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setLq('')
                      setLst('all')
                      setLkind('all')
                      setLowner('')
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            <section className="card stack" style={{ gap: 10 }}>
              <div className="row between wrap">
                <div>
                  <b>Official RTU Store</b>
                  <p className="small muted">
                    Items sold by the school. Hiding an item is reversible. Add, edit or remove
                    items in Admin | RTU Shop.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => navigate('shop')}
                >
                  Open Admin | RTU Shop
                </button>
              </div>
              {db.official.length ? (
                <div className="scroll-x">
                  <table className="tbl adm-tbl">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Price</th>
                        <th>In stock</th>
                        <th>Status</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.official.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <b>{p.name}</b>
                          </td>
                          <td className="tnum">{peso(p.price)}</td>
                          <td className="tnum">{p.left == null ? '' : p.left}</td>
                          <td>
                            <span className={`pill ${p.hidden ? 'yellow' : 'green'}`}>
                              {p.hidden ? 'Hidden' : 'On sale'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => toggleHideOfficialProduct(p.id)}
                            >
                              {p.hidden ? 'Publish' : 'Hide'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small muted">No official items yet.</p>
              )}
            </section>
          </>
        )}

        {tab === 'audit' && (
          <>
            <p className="small muted" style={{ maxWidth: '68ch' }}>
              Every staff action on this page and on the other staff pages is written here with who
              did it, what it was done to and when. Entries cannot be edited or deleted from the
              screen.
            </p>
            <div className="card flat adm-filters">
              <div className="field">
                <label htmlFor="adm-aq">Search</label>
                <input
                  className="input"
                  id="adm-aq"
                  value={aq}
                  placeholder="Staff, target or note"
                  autoComplete="off"
                  onChange={(e) => {
                    setAq(e.target.value)
                    setAlimit(50)
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="adm-aact">Action</label>
                <select
                  className="input"
                  id="adm-aact"
                  value={aact}
                  onChange={(e) => {
                    setAact(e.target.value)
                    setAlimit(50)
                  }}
                >
                  <option value="all">All actions</option>
                  {auditActs.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="adm-atype">Target</label>
                <select
                  className="input"
                  id="adm-atype"
                  value={atype}
                  onChange={(e) => {
                    setAtype(e.target.value)
                    setAlimit(50)
                  }}
                >
                  <option value="all">All targets</option>
                  {auditTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="small muted" role="status">
              {filteredAudit.length} of{' '}
              {admCount(db.audit.length, 'entry', 'entries')}
              {(aq || aact !== 'all' || atype !== 'all') && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setAq('')
                      setAact('all')
                      setAtype('all')
                      setAlimit(50)
                    }}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </p>

            {shownAudit.length ? (
              <>
                <div className="scroll-x">
                  <table className="tbl adm-tbl">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Staff</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownAudit.map((a) => (
                        <tr key={a.id}>
                          <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                            {stamp(a.ts)}
                          </td>
                          <td>{a.byName || a.by}</td>
                          <td>
                            <b>{a.action}</b>
                          </td>
                          <td>
                            {a.targetType}: {a.targetName || a.targetId}
                          </td>
                          <td style={{ overflowWrap: 'anywhere' }}>{a.note || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredAudit.length > shownAudit.length && (
                  <div className="row" style={{ justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setAlimit((n) => n + 50)}
                    >
                      Show more
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div
                className="card stack"
                style={{ alignItems: 'center', textAlign: 'center', padding: 32 }}
              >
                <b>
                  {db.audit.length
                    ? 'No entries match'
                    : 'No staff actions recorded yet'}
                </b>
                <p className="small muted">
                  {db.audit.length
                    ? 'Try a different search or clear the filters.'
                    : 'When staff suspend an account, remove a listing or moderate the forum, it appears here.'}
                </p>
                {db.audit.length > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setAq('')
                      setAact('all')
                      setAtype('all')
                      setAlimit(50)
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
