import { useMemo, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { navigate } from '@/common/router/router'
import { playSuccess } from '@/common/sounds'
import {
  BAO_LTYPES,
  baoDownloadCsv,
  baoIsLow,
  baoItemType,
  baoLedgerCheck,
  baoLowUnits,
  baoReserved,
  baoThreshold,
  baoUnitName,
  baoUnits,
} from '../../baoHelpers'
import { CATEGORIES, stamp } from '../../constants'
import { useTindahan } from '../../context/TindahanContext'
import type { BaoItemType } from '../../types'
import './StoreInventoryPage.css'

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA')

export function StoreInventoryPage() {
  const {
    db,
    currentAccount,
    isStaffUser,
    invTab,
    setInvTab,
    baoSaveItemTypes,
    baoSaveStoreWindowAndLimit,
    baoSaveDailyReconciliation,
    openModal,
    toast,
  } = useTindahan()

  // Stock tab search & low filter
  const [itemQ, setItemQ] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)

  // Stock ledger filters
  const [lgTicket, setLgTicket] = useState('')
  const [lgType, setLgType] = useState('')
  const [lgItem, setLgItem] = useState('')
  const [lgFrom, setLgFrom] = useState('')
  const [lgTo, setLgTo] = useState('')

  // Item types state
  const [editTypes, setEditTypes] = useState<BaoItemType[]>(() =>
    db.bao.types.map((t) => ({ ...t })),
  )
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeCat, setNewTypeCat] = useState<string>('Other Items')

  // Windows & limits state
  const wCfg = db.bao.settings.window
  const [winEnabled, setWinEnabled] = useState<boolean>(wCfg.enabled)
  const [winStart, setWinStart] = useState<string>(
    wCfg.start ? String(wCfg.start).slice(0, 16) : '',
  )
  const [winEnd, setWinEnd] = useState<string>(wCfg.end ? String(wCfg.end).slice(0, 16) : '')
  const [winMsg, setWinMsg] = useState<string>(wCfg.message || '')
  const [limitPerStu, setLimitPerStu] = useState<string>(
    String(db.bao.settings.limitPerStudent || 0),
  )

  // Daily Count (reconciliation) state
  const [rcCounts, setRcCounts] = useState<Record<string, string>>({})
  const [rcReasons, setRcReasons] = useState<Record<string, string>>({})

  const unitRows = useMemo(() => {
    const q = itemQ.trim().toLowerCase()
    const out: Array<{
      u: ReturnType<typeof baoUnits>[0]
      first: boolean
      t: BaoItemType | null
    }> = []
    db.official
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => {
        const t = baoItemType(db.bao, p)
        if (q && !(p.name + ' ' + (t ? t.name : '')).toLowerCase().includes(q)) return
        baoUnits(p).forEach((u, i) => {
          if (onlyLow && !baoIsLow(u)) return
          out.push({ u, first: i === 0, t })
        })
      })
    return out
  }, [db.official, db.bao, itemQ, onlyLow])

  const allUnitRows = useMemo(() => {
    const out: Array<{
      u: ReturnType<typeof baoUnits>[0]
      first: boolean
      t: BaoItemType | null
    }> = []
    db.official
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => {
        const t = baoItemType(db.bao, p)
        baoUnits(p).forEach((u, i) => out.push({ u, first: i === 0, t }))
      })
    return out
  }, [db.official, db.bao])

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
          Store inventory can only be opened by BAO and RTU staff accounts.
        </p>
        <button type="button" className="btn" onClick={() => navigate('marketplace')}>
          Back to marketplace
        </button>
      </div>
    )
  }

  const lowList = baoLowUnits(db.official)
  const totalOnHand = allUnitRows.reduce((a, r) => a + r.u.onHand, 0)
  const totalAvailable = allUnitRows.reduce((a, r) => a + r.u.available, 0)
  const totalReserved = Math.max(0, totalOnHand - totalAvailable)

  // Filtered ledger
  const filteredLedger = db.bao.ledger
    .filter((e) => {
      if (lgType && e.type !== lgType) return false
      if (lgItem && e.pid !== lgItem) return false
      if (lgFrom && dayKey(e.ts) < lgFrom) return false
      if (lgTo && dayKey(e.ts) > lgTo) return false
      const q = lgTicket.trim().toLowerCase()
      if (
        q &&
        !(e.ticket + ' ' + e.reason + ' ' + e.item + ' ' + e.by).toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
    .slice()
    .reverse()

  const ledgerItemOptions = [
    ...db.official.map((p) => [p.id, p.name] as const),
    ...[...new Set(db.bao.ledger.map((e) => e.pid))]
      .filter((id) => !db.official.some((p) => p.id === id))
      .map(
        (id) =>
          [
            id,
            `${db.bao.ledger.find((e) => e.pid === id)?.item || id} (removed)`,
          ] as const,
      ),
  ]

  const tabs: Array<['items' | 'ledger' | 'types' | 'rules' | 'recon', string]> = [
    ['items', 'Stock'],
    ['ledger', 'Stock ledger'],
    ['types', 'Item types'],
    ['rules', 'Windows and limits'],
    ['recon', 'Daily count'],
  ]

  return (
    <>
      <div className="row between wrap">
        <div style={{ maxWidth: '70ch' }}>
          <span className="eyebrow">BAO · OFFICIAL RTU STORE</span>
          <h1>Store inventory</h1>
          <p className="muted small">
            Stock for the Official RTU Store. Every change is a ledger line with who, when and
            why. Nothing is changed silently.
          </p>
        </div>
        <div className="row wrap no-print" style={{ gap: 8 }}>
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
            onClick={() => navigate('shop')}
          >
            <Icon name="eye" size="sm" />
            Admin | RTU Shop
          </button>
          <button
            type="button"
            className="btn yellow sm"
            onClick={() => navigate('create')}
          >
            <Icon name="plus" size="sm" />
            Add official product
          </button>
        </div>
      </div>

      {/* Live Inventory Summary Cards */}
      <div className="inv-summary no-print">
        <div className="card flat stack inv-formula-card" style={{ gap: 2 }}>
          <span className="small muted">On Hand (Store room)</span>
          <b className="tnum" style={{ fontSize: 24 }}>
            {totalOnHand}
          </b>
        </div>
        <div className="card flat stack" style={{ gap: 2 }}>
          <span className="small muted">Reserved (Open tickets)</span>
          <b className="tnum" style={{ fontSize: 24 }}>
            {totalReserved}
          </b>
        </div>
        <div className="card flat stack" style={{ gap: 2 }}>
          <span className="small muted">Available (Shown to students)</span>
          <b className="tnum" style={{ fontSize: 24, color: 'var(--green)' }}>
            {totalAvailable}
          </b>
        </div>
        <button
          type="button"
          className={`card flat stack bao-stat ${onlyLow && invTab === 'items' ? 'on' : ''}`.trim()}
          style={{ gap: 2, textAlign: 'left' }}
          onClick={() => {
            setOnlyLow((prev) => !prev)
            setInvTab('items')
          }}
        >
          <span className="small muted">Low / Out of stock</span>
          <b
            className="tnum"
            style={{
              fontSize: 24,
              color: lowList.length ? 'var(--red, #b33939)' : undefined,
            }}
          >
            {lowList.length}
          </b>
        </button>
      </div>

      <div className="tabs no-print" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`tab ${invTab === k ? 'on' : ''}`.trim()}
            role="tab"
            aria-selected={invTab === k}
            onClick={() => {
              if (k === 'types') {
                setEditTypes(db.bao.types.map((t) => ({ ...t })))
              }
              setInvTab(k)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: STOCK */}
      {invTab === 'items' && (
        <>
          {lowList.length > 0 && (
            <div className="note" role="status" data-bao-low>
              <Icon name="clock" />
              <span>
                <b>
                  {lowList.length} low stock warning{lowList.length === 1 ? '' : 's'}.
                </b>{' '}
                {lowList
                  .map((u) => `${baoUnitName(u)} (${u.available} available)`)
                  .join(', ')}
              </span>
            </div>
          )}

          <div className="row between wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ minWidth: 240, flex: 1 }}>
              <label htmlFor="iv-q">Search items</label>
              <input
                className="input"
                id="iv-q"
                value={itemQ}
                placeholder="Item name or type"
                onChange={(e) => setItemQ(e.target.value)}
              />
            </div>
            <span className="row wrap" style={{ gap: 8 }}>
              {onlyLow && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setOnlyLow(false)}
                >
                  Show all items
                </button>
              )}
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  const bad = baoLedgerCheck(db.bao, db.official, db.txn)
                  toast(
                    bad.length
                      ? `The ledger does not match the stock for ${bad.length} item${
                          bad.length === 1 ? '' : 's'
                        }: ${bad[0].item}.`
                      : 'The ledger matches the stock numbers and the open tickets.',
                  )
                }}
              >
                Check ledger
              </button>
            </span>
          </div>

          <div className="note blue">
            <Icon name="info" size="sm" />
            <span className="small">
              <b>On Hand</b> is what is in the store room. <b>Reserved</b> is held for open
              tickets. <b>Available</b> = On Hand minus Reserved, and it is the only number
              students see.
            </span>
          </div>

          {unitRows.length ? (
            <div className="card" style={{ padding: 0 }}>
              <div className="scroll-x">
                <table className="tbl" style={{ minWidth: 880 }} id="inv-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Size or variation</th>
                      <th>On hand</th>
                      <th>Reserved</th>
                      <th>Available</th>
                      <th>Low at</th>
                      <th />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {unitRows.map(({ u, first, t }) => {
                      const lowVal = baoThreshold(u)
                      const isLow = baoIsLow(u)
                      return (
                        <tr key={`${u.p.id}|${u.vid}`} data-pid={u.p.id} data-vid={u.vid}>
                          <td>
                            {first ? (
                              <>
                                <b>{u.p.name}</b>
                                {u.p.hidden && (
                                  <>
                                    {' '}
                                    <span className="pill yellow">Hidden</span>
                                  </>
                                )}
                              </>
                            ) : (
                              <span className="muted">same item</span>
                            )}
                          </td>
                          <td>{first && t ? t.name : ''}</td>
                          <td>
                            {u.label ? u.label : <span className="muted">No sizes</span>}
                          </td>
                          <td className="tnum">{u.onHand}</td>
                          <td className="tnum">{baoReserved(u)}</td>
                          <td className="tnum">
                            <b>{u.available}</b>
                          </td>
                          <td className="tnum">
                            {lowVal == null ? <span className="muted">Off</span> : lowVal}
                          </td>
                          <td>
                            {isLow && (
                              <span className={`pill ${u.available === 0 ? 'red' : 'yellow'}`}>
                                {u.available === 0 ? 'Out' : 'Low'}
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className="row"
                              style={{ gap: 10, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}
                            >
                              <button
                                type="button"
                                className="rowbtn"
                                onClick={() =>
                                  openModal({
                                    kind: 'bao-move',
                                    pid: u.p.id,
                                    vid: u.vid,
                                    type: 'Stock In',
                                  })
                                }
                              >
                                Stock in
                              </button>
                              <button
                                type="button"
                                className="rowbtn"
                                onClick={() =>
                                  openModal({
                                    kind: 'bao-move',
                                    pid: u.p.id,
                                    vid: u.vid,
                                    type: 'Sold',
                                  })
                                }
                              >
                                Record sale
                              </button>
                              <button
                                type="button"
                                className="rowbtn"
                                onClick={() =>
                                  openModal({
                                    kind: 'bao-move',
                                    pid: u.p.id,
                                    vid: u.vid,
                                    type: 'Adjustment',
                                  })
                                }
                              >
                                Adjust
                              </button>
                              {first && (
                                <button
                                  type="button"
                                  className="rowbtn"
                                  onClick={() =>
                                    openModal({ kind: 'bao-item', pid: u.p.id })
                                  }
                                >
                                  Item settings
                                </button>
                              )}
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
              <b>{db.official.length ? 'No items match' : 'No official products yet'}</b>
              <p className="small muted">Add official products via Sell an item or manage them in Admin | RTU Shop.</p>
              {!db.official.length && (
                <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
                  <button type="button" className="btn yellow" onClick={() => navigate('create')}>
                    <Icon name="plus" size="sm" />
                    Add official product
                  </button>
                  <button type="button" className="btn ghost" onClick={() => navigate('shop')}>
                    Admin | RTU Shop
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: STOCK LEDGER */}
      {invTab === 'ledger' && (
        <>
          <div className="card tx-filters bao-filters no-print">
            <div className="field">
              <label htmlFor="lg-t">Search ticket, reason or staff</label>
              <input
                className="input"
                id="lg-t"
                value={lgTicket}
                placeholder="TXN id, reason or name"
                onChange={(e) => setLgTicket(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lg-type">Type</label>
              <select
                className="input"
                id="lg-type"
                value={lgType}
                onChange={(e) => setLgType(e.target.value)}
              >
                <option value="">All</option>
                {BAO_LTYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="lg-item">Item</label>
              <select
                className="input"
                id="lg-item"
                value={lgItem}
                onChange={(e) => setLgItem(e.target.value)}
              >
                <option value="">All</option>
                {ledgerItemOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="lg-from">From</label>
              <input
                className="input"
                id="lg-from"
                type="date"
                value={lgFrom}
                onChange={(e) => setLgFrom(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lg-to">To</label>
              <input
                className="input"
                id="lg-to"
                type="date"
                value={lgTo}
                onChange={(e) => setLgTo(e.target.value)}
              />
            </div>
          </div>

          <div className="row between wrap">
            <span className="small muted tnum">
              {filteredLedger.length} of {db.bao.ledger.length} line
              {db.bao.ledger.length === 1 ? '' : 's'}. Lines are never edited or deleted.
            </span>
            <span className="row wrap no-print" style={{ gap: 8 }}>
              {(lgType || lgItem || lgFrom || lgTo || lgTicket) && (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setLgTicket('')
                    setLgType('')
                    setLgItem('')
                    setLgFrom('')
                    setLgTo('')
                  }}
                >
                  Clear filters
                </button>
              )}
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  if (!filteredLedger.length) {
                    toast('No ledger lines match the filters.')
                    return
                  }
                  const head = [
                    'Line',
                    'When',
                    'Item',
                    'Size or variation',
                    'Type',
                    'Quantity',
                    'On hand change',
                    'Reserved change',
                    'Reason',
                    'Ticket',
                    'Staff',
                    'On hand after',
                    'Reserved after',
                    'Available after',
                  ]
                  baoDownloadCsv(
                    `rtu-stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
                    [
                      head,
                      ...filteredLedger.map((e) => [
                        e.id,
                        e.ts,
                        e.item,
                        e.label,
                        e.type,
                        e.qty,
                        e.ohD,
                        e.rsD,
                        e.reason,
                        e.ticket,
                        e.by,
                        e.after.onHand,
                        e.after.reserved,
                        e.after.available,
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

          {filteredLedger.length ? (
            <div className="card" style={{ padding: 0 }}>
              <div className="scroll-x">
                <table className="tbl" style={{ minWidth: 980 }} id="ledger-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Reason</th>
                      <th>Ticket</th>
                      <th>Staff</th>
                      <th>On hand</th>
                      <th>Reserved</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((e) => (
                      <tr key={e.id}>
                        <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                          {stamp(e.ts)}
                        </td>
                        <td>
                          {e.item}
                          {e.label ? <span className="muted"> ({e.label})</span> : null}
                        </td>
                        <td>{e.type}</td>
                        <td className="tnum">
                          {e.type === 'Adjustment' ? (e.ohD > 0 ? '+' : '-') : ''}
                          {e.qty}
                        </td>
                        <td style={{ minWidth: 160 }}>{e.reason}</td>
                        <td className="tnum">
                          {e.ticket ? (
                            <button
                              type="button"
                              className="link"
                              onClick={() =>
                                openModal({ kind: 'bao-ticket', txnId: e.ticket })
                              }
                            >
                              {e.ticket}
                            </button>
                          ) : (
                            ''
                          )}
                        </td>
                        <td>{e.by}</td>
                        <td className="tnum">{e.after.onHand}</td>
                        <td className="tnum">{e.after.reserved}</td>
                        <td className="tnum">{e.after.available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 36 }}>
              <b>No ledger lines</b>
            </div>
          )}
        </>
      )}

      {/* TAB 3: ITEM TYPES */}
      {invTab === 'types' && (
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const next = editTypes.map((t) => ({ ...t }))
            if (newTypeName.trim()) {
              next.push({
                id: 'ty-' + Date.now().toString(36),
                name: newTypeName.trim(),
                category: newTypeCat || 'Other Items',
                sub: '',
                tone: 't-drink',
                icon: 'tag',
                active: true,
              })
            }
            if (baoSaveItemTypes(next)) {
              setEditTypes(next)
              setNewTypeName('')
              setNewTypeCat('Other Items')
            }
          }}
        >
          <div className="note blue">
            <Icon name="info" size="sm" />
            <span className="small">
              The starting list is Sablay, Book, Uniform, Merchandise and Other. Add, rename or
              switch off types here. The category decides where the item appears in Browse and the
              Official RTU Store tabs. A type that is switched off cannot be picked for new items,
              and existing items keep it.
            </span>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="scroll-x">
              <table className="tbl" style={{ minWidth: 640 }} id="types-table">
                <thead>
                  <tr>
                    <th>Type name</th>
                    <th>Category</th>
                    <th>Items</th>
                    <th>In use</th>
                  </tr>
                </thead>
                <tbody>
                  {editTypes.map((t, i) => {
                    const count = db.official.filter((p) => {
                      const pt = baoItemType(db.bao, p)
                      return pt && pt.id === t.id
                    }).length
                    return (
                      <tr key={t.id}>
                        <td>
                          <input
                            className="input"
                            value={t.name}
                            maxLength={30}
                            aria-label="Type name"
                            onChange={(e) => {
                              const val = e.target.value
                              setEditTypes((prev) =>
                                prev.map((item, idx) =>
                                  idx === i ? { ...item, name: val } : item,
                                ),
                              )
                            }}
                          />
                        </td>
                        <td>
                          <select
                            className="input"
                            value={t.category}
                            aria-label="Category"
                            onChange={(e) => {
                              const val = e.target.value
                              setEditTypes((prev) =>
                                prev.map((item, idx) =>
                                  idx === i ? { ...item, category: val } : item,
                                ),
                              )
                            }}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="tnum">{count}</td>
                        <td>
                          <label className="row small" style={{ gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={t.active}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setEditTypes((prev) =>
                                  prev.map((item, idx) =>
                                    idx === i ? { ...item, active: checked } : item,
                                  ),
                                )
                              }}
                            />
                            Active
                          </label>
                        </td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td>
                      <input
                        className="input"
                        maxLength={30}
                        placeholder="New type name"
                        aria-label="New type name"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="input"
                        aria-label="Category for the new type"
                        value={newTypeCat}
                        onChange={(e) => setNewTypeCat(e.target.value)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td />
                    <td className="small muted">Added when you save</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn">
              Save item types
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: WINDOWS AND LIMITS */}
      {invTab === 'rules' && (
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            baoSaveStoreWindowAndLimit(
              {
                enabled: winEnabled,
                start: winStart,
                end: winEnd,
                message: winMsg,
              },
              parseInt(limitPerStu, 10) || 0,
            )
          }}
        >
          <div className="card stack">
            <b>Store-wide ordering window</b>
            <p className="small muted">
              Optional. When it is on, students can only send requests between the start and the
              end. An item can also have its own window in Item settings.
            </p>
            <label className="row small" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={winEnabled}
                onChange={(e) => setWinEnabled(e.target.checked)}
              />
              Use a store-wide ordering window
            </label>
            <div className="grid2">
              <div className="field">
                <label htmlFor="gw-s">Opens</label>
                <input
                  className="input"
                  id="gw-s"
                  type="datetime-local"
                  value={winStart}
                  onChange={(e) => setWinStart(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="gw-e">Closes</label>
                <input
                  className="input"
                  id="gw-e"
                  type="datetime-local"
                  value={winEnd}
                  onChange={(e) => setWinEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="gw-m">Message shown to students (optional)</label>
              <input
                className="input"
                id="gw-m"
                maxLength={140}
                value={winMsg}
                onChange={(e) => setWinMsg(e.target.value)}
              />
            </div>
          </div>

          <div className="card stack">
            <b>Store-wide limit per student</b>
            <p className="small muted">
              0 means no limit. Counted per item. Cancelled tickets are not counted. The BAO has
              not set a limit, so it starts at 0.
            </p>
            <div className="field" style={{ maxWidth: 200 }}>
              <label htmlFor="gl-n">Units per student</label>
              <input
                className="input tnum"
                id="gl-n"
                type="number"
                min="0"
                value={limitPerStu}
                onChange={(e) => setLimitPerStu(e.target.value)}
              />
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn">
              Save
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: DAILY COUNT (RECONCILIATION) */}
      {invTab === 'recon' && (
        <>
          <div className="note blue">
            <Icon name="info" size="sm" />
            <span className="small">
              Count what is physically on the shelf and type it in. A number that matches is
              recorded as matched. A number that is different needs a reason, and it is written to
              the ledger as an Adjustment. No stock number is changed until you press Save. Leave a
              row empty to skip it.
            </span>
          </div>

          {allUnitRows.length ? (
            <form
              className="stack"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                const res = baoSaveDailyReconciliation(rcCounts, rcReasons)
                if (!res.ok) {
                  toast(res.msg || 'Could not save count.')
                  return
                }
                playSuccess()
                setRcCounts({})
                setRcReasons({})
                toast(`Count ${res.recId} saved.`)
              }}
            >
              <div className="row between wrap">
                <span className="small muted">
                  Enter physical counts below or pre-fill matched rows first.
                </span>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    const next: Record<string, string> = { ...rcCounts }
                    allUnitRows.forEach(({ u }) => {
                      const k = `${u.p.id}|${u.vid}`
                      if (next[k] === undefined || next[k] === '') {
                        next[k] = String(u.onHand)
                      }
                    })
                    setRcCounts(next)
                  }}
                >
                  Fill empty rows with system On Hand
                </button>
              </div>

              <div className="card" style={{ padding: 0 }}>
                <div className="scroll-x">
                  <table className="tbl" style={{ minWidth: 820 }} id="recon-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Size</th>
                        <th>On hand (system)</th>
                        <th>Reserved</th>
                        <th>Counted</th>
                        <th>Difference</th>
                        <th>Reason (required if different)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUnitRows.map(({ u }) => {
                        const k = `${u.p.id}|${u.vid}`
                        const cVal = rcCounts[k]
                        const has = cVal !== undefined && cVal !== ''
                        const diff = has ? parseInt(cVal, 10) - u.onHand : null

                        return (
                          <tr key={k} data-key={k}>
                            <td>
                              <b>{u.p.name}</b>
                            </td>
                            <td>
                              {u.label ? u.label : <span className="muted">No sizes</span>}
                            </td>
                            <td className="tnum">{u.onHand}</td>
                            <td className="tnum">{baoReserved(u)}</td>
                            <td>
                              <input
                                className="input tnum"
                                type="number"
                                min="0"
                                step="1"
                                value={has ? cVal : ''}
                                style={{ width: 100 }}
                                aria-label={`Counted ${baoUnitName(u)}`}
                                onChange={(e) =>
                                  setRcCounts((prev) => ({
                                    ...prev,
                                    [k]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="tnum">
                              {diff === null || Number.isNaN(diff) ? (
                                ''
                              ) : diff === 0 ? (
                                <span className="pill green">Matched</span>
                              ) : (
                                <span className={`pill ${diff < 0 ? 'red' : 'yellow'}`}>
                                  {diff > 0 ? '+' : ''}
                                  {diff}
                                </span>
                              )}
                            </td>
                            <td>
                              {diff ? (
                                <input
                                  className="input"
                                  maxLength={160}
                                  placeholder="Reason for difference..."
                                  value={rcReasons[k] || ''}
                                  aria-label={`Reason for ${baoUnitName(u)}`}
                                  onChange={(e) =>
                                    setRcReasons((prev) => ({
                                      ...prev,
                                      [k]: e.target.value,
                                    }))
                                  }
                                />
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="row between wrap">
                <span className="small muted">
                  Counted by {currentAccount?.name || 'Staff'}
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setRcCounts({})
                      setRcReasons({})
                    }}
                  >
                    Clear
                  </button>
                  <button type="submit" className="btn">
                    Save count
                  </button>
                </span>
              </div>
            </form>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 36 }}>
              <b>No official products yet</b>
            </div>
          )}

          <div className="card stack">
            <b>Previous counts</b>
            {db.bao.recon.length ? (
              db.bao.recon
                .slice(-8)
                .reverse()
                .map((r) => {
                  const diffs = r.lines.filter((l) => l.diff !== 0)
                  return (
                    <div
                      key={r.id}
                      style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}
                      className="stack"
                    >
                      <div className="row between wrap">
                        <b className="small tnum">{r.id}</b>
                        <span className="tiny muted">
                          {stamp(r.ts)} · {r.by}
                        </span>
                      </div>
                      <div className="tiny muted">
                        {r.lines.length} counted, {diffs.length} different
                      </div>
                      {diffs.map((l, idx) => (
                        <div key={idx} className="small">
                          {l.item}
                          {l.label ? ` (${l.label})` : ''}: system {l.expected}, counted{' '}
                          {l.counted} ({l.diff > 0 ? '+' : ''}
                          {l.diff}). {l.reason}
                        </div>
                      ))}
                    </div>
                  )
                })
            ) : (
              <p className="small muted">No counts saved yet.</p>
            )}
          </div>
        </>
      )}
    </>
  )
}
