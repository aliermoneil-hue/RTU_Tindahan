import { useMemo, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { playSuccess } from '@/common/sounds'
import {
  BAO_EMAIL_EVENTS,
  BAO_OPEN,
  BAO_PILL,
  BAO_SOURCES,
  BAO_STATUSES,
  baoAge,
  baoDate,
  baoDefaultEmailConfig,
  baoDownloadCsv,
  baoIsOfficialTxn,
  baoReserved,
  baoStatusOf,
  baoUnit,
} from '../../baoHelpers'
import { hasVars, peso, stamp, stockOf, unitPrice, vLineName, varLabel } from '../../constants'
import { useTindahan } from '../../context/TindahanContext'
import type { BaoStatus, TransactionRecord } from '../../types'
import './StoreOrdersPage.css'

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA')
/** Tickets that came from the store API carry an `api:` id prefix; the
 * permanent reference the office quotes is the part after it. */
const ticketRef = (t: { id: string }) => t.id.replace(/^api:/, '')
const todayIso = () => new Date().toLocaleDateString('en-CA')

export function StoreOrdersPage() {
  const {
    db,
    currentAccount,
    isStaffUser,
    byId,
    baoTab,
    setBaoTab,
    baoSearch,
    setBaoSearch,
    baoStatusFilter,
    setBaoStatusFilter,
    baoTransitionTicket,
    baoSaveOrderSettings,
    baoCreateFaceToFaceOrder,
    baoSaveEmailSettings,
    baoExportPreparedEmailsJson,
    openModal,
    toast,
  } = useTindahan()

  // Ticket list additional filters
  const [srcFilter, setSrcFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [pickFilter, setPickFilter] = useState('')

  // Face-to-Face quick entry form state
  const [f2fName, setF2fName] = useState('')
  const [f2fSid, setF2fSid] = useState('')
  const [f2fEmail, setF2fEmail] = useState('')
  const [f2fDate, setF2fDate] = useState(todayIso)
  const [f2fNotes, setF2fNotes] = useState('')
  const [f2fLines, setF2fLines] = useState<Array<{ pid: string; vid: string; qty: number }>>([])
  const [f2fPid, setF2fPid] = useState('')
  const [f2fVid, setF2fVid] = useState('')
  const [f2fQty, setF2fQty] = useState('1')
  const [f2fLast, setF2fLast] = useState<{ id: string; queue?: string | null } | null>(null)

  // Compiled Order Sheet filter state
  const [shItem, setShItem] = useState('')
  const [shStatus, setShStatus] = useState('')
  const [shFrom, setShFrom] = useState('')
  const [shTo, setShTo] = useState('')

  // Email settings state
  const emCfg = useMemo(() => baoDefaultEmailConfig(db.bao.email), [db.bao.email])
  const [emEvents, setEmEvents] = useState<Record<string, boolean>>(() => ({ ...emCfg.events }))
  const [emLow, setEmLow] = useState<boolean>(emCfg.lowStock)
  const [emTo, setEmTo] = useState<string>(() => emCfg.lowStockTo.join(', '))

  // Settings tab local state
  const sCfg = db.bao.settings
  const [transitions, setTransitions] = useState<Record<BaoStatus, BaoStatus[]>>(() =>
    JSON.parse(JSON.stringify(sCfg.transitions)),
  )
  const [reasonReq, setReasonReq] = useState<BaoStatus[]>(() => [...sCfg.reasonRequired])
  const [studentCancel, setStudentCancel] = useState<BaoStatus[]>(() => [
    ...sCfg.studentCancelFrom,
  ])
  const [qEnabled, setQEnabled] = useState<boolean>(sCfg.queue.enabled)
  const [qPrefix, setQPrefix] = useState<string>(sCfg.queue.prefix)
  const [qPad, setQPad] = useState<string>(String(sCfg.queue.pad || 3))
  const [qDailyReset, setQDailyReset] = useState<boolean>(sCfg.queue.dailyReset)
  const [claimNote, setClaimNote] = useState<string>(sCfg.claimNote || '')

  if (!isStaffUser) {
    return (
      <div
        className="card stack"
        style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
      >
        <span style={{ color: 'var(--blue)' }}>
          <Icon name="lock" />
        </span>
        <b>RTU staff only</b>
        <p className="small muted">
          Store orders can only be opened by BAO and RTU staff accounts.
        </p>
        <button type="button" className="btn" onClick={() => navigate('marketplace')}>
          Back to marketplace
        </button>
      </div>
    )
  }

  const officialTxns = db.txn.filter(baoIsOfficialTxn)

  // Item options for ticket filter
  const itemOptions = (() => {
    const m = new Map<string, string>()
    officialTxns.forEach((t) =>
      t.lines.forEach((l) => {
        if (!l.pid) return
        const p = byId(l.pid)
        m.set(l.pid, p ? p.name : String(l.name).replace(/ \(.*\)$/, ''))
      }),
    )
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  })()

  // Filtered tickets
  const filteredRows = officialTxns
    .filter((t) => {
      const st = baoStatusOf(t)
      if (baoStatusFilter && st !== baoStatusFilter) return false
      if (srcFilter && (t.src || 'Online') !== srcFilter) return false
      if (itemFilter && !t.lines.some((l) => l.pid === itemFilter)) return false
      if (fromFilter && dayKey(t.created) < fromFilter) return false
      if (toFilter && dayKey(t.created) > toFilter) return false
      if (pickFilter && t.pickup !== pickFilter) return false
      const q = baoSearch.trim().toLowerCase()
      if (q) {
        const hay = [
          t.id,
          ticketRef(t),
          t.queue || '',
          t.orderId,
          t.buyerName,
          t.buyerEmail,
          t.buyerSid,
          t.summary,
          t.lines.map((l) => l.name).join(' '),
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => String(b.created).localeCompare(String(a.created)))

  const resetFilters = () => {
    setBaoSearch('')
    setBaoStatusFilter('')
    setSrcFilter('')
    setItemFilter('')
    setFromFilter('')
    setToFilter('')
    setPickFilter('')
  }

  const handleQuickNextStep = (t: TransactionRecord, nextSt: BaoStatus) => {
    if (db.bao.settings.reasonRequired.includes(nextSt)) {
      openModal({ kind: 'bao-ticket', txnId: t.id })
      return
    }
    const r = baoTransitionTicket(t.id, nextSt)
    if (!r.ok) {
      toast(r.msg || 'Could not update status.')
      return
    }
    playSuccess()
    toast(`Ticket ${ticketRef(t)} is now ${nextSt}.`)
  }

  const exportTicketsCsv = () => {
    if (!filteredRows.length) {
      toast('No tickets match the filters.')
      return
    }
    const head = [
      'TXN id',
      'Queue number',
      'Source',
      'Requested',
      'Pickup date',
      'Student',
      'Student number',
      'Email',
      'Items',
      'Quantity',
      'Total (PHP)',
      'Status',
      'Latest note',
    ]
    const body = filteredRows.map((t) => [
      ticketRef(t),
      t.queue || '',
      t.src || 'Online',
      stamp(t.created),
      t.pickup || '',
      t.buyerName,
      t.buyerSid || '',
      t.buyerEmail || '',
      t.summary,
      t.qty,
      t.total,
      baoStatusOf(t),
      t.note || '',
    ])
    baoDownloadCsv(
      `rtu-store-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      [head, ...body],
    )
    toast(`${filteredRows.length} ticket${filteredRows.length === 1 ? '' : 's'} exported.`)
  }

  // Face-to-Face helpers
  const saleItems = db.official
    .filter((p) => !p.hidden)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const selectedF2fProd = f2fPid ? byId(f2fPid) : undefined
  const f2fHasVars = Boolean(selectedF2fProd && hasVars(selectedF2fProd))
  const f2fTaken = (pid: string, vid: string) =>
    f2fLines
      .filter((l) => l.pid === pid && (l.vid || '') === (vid || ''))
      .reduce((a, l) => a + l.qty, 0)

  const handleF2fAddLine = () => {
    if (!selectedF2fProd) {
      toast('Choose an item.')
      return
    }
    if (f2fHasVars && !f2fVid) {
      toast(`Choose the ${selectedF2fProd.vars!.attrs[0].name.toLowerCase()}.`)
      return
    }
    const q = parseInt(f2fQty, 10)
    if (!(q >= 1)) {
      toast('Quantity must be 1 or more.')
      return
    }
    const vid = f2fHasVars ? f2fVid : ''
    const have = f2fTaken(selectedF2fProd.id, vid)
    const av = stockOf(selectedF2fProd, vid)
    if (have + q > av) {
      toast(av - have > 0 ? `Only ${av - have} available.` : 'None available.')
      return
    }
    setF2fLines((prev) => {
      const copy = prev.map((x) => ({ ...x }))
      const ex = copy.find((l) => l.pid === selectedF2fProd.id && l.vid === vid)
      if (ex) ex.qty += q
      else copy.push({ pid: selectedF2fProd.id, vid, qty: q })
      return copy
    })
    setF2fQty('1')
  }

  const f2fTotal = f2fLines.reduce((acc, l) => {
    const p = byId(l.pid)
    return acc + (p ? unitPrice(p, l.vid) * l.qty : 0)
  }, 0)

  // Compiled Order Sheet rows
  const sheetRows = (() => {
    const map = new Map<
      string,
      { pid: string; vid: string; requested: number; tickets: Set<string> }
    >()
    officialTxns.forEach((t) => {
      const s = baoStatusOf(t)
      if ((t.src || 'Online') !== 'Online' || !BAO_OPEN.includes(s)) return
      if (shStatus && s !== shStatus) return
      if (shFrom && dayKey(t.created) < shFrom) return
      if (shTo && dayKey(t.created) > shTo) return
      t.lines.forEach((l) => {
        if (!l.pid) return
        if (shItem && l.pid !== shItem) return
        const k = `${l.pid}|${l.vid || ''}`
        const r = map.get(k) || {
          pid: l.pid,
          vid: l.vid || '',
          requested: 0,
          tickets: new Set<string>(),
        }
        r.requested += l.qty
        r.tickets.add(t.id)
        map.set(k, r)
      })
    })
    return [...map.values()]
      .map((r) => {
        const p = byId(r.pid)
        const u = p ? baoUnit(p, r.vid) : null
        return {
          ...r,
          name: p ? p.name : 'Removed item',
          label: u ? u.label : '',
          onHand: u ? u.onHand : 0,
          reserved: u ? baoReserved(u) : 0,
          available: u ? u.available : 0,
          short: Math.max(0, r.requested - (u ? u.onHand : 0)),
          refs: [...r.tickets],
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.label.localeCompare(b.label))
  })()

  const tabs: Array<
    ['list' | 'overview' | 'f2f' | 'sheet' | 'email' | 'settings', string]
  > = [
    ['list', 'Tickets'],
    ['overview', 'Overview'],
    ['f2f', 'Face to face'],
    ['sheet', 'Order sheet'],
    ['email', 'Email'],
    ['settings', 'Settings'],
  ]

  const studentAccounts = db.accounts.filter((a) => a.role !== 'moderator')

  return (
    <>
      <div className="row between wrap">
        <div style={{ maxWidth: '66ch' }}>
          <span className="eyebrow">BAO · OFFICIAL RTU STORE</span>
          <h1>Store orders</h1>
          <p className="muted small">
            Every request to the Official RTU Store has a ticket here. The TXN id is the permanent
            reference. Cancelled tickets stay in the list.
          </p>
        </div>
        <div className="row wrap no-print" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => navigate('baostock')}
          >
            <Icon name="tag" size="sm" />
            Store inventory
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() => setBaoTab('f2f')}
          >
            <Icon name="plus" size="sm" />
            Face-to-face entry
          </button>
        </div>
      </div>

      {/* Quick KPI status bar visible across tabs */}
      <div className="bao-stats no-print">
        {BAO_STATUSES.map((s) => {
          const count = officialTxns.filter((t) => baoStatusOf(t) === s).length
          const isSelected = baoStatusFilter === s && baoTab === 'list'
          return (
            <button
              key={s}
              type="button"
              className={`card flat stack bao-stat ${isSelected ? 'on' : ''}`.trim()}
              style={{ gap: 2, textAlign: 'left' }}
              onClick={() => {
                setBaoStatusFilter(baoStatusFilter === s && baoTab === 'list' ? '' : s)
                setBaoTab('list')
              }}
            >
              <span className="small muted">{s}</span>
              <b className="tnum" style={{ fontSize: 24 }}>
                {count}
              </b>
            </button>
          )
        })}
      </div>

      <div className="tabs no-print" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`tab ${baoTab === k ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={baoTab === k}
            onClick={() => setBaoTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: TICKETS LIST */}
      {baoTab === 'list' && (
        <>
          <div className="card tx-filters bao-filters no-print">
            <div className="field">
              <label htmlFor="bo-q">Search</label>
              <input
                className="input"
                id="bo-q"
                value={baoSearch}
                placeholder="TXN id, queue number, student, student number or item"
                onChange={(e) => setBaoSearch(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="bo-status">Status</label>
              <select
                className="input"
                id="bo-status"
                value={baoStatusFilter}
                onChange={(e) => setBaoStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                {BAO_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bo-src">Source</label>
              <select
                className="input"
                id="bo-src"
                value={srcFilter}
                onChange={(e) => setSrcFilter(e.target.value)}
              >
                <option value="">All</option>
                {BAO_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bo-item">Item</label>
              <select
                className="input"
                id="bo-item"
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
              >
                <option value="">All</option>
                {itemOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bo-from">Requested from</label>
              <input
                className="input"
                id="bo-from"
                type="date"
                value={fromFilter}
                onChange={(e) => setFromFilter(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="bo-to">Requested to</label>
              <input
                className="input"
                id="bo-to"
                type="date"
                value={toFilter}
                onChange={(e) => setToFilter(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="bo-pick">Pickup date</label>
              <input
                className="input"
                id="bo-pick"
                type="date"
                value={pickFilter}
                onChange={(e) => setPickFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="row between wrap">
            <span className="small muted tnum">
              {filteredRows.length} of {officialTxns.length} ticket
              {officialTxns.length === 1 ? '' : 's'}
            </span>
            <span className="row wrap no-print" style={{ gap: 8 }}>
              {(baoSearch ||
                baoStatusFilter ||
                srcFilter ||
                itemFilter ||
                fromFilter ||
                toFilter ||
                pickFilter) && (
                <button type="button" className="link" onClick={resetFilters}>
                  Clear filters
                </button>
              )}
              <button type="button" className="btn ghost sm" onClick={exportTicketsCsv}>
                <Icon name="upload" size="sm" />
                Export CSV
              </button>
              <button type="button" className="btn ghost sm" onClick={() => window.print()}>
                <Icon name="print" size="sm" />
                Print
              </button>
            </span>
          </div>

          {filteredRows.length ? (
            <div className="card" style={{ padding: 0 }}>
              <div className="scroll-x">
                <table className="tbl" style={{ minWidth: 940 }} id="bao-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Requested</th>
                      <th>Student</th>
                      <th>Items</th>
                      <th>Qty</th>
                      <th>Source</th>
                      <th>Pickup</th>
                      <th>Status</th>
                      <th className="no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((t) => {
                      const st = baoStatusOf(t)
                      const nextAllowed = db.bao.settings.transitions[st] || []
                      const primaryNext = nextAllowed.find(
                        (cand) =>
                          cand !== 'On Hold' &&
                          cand !== 'Cancelled' &&
                          !db.bao.settings.reasonRequired.includes(cand),
                      )
                      return (
                        <tr key={t.id}>
                          <td className="tnum">
                            <b>{ticketRef(t)}</b>
                            {t.queue && <div className="tiny muted">Queue {t.queue}</div>}
                          </td>
                          <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                            {stamp(t.created)}
                          </td>
                          <td>
                            {t.buyerName}
                            <div className="tiny muted">{t.buyerSid || ''}</div>
                          </td>
                          <td>{t.summary}</td>
                          <td className="tnum">{t.qty}</td>
                          <td>{t.src || 'Online'}</td>
                          <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                            {t.pickup ? (
                              baoDate(t.pickup)
                            ) : (
                              <span className="muted">Not set</span>
                            )}
                          </td>
                          <td>
                            <span className={`pill ${BAO_PILL[st] || ''}`}>{st}</span>
                          </td>
                          <td className="no-print">
                            <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                              {primaryNext && (
                                <button
                                  type="button"
                                  className="btn ghost sm"
                                  title={`Quick transition to ${primaryNext}`}
                                  onClick={() => handleQuickNextStep(t, primaryNext)}
                                >
                                  → {primaryNext}
                                </button>
                              )}
                              <button
                                type="button"
                                className="rowbtn"
                                onClick={() =>
                                  openModal({ kind: 'bao-ticket', txnId: t.id })
                                }
                              >
                                Open
                              </button>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div
              className="card stack"
              style={{ alignItems: 'center', textAlign: 'center', padding: 40 }}
            >
              <b>{officialTxns.length ? 'No tickets match' : 'No tickets yet'}</b>
              <p className="small muted" style={{ maxWidth: '52ch' }}>
                {officialTxns.length
                  ? 'Try clearing a filter or searching for something else.'
                  : 'When a student sends a request to the Official RTU Store, it appears here.'}
              </p>
              {officialTxns.length > 0 && (
                <button type="button" className="btn" onClick={resetFilters}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: OVERVIEW */}
      {baoTab === 'overview' && (
        <div className="card stack">
          <b>Oldest open requests</b>
          {(() => {
            const openList = officialTxns
              .filter((t) =>
                ['Request Received', 'Confirmed', 'On Hold'].includes(baoStatusOf(t)),
              )
              .sort((a, b) => String(a.created).localeCompare(String(b.created)))
              .slice(0, 8)

            if (!openList.length) {
              return <p className="small muted">No open requests.</p>
            }

            return openList.map((t) => {
              const st = baoStatusOf(t)
              return (
                <div
                  key={t.id}
                  className="row between wrap"
                  style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <b className="small tnum">{ticketRef(t)}</b>
                    {t.queue && <span className="tiny muted"> Queue {t.queue}</span>}
                    <div className="tiny muted" style={{ overflowWrap: 'anywhere' }}>
                      {t.buyerName} · {t.summary}
                    </div>
                  </div>
                  <span className="row wrap" style={{ gap: 8 }}>
                    <span className={`pill ${BAO_PILL[st] || ''}`}>{st}</span>
                    <span className="tiny muted">waiting {baoAge(t.created)}</span>
                    <button
                      type="button"
                      className="rowbtn"
                      onClick={() => openModal({ kind: 'bao-ticket', txnId: t.id })}
                    >
                      Open
                    </button>
                  </span>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* TAB 3: FACE TO FACE QUICK ENTRY */}
      {baoTab === 'f2f' && (
        <>
          {f2fLast && (
            <div className="note" role="status" data-f2f-last>
              <Icon name="check" />
              <span>
                <b>Saved.</b> Ticket <b className="tnum">{f2fLast.id}</b>
                {f2fLast.queue ? (
                  <>
                    {' '}
                    · Queue number <b className="tnum">{f2fLast.queue}</b>
                  </>
                ) : null}
                . Stock was updated once.
              </span>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => openModal({ kind: 'bao-ticket', txnId: f2fLast.id })}
              >
                View ticket
              </button>
            </div>
          )}

          <form
            className="stack"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await baoCreateFaceToFaceOrder({
                name: f2fName,
                sid: f2fSid,
                email: f2fEmail,
                date: f2fDate,
                notes: f2fNotes,
                lines: f2fLines,
              })
              if (!res.ok) {
                toast(res.msg || 'Could not save face to face entry.')
                return
              }
              playSuccess()
              setF2fLast({ id: res.txnId!, queue: res.queue })
              setF2fName('')
              setF2fSid('')
              setF2fEmail('')
              setF2fDate(todayIso())
              setF2fNotes('')
              setF2fLines([])
              setF2fPid('')
              setF2fVid('')
              setF2fQty('1')
              toast(`Face to face entry ${res.txnId} saved.`)
            }}
          >
            <div className="note blue">
              <Icon name="info" size="sm" />
              <span className="small">
                Use this for a student served at the counter. The stock goes down right away (a
                &ldquo;Sold&rdquo; line in the ledger). The ordering window is not checked here.
                The per-student limit is checked when the student is identified by student number
                or email.
              </span>
            </div>

            <div className="card stack">
              <div className="row between wrap">
                <b>Student</b>
                {studentAccounts.length > 0 && (
                  <label className="row small" style={{ gap: 6 }}>
                    <span className="tiny muted">Quick fill registered student:</span>
                    <select
                      className="input"
                      style={{ width: 'auto', paddingBlock: 4 }}
                      value=""
                      onChange={(e) => {
                        const acct = studentAccounts.find((a) => a.email === e.target.value)
                        if (acct) {
                          setF2fName(acct.name)
                          setF2fSid(acct.sid)
                          setF2fEmail(acct.email)
                        }
                      }}
                    >
                      <option value="">Choose student account (optional)...</option>
                      {studentAccounts.map((a) => (
                        <option key={a.email} value={a.email}>
                          {a.name} ({a.sid})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="ff-name">Student name</label>
                  <input
                    className="input"
                    id="ff-name"
                    maxLength={80}
                    value={f2fName}
                    placeholder="Full name"
                    onChange={(e) => setF2fName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ff-sid">Student number (optional)</label>
                  <input
                    className="input"
                    id="ff-sid"
                    maxLength={20}
                    value={f2fSid}
                    placeholder="e.g. 2024-123456"
                    onChange={(e) => setF2fSid(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="ff-email">
                    RTU email (optional, links the entry to their account)
                  </label>
                  <input
                    className="input"
                    id="ff-email"
                    type="email"
                    maxLength={80}
                    value={f2fEmail}
                    placeholder="2024-123456@rtu.edu.ph"
                    onChange={(e) => setF2fEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ff-date">Date</label>
                  <input
                    className="input"
                    id="ff-date"
                    type="date"
                    max={todayIso()}
                    value={f2fDate}
                    onChange={(e) => setF2fDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="card stack">
              <div className="row between wrap">
                <b>Items</b>
                {f2fLines.length > 0 && (
                  <span className="price tnum">Total: {peso(f2fTotal)}</span>
                )}
              </div>
              {f2fLines.length ? (
                f2fLines.map((l, i) => {
                  const p = byId(l.pid)
                  const lineTitle = p ? vLineName(p, l.vid) : 'Removed item'
                  const linePrice = p ? unitPrice(p, l.vid) * l.qty : 0
                  return (
                    <div
                      key={`${l.pid}-${l.vid}-${i}`}
                      className="row between small"
                      style={{ borderBottom: '1px solid var(--line)', paddingBottom: 6 }}
                    >
                      <span style={{ overflowWrap: 'anywhere' }}>
                        {lineTitle} × {l.qty}
                      </span>
                      <span className="row" style={{ gap: 10 }}>
                        <b className="tnum">{peso(linePrice)}</b>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() =>
                            setF2fLines((prev) => prev.filter((_, idx) => idx !== i))
                          }
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  )
                })
              ) : (
                <p className="small muted">No items yet. Choose an item and press Add.</p>
              )}

              <div className="row wrap" style={{ gap: 8, alignItems: ' flex-end' }}>
                <div className="field" style={{ minWidth: 200, flex: 1 }}>
                  <label htmlFor="ff-pid">Item</label>
                  <select
                    className="input"
                    id="ff-pid"
                    value={f2fPid}
                    onChange={(e) => {
                      setF2fPid(e.target.value)
                      setF2fVid('')
                    }}
                  >
                    <option value="">Choose an item</option>
                    {saleItems.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} ({peso(x.price)})
                      </option>
                    ))}
                  </select>
                </div>

                {f2fHasVars && selectedF2fProd?.vars && (
                  <div className="field">
                    <label htmlFor="ff-vid">{selectedF2fProd.vars.attrs[0].name}</label>
                    <select
                      className="input"
                      id="ff-vid"
                      value={f2fVid}
                      onChange={(e) => setF2fVid(e.target.value)}
                    >
                      <option value="">Choose</option>
                      {selectedF2fProd.vars.rows.map((r) => (
                        <option key={r.id} value={r.id}>
                          {varLabel(selectedF2fProd, r)} (
                          {Math.max(0, r.qty - f2fTaken(selectedF2fProd.id, r.id))} available)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="ff-qty">Quantity</label>
                  <input
                    className="input tnum"
                    id="ff-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={f2fQty}
                    style={{ width: 100 }}
                    onChange={(e) => setF2fQty(e.target.value)}
                  />
                </div>
                <button type="button" className="btn ghost" onClick={handleF2fAddLine}>
                  Add
                </button>
              </div>
              {selectedF2fProd && !f2fHasVars && (
                <span className="tiny muted">
                  {Math.max(0, selectedF2fProd.left - f2fTaken(selectedF2fProd.id, ''))} available.
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="ff-notes">Notes (optional)</label>
              <textarea
                className="input"
                id="ff-notes"
                maxLength={200}
                value={f2fNotes}
                onChange={(e) => setF2fNotes(e.target.value)}
              />
            </div>

            <div className="row between wrap">
              <span className="small muted">Entered by {currentAccount?.name || 'Staff'}</span>
              <button type="submit" className="btn" disabled={!f2fLines.length}>
                Save face to face entry
              </button>
            </div>
          </form>
        </>
      )}

      {/* TAB 4: COMPILED ONLINE ORDER SHEET */}
      {baoTab === 'sheet' && (
        <>
          <div className="note blue no-print">
            <Icon name="info" size="sm" />
            <span className="small">
              Open <b>online</b> requests added up by item and size, for the BAO to prepare.
              Claimed and cancelled tickets are not included. Face to face entries are not
              included.
            </span>
          </div>

          <div className="card tx-filters bao-filters no-print">
            <div className="field">
              <label htmlFor="sh-item">Item</label>
              <select
                className="input"
                id="sh-item"
                value={shItem}
                onChange={(e) => setShItem(e.target.value)}
              >
                <option value="">All</option>
                {db.official.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sh-status">Ticket status</label>
              <select
                className="input"
                id="sh-status"
                value={shStatus}
                onChange={(e) => setShStatus(e.target.value)}
              >
                <option value="">All open</option>
                {BAO_OPEN.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sh-from">Requested from</label>
              <input
                className="input"
                id="sh-from"
                type="date"
                value={shFrom}
                onChange={(e) => setShFrom(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sh-to">Requested to</label>
              <input
                className="input"
                id="sh-to"
                type="date"
                value={shTo}
                onChange={(e) => setShTo(e.target.value)}
              />
            </div>
          </div>

          {(() => {
            const shorts = sheetRows.filter((r) => r.short > 0)
            const totalUnits = sheetRows.reduce((a, r) => a + r.requested, 0)
            return (
              <>
                {shorts.length > 0 && (
                  <div className="note" role="status" data-sheet-short>
                    <Icon name="clock" />
                    <span>
                      <b>
                        {shorts.length} shortage{shorts.length === 1 ? '' : 's'}.
                      </b>{' '}
                      {shorts
                        .map(
                          (r) =>
                            `${r.name}${r.label ? ' (' + r.label + ')' : ''} is short by ${
                              r.short
                            }`,
                        )
                        .join(', ')}
                      .
                    </span>
                  </div>
                )}

                <div className="row between wrap">
                  <span className="small muted tnum">
                    {sheetRows.length} line{sheetRows.length === 1 ? '' : 's'} · {totalUnits} unit
                    {totalUnits === 1 ? '' : 's'} requested
                  </span>
                  <span className="row wrap no-print" style={{ gap: 8 }}>
                    {(shItem || shStatus || shFrom || shTo) && (
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          setShItem('')
                          setShStatus('')
                          setShFrom('')
                          setShTo('')
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => {
                        if (!sheetRows.length) {
                          toast('No open online requests match.')
                          return
                        }
                        baoDownloadCsv(
                          `rtu-order-sheet-${new Date().toISOString().slice(0, 10)}.csv`,
                          [
                            [
                              'Item',
                              'Size',
                              'Requested',
                              'On hand',
                              'Reserved',
                              'Available',
                              'Shortage',
                              'Tickets',
                            ],
                            ...sheetRows.map((r) => [
                              r.name,
                              r.label,
                              r.requested,
                              r.onHand,
                              r.reserved,
                              r.available,
                              r.short,
                              r.refs.join(' '),
                            ]),
                          ],
                        )
                      }}
                    >
                      <Icon name="upload" size="sm" />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => window.print()}
                    >
                      <Icon name="print" size="sm" />
                      Print
                    </button>
                  </span>
                </div>

                {sheetRows.length ? (
                  <div className="card" style={{ padding: 0 }}>
                    <div className="scroll-x">
                      <table className="tbl" style={{ minWidth: 860 }} id="sheet-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Size</th>
                            <th>Requested</th>
                            <th>On hand</th>
                            <th>Reserved</th>
                            <th>Available</th>
                            <th>Shortage</th>
                            <th>Tickets</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheetRows.map((r) => (
                            <tr key={`${r.pid}|${r.vid}`}>
                              <td>
                                <b>{r.name}</b>
                              </td>
                              <td>
                                {r.label ? r.label : <span className="muted">No sizes</span>}
                              </td>
                              <td className="tnum">
                                <b>{r.requested}</b>
                              </td>
                              <td className="tnum">{r.onHand}</td>
                              <td className="tnum">{r.reserved}</td>
                              <td className="tnum">{r.available}</td>
                              <td className="tnum">
                                {r.short ? (
                                  <span className="pill red">{r.short}</span>
                                ) : (
                                  <span className="muted">None</span>
                                )}
                              </td>
                              <td
                                className="tiny"
                                style={{ maxWidth: 260, overflowWrap: 'anywhere' }}
                              >
                                {r.refs.join(', ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: 36 }}>
                    <b>No open online requests</b>
                    <p className="small muted">Nothing to prepare right now.</p>
                  </div>
                )}
              </>
            )
          })()}
        </>
      )}

      {/* TAB 5: EMAIL OUTBOX & SETTINGS */}
      {baoTab === 'email' && (
        <>
          <div className="note" role="status" data-email-off>
            <Icon name="lock" />
            <span>
              <b>Email sending is off. Nothing is sent.</b> This tab shows the messages the system
              would send once the IT Office sets up a mail service on a server. A prototype that
              runs only in the browser cannot send email safely.
            </span>
          </div>

          <form
            className="stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              baoSaveEmailSettings(emEvents, emLow, emTo)
            }}
          >
            <div className="card stack">
              <b>Messages the system prepares</b>
              <p className="small muted">
                To the student&rsquo;s RTU email (@{emCfg.domain}). Same facts as the in-app
                ticket. No payment links and no student number.
              </p>
              <div className="row wrap" style={{ gap: 14 }}>
                {BAO_EMAIL_EVENTS.map((ev) => (
                  <label key={ev} className="row small" style={{ gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={emEvents[ev] !== false}
                      onChange={(e) =>
                        setEmEvents((prev) => ({ ...prev, [ev]: e.target.checked }))
                      }
                    />
                    {ev}
                  </label>
                ))}
              </div>
              <label className="row small" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={emLow}
                  onChange={(e) => setEmLow(e.target.checked)}
                />
                Low stock warning to staff
              </label>
              <div className="field">
                <label htmlFor="em-to">
                  Staff email addresses for low stock (separate with commas)
                </label>
                <input
                  className="input"
                  id="em-to"
                  value={emTo}
                  placeholder="Empty until the BAO says who should get them"
                  onChange={(e) => setEmTo(e.target.value)}
                />
              </div>
            </div>

            <div className="card stack">
              <b>Sending</b>
              <label className="row small" style={{ gap: 6 }}>
                <input type="checkbox" disabled checked={false} />
                Send emails
              </label>
              <p className="tiny muted">
                This switch is locked in the prototype. It needs a server, an approved mail service
                and approval from the university. No provider or password is stored in this app.
              </p>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn">
                Save email settings
              </button>
            </div>
          </form>

          <div className="card stack">
            <div className="row between wrap">
              <b>Prepared messages (newest first)</b>
              <button
                type="button"
                className="btn ghost sm"
                onClick={baoExportPreparedEmailsJson}
              >
                <Icon name="upload" size="sm" />
                Export JSON
              </button>
            </div>
            {db.bao.outbox.length ? (
              <div className="scroll-x">
                <table className="tbl" style={{ minWidth: 760 }} id="outbox-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Event</th>
                      <th>To</th>
                      <th>Ticket</th>
                      <th>State</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {db.bao.outbox
                      .slice()
                      .reverse()
                      .slice(0, 60)
                      .map((e) => (
                        <tr key={e.id}>
                          <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                            {stamp(e.ts)}
                          </td>
                          <td>{e.event}</td>
                          <td className="tiny" style={{ overflowWrap: 'anywhere' }}>
                            {e.to.length ? (
                              e.to.join(', ')
                            ) : (
                              <span className="muted">None</span>
                            )}
                          </td>
                          <td className="tnum">{e.ticket}</td>
                          <td>
                            <span
                              className={`pill ${e.state === 'skipped' ? 'yellow' : ''}`.trim()}
                            >
                              {e.state === 'skipped' ? 'Skipped' : 'Prepared, not sent'}
                            </span>
                            <div className="tiny muted">{e.note}</div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="rowbtn"
                              onClick={() =>
                                openModal({ kind: 'bao-email-prev', emailId: e.id })
                              }
                            >
                              Preview
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="small muted">
                Nothing prepared yet. A message is prepared when a request is sent or its status
                changes.
              </p>
            )}
          </div>

          <div className="card stack">
            <b>Decisions needed from the university IT Office</b>
            <ol className="small stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>
              <li>
                Which mail service may be used (for example the university&rsquo;s own mail system)
                and which sender address and name. Who owns that address?
              </li>
              <li>
                Where the server will run, who looks after it, and whether it may reach the mail
                service.
              </li>
              <li>
                How the mail login is kept (on the server only, never in this website) and who
                changes it.
              </li>
              <li>
                Sending limits, and the sender domain settings (SPF, DKIM, DMARC) so mail is not
                marked as spam.
              </li>
              <li>
                Whether student emails may be passed to an outside mail service, how long records
                are kept, and review by the RTU data protection officer.
              </li>
              <li>How failed or bounced emails are handled and who sees them.</li>
              <li>
                BAO sign-off of the wording of each message, and who gets the low stock email.
              </li>
              <li>
                The sign-up code email in this prototype uses a separate setting in the website
                itself (config.ts). It should be moved to the same server.
              </li>
            </ol>
          </div>
        </>
      )}

      {/* TAB 6: WORKFLOW & QUEUE SETTINGS */}
      {baoTab === 'settings' && (
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const pad = Math.min(6, Math.max(1, parseInt(qPad, 10) || 3))
            baoSaveOrderSettings({
              transitions,
              reasonRequired: reasonReq,
              studentCancelFrom: studentCancel,
              queue: {
                enabled: qEnabled,
                prefix: qPrefix.trim().slice(0, 6),
                pad,
                dailyReset: qDailyReset,
              },
              claimNote: claimNote.trim(),
            })
          }}
        >
          <div className="note">
            <Icon name="info" />
            <span>
              Everything on this tab is <b>proposed</b>. The BAO has not confirmed these steps yet.
              Change them here when the BAO decides. Existing tickets keep their history.
            </span>
          </div>

          <div className="card stack">
            <b>Which status can follow which</b>
            <p className="small muted">
              Tick a box to allow the change. Claimed and Cancelled are final.
            </p>
            <div className="scroll-x">
              <table className="tbl bao-matrix">
                <thead>
                  <tr>
                    <th>From \ To</th>
                    {BAO_STATUSES.map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BAO_STATUSES.map((from, i) => {
                    const isFinal = from === 'Claimed' || from === 'Cancelled'
                    return (
                      <tr key={from}>
                        <td>
                          <b>{from}</b>
                        </td>
                        {BAO_STATUSES.map((to, j) => {
                          if (i === j || isFinal) {
                            return (
                              <td key={to} style={{ textAlign: 'center' }}>
                                <span className="muted">-</span>
                              </td>
                            )
                          }
                          const allowed = (transitions[from] || []).includes(to)
                          return (
                            <td key={to} style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                aria-label={`${from} to ${to}`}
                                checked={allowed}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setTransitions((prev) => {
                                    const curList = prev[from] || []
                                    const nextList = checked
                                      ? [...curList, to]
                                      : curList.filter((item) => item !== to)
                                    return { ...prev, [from]: nextList }
                                  })
                                }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card stack">
            <b>A reason is required when moving to</b>
            <div className="row wrap" style={{ gap: 14 }}>
              {BAO_STATUSES.map((x) => (
                <label key={x} className="row small" style={{ gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={reasonReq.includes(x)}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setReasonReq((prev) =>
                        checked ? [...prev, x] : prev.filter((item) => item !== x),
                      )
                    }}
                  />
                  {x}
                </label>
              ))}
            </div>

            <b>A student can cancel their own request while it is</b>
            <div className="row wrap" style={{ gap: 14 }}>
              {BAO_STATUSES.filter((x) => x !== 'Claimed' && x !== 'Cancelled').map((x) => (
                <label key={x} className="row small" style={{ gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={studentCancel.includes(x)}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setStudentCancel((prev) =>
                        checked ? [...prev, x] : prev.filter((item) => item !== x),
                      )
                    }}
                  />
                  {x}
                </label>
              ))}
            </div>
          </div>

          <div className="card stack">
            <b>Queue number</b>
            <p className="small muted">
              A short daily number for the pickup line. It is separate from the TXN id and it does
              not replace it. It is off until the BAO decides to use it.
            </p>
            <label className="row small" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={qEnabled}
                onChange={(e) => setQEnabled(e.target.checked)}
              />
              Use a daily queue number
            </label>
            <div className="grid2">
              <div className="field">
                <label htmlFor="q-pre">Letters before the number (optional)</label>
                <input
                  className="input"
                  id="q-pre"
                  maxLength={6}
                  value={qPrefix}
                  onChange={(e) => setQPrefix(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="q-pad">Digits</label>
                <input
                  className="input tnum"
                  id="q-pad"
                  type="number"
                  min="1"
                  max="6"
                  value={qPad}
                  onChange={(e) => setQPad(e.target.value)}
                />
              </div>
            </div>
            <label className="row small" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={qDailyReset}
                onChange={(e) => setQDailyReset(e.target.checked)}
              />
              Start again from 1 each day
            </label>
          </div>

          <div className="card stack">
            <b>Claim notes shown on every ticket</b>
            <p className="small muted">
              Leave empty until the BAO gives the wording (for example what to bring when
              claiming). Nothing is shown while it is empty.
            </p>
            <textarea
              className="input"
              id="cn-text"
              maxLength={400}
              value={claimNote}
              onChange={(e) => setClaimNote(e.target.value)}
            />
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn">
              Save settings
            </button>
          </div>
        </form>
      )}
    </>
  )
}
