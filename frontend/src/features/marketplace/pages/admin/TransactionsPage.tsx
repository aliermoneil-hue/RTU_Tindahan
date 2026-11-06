import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { BAO_PILL, baoIsOfficialTxn, baoStatusOf } from '../../baoHelpers'
import { TX_PILL, peso, stamp } from '../../constants'
import { useTindahan } from '../../context/TindahanContext'
import './TransactionsPage.css'

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA')

export function TransactionsPage() {
  const { db, isStaffUser, exportTransactionsCsv, openModal } = useTindahan()

  const [tab, setTab] = useState<'all' | 'student' | 'official'>('all')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

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
          Transaction records can only be opened by RTU staff accounts.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => navigate('marketplace')}
        >
          Back to marketplace
        </button>
      </div>
    )
  }

  const scope = db.txn.filter((t) => tab === 'all' || t.type === tab)
  const cnt = (s: string) => scope.filter((t) => t.status === s).length
  const doneVal = scope
    .filter((t) => t.status === 'Completed')
    .reduce((a, t) => a + t.total, 0)

  const rows = db.txn
    .filter((t) => {
      if (tab !== 'all' && t.type !== tab) return false
      if (status && t.status !== status) return false
      if (kind && t.kind !== kind) return false
      if (from && dayKey(t.created) < from) return false
      if (to && dayKey(t.created) > to) return false
      const sq = q.trim().toLowerCase()
      if (
        sq &&
        !(
          t.id +
          ' ' +
          t.orderId +
          ' ' +
          t.summary +
          ' ' +
          t.buyerName +
          ' ' +
          t.buyerEmail +
          ' ' +
          t.buyerSid +
          ' ' +
          t.sellerName +
          ' ' +
          (t.sellerEmail || '') +
          ' ' +
          t.sellerSid
        )
          .toLowerCase()
          .includes(sq)
      ) {
        return false
      }
      return true
    })
    .sort((a, b) => String(b.created).localeCompare(String(a.created)))

  const waiting = db.txn.filter(
    (t) =>
      t.type === 'official' &&
      !t.sellerEmail &&
      (t.status === 'Pending' || t.status === 'Confirmed'),
  ).length

  const tabs: ['all' | 'student' | 'official', string, number][] = [
    ['all', 'All transactions', db.txn.length],
    ['student', 'Student to student', db.txn.filter((t) => t.type === 'student').length],
    ['official', 'Official RTU Store', db.txn.filter((t) => t.type === 'official').length],
  ]

  const clearFilters = () => {
    setQ('')
    setStatus('')
    setKind('')
    setFrom('')
    setTo('')
  }

  return (
    <>
      <div className="row between wrap">
        <div style={{ maxWidth: '66ch' }}>
          <span className="eyebrow">STAFF · TRANSACTIONS</span>
          <h1>Transaction history</h1>
          <p className="muted small">
            Every request made on Tindahan is recorded here with its buyer, seller, items and
            total. A record starts as Pending when the buyer sends a request, not when someone
            sends a message. Records stay even if a listing is changed or removed.
          </p>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => exportTransactionsCsv(rows)}
        >
          <Icon name="upload" size="sm" />
          Export as CSV
        </button>
      </div>

      {waiting > 0 && (
        <div className="note" role="status">
          <Icon name="clock" />
          <span>
            <b>
              {waiting} Official RTU Store request{waiting === 1 ? '' : 's'} need
              {waiting === 1 ? 's' : ''} staff action.
            </b>{' '}
            Open one to manage its ticket status, or open Store orders.
          </span>
          <span className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setTab('official')}
            >
              Show here
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => navigate('baoorders')}
            >
              Open Store orders
            </button>
          </span>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Source">
        {tabs.map((t) => (
          <button
            key={t[0]}
            type="button"
            className={`tab ${tab === t[0] ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={tab === t[0]}
            onClick={() => setTab(t[0])}
          >
            {t[1]} <span className="tnum">({t[2]})</span>
          </button>
        ))}
      </div>

      <div className="txstat">
        {(
          [
            ['Pending', String(cnt('Pending'))],
            ['Confirmed', String(cnt('Confirmed'))],
            ['Completed', String(cnt('Completed'))],
            ['Cancelled', String(cnt('Cancelled'))],
            ['Completed value', peso(doneVal)],
          ] as const
        ).map((x) => (
          <div key={x[0]} className="card flat stack" style={{ gap: 2 }}>
            <span className="small muted">{x[0]}</span>
            <b className="tnum" style={{ fontSize: 22 }}>
              {x[1]}
            </b>
          </div>
        ))}
      </div>

      <div className="card tx-filters">
        <div className="field">
          <label htmlFor="tx-q">Search</label>
          <input
            className="input"
            id="tx-q"
            value={q}
            placeholder="ID, item, buyer, seller or student number"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tx-status">Status</label>
          <select
            className="input"
            id="tx-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            {['Pending', 'Confirmed', 'Completed', 'Cancelled'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tx-kind">Type</label>
          <select
            className="input"
            id="tx-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Products and services</option>
            <option value="product">Products</option>
            <option value="service">Services</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="tx-from">From</label>
          <input
            className="input"
            id="tx-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tx-to">To</label>
          <input
            className="input"
            id="tx-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="row between wrap">
        <span className="small muted tnum">
          {rows.length} of {db.txn.length} record{db.txn.length === 1 ? '' : 's'}
        </span>
        {(q || status || kind || from || to) && (
          <button type="button" className="link" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {rows.length ? (
        <div className="card" style={{ padding: 0 }}>
          <div className="scroll-x">
            <table className="tbl" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Buyer</th>
                  <th>Seller</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const isOff = baoIsOfficialTxn(t)
                  const bSt = isOff ? baoStatusOf(t) : null
                  return (
                    <tr key={t.id}>
                      <td className="tnum">
                        <b>{t.id}</b>
                        <div className="tiny muted">{t.orderId}</div>
                      </td>
                      <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                        {stamp(t.created)}
                      </td>
                      <td>
                        {t.summary}
                        {t.kind !== 'product' && (
                          <>
                            {' '}
                            <span className="srcpill svc">Service</span>
                          </>
                        )}
                      </td>
                      <td className="tnum">{t.qty}</td>
                      <td>
                        {t.buyerName}
                        <div className="tiny muted">{t.buyerSid || ''}</div>
                      </td>
                      <td>
                        {t.sellerName}
                        <div>
                          <span
                            className={`srcpill ${
                              t.type === 'official' ? 'school' : 'student'
                            }`}
                          >
                            {t.type === 'official' ? 'Official RTU Store' : 'Student'}
                          </span>
                        </div>
                      </td>
                      <td className="tnum">{peso(t.total)}</td>
                      <td>
                        {isOff && bSt ? (
                          <span className={`pill ${BAO_PILL[bSt] || ''}`.trim()}>
                            {bSt}
                          </span>
                        ) : (
                          <span className={`pill ${TX_PILL[t.status] || ''}`.trim()}>
                            {t.status}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="rowbtn"
                          onClick={() =>
                            openModal(
                              isOff
                                ? { kind: 'bao-ticket', txnId: t.id }
                                : { kind: 'txn-view', txnId: t.id },
                            )
                          }
                        >
                          Review
                        </button>
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
          <span style={{ color: 'var(--blue)' }}>
            <Icon name="bag" />
          </span>
          <b>{db.txn.length ? 'No records match' : 'No transactions yet'}</b>
          <p className="small muted" style={{ maxWidth: '52ch' }}>
            {db.txn.length
              ? 'Try clearing a filter or searching for something else.'
              : 'When a student sends a request for a product or service, it is recorded here as Pending.'}
          </p>
          {db.txn.length > 0 && (
            <button type="button" className="btn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  )
}
