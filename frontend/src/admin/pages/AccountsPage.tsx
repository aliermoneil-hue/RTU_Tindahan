import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { AccountPanel } from '../components/AccountPanel'
import { RoleBadge, StatusBadge, VerifiedBadge } from '../components/Badge'
import { PageHeader } from '../components/Layout'
import { api, ApiError } from '../lib/api'
import { formatDate } from '../lib/format'
import { scrollIntoViewSmooth } from '../lib/motion'
import { useSearchParams } from '../lib/router'
import { ROLES, ROLE_LABEL, STATUSES, STATUS_LABEL } from '../lib/types'
import type { AdminUser, Page } from '../lib/types'
import type { CSSProperties } from 'react'

const PAGE_SIZE = 20
const FILTERS = ['q', 'role', 'status', 'verified', 'ordering', 'page'] as const

const SORTABLE: { key: string; label: string }[] = [
  { key: 'display_name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'date_joined', label: 'Joined' },
]

export function AccountsPage() {
  const { abilities } = useAuth()
  const [params, setParams] = useSearchParams()

  const q = params.get('q') ?? ''
  const role = params.get('role') ?? ''
  const status = params.get('status') ?? ''
  const verified = params.get('verified') ?? ''
  const ordering = params.get('ordering') ?? '-date_joined'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [data, setData] = useState<Page<AdminUser> | null>(null)
  const [dataPage, setDataPage] = useState(1) // the page number `data` belongs to
  const [dataKey, setDataKey] = useState('') // changes whenever a new set of rows arrives
  const [slide, setSlide] = useState<'forward' | 'back' | 'fade'>('fade')
  const lastPage = useRef(1)
  const toolbarRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reload, setReload] = useState(0)

  // Merge a change into the current filters. Changing a filter goes back to page 1.
  const update = useCallback(
    (change: Partial<Record<(typeof FILTERS)[number], string>>) => {
      const next: Record<string, string> = {}
      for (const key of FILTERS) next[key] = params.get(key) ?? ''
      Object.assign(next, change)
      if (!('page' in change)) next.page = ''
      setParams(next)
    },
    [params, setParams],
  )

  // Search box: type freely, update the URL after a short pause.
  const [qInput, setQInput] = useState(q)
  const pushedQ = useRef(q)
  useEffect(() => {
    if (q !== pushedQ.current) {
      pushedQ.current = q
      setQInput(q)
    }
  }, [q])
  useEffect(() => {
    if (qInput === pushedQ.current) return
    const timer = window.setTimeout(() => {
      pushedQ.current = qInput
      update({ q: qInput.trim() })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [qInput, update])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api
      .accounts({ q, role, status, verified, ordering, page, page_size: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setSlide(page > lastPage.current ? 'forward' : page < lastPage.current ? 'back' : 'fade')
        lastPage.current = page
        setData(result)
        setDataPage(page)
        setDataKey([q, role, status, verified, ordering, page].join('|'))
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof ApiError ? caught.message : 'Could not load the accounts.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [q, role, status, verified, ordering, page, reload])

  const rows = data?.results ?? []
  const selected = rows.find((row) => row.id === selectedId) ?? null
  const total = data?.count ?? 0
  const first = total === 0 ? 0 : (dataPage - 1) * PAGE_SIZE + 1
  const last = Math.min(dataPage * PAGE_SIZE, total)
  const hasFilters = Boolean(q || role || status || verified)
  const queue = verified === 'false' && !role && !status && !q

  function onChanged(updated: AdminUser) {
    setData((current) =>
      current
        ? { ...current, results: current.results.map((row) => (row.id === updated.id ? updated : row)) }
        : current,
    )
  }

  // Change page, then glide back up to the top of the table.
  function goToPage(next: number) {
    update({ page: String(next) })
    scrollIntoViewSmooth(toolbarRef.current)
  }

  function sortBy(key: string) {
    update({ ordering: ordering === key ? `-${key}` : key })
  }

  const title = queue ? 'Verification queue' : 'Accounts'
  const subtitle = queue
    ? 'Accounts whose RTU email is not verified yet.'
    : abilities.manageAccounts
      ? 'Search accounts, change roles, and suspend or reactivate people.'
      : 'Search accounts and verify new members.'

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <form ref={toolbarRef} className="toolbar" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="field field-grow">
          <span className="sr-only">Search accounts</span>
          <input
            type="search"
            placeholder="Search name, email, or college"
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="sr-only">Role</span>
          <select value={role} onChange={(event) => update({ role: event.target.value })}>
            <option value="">All roles</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>{ROLE_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr-only">Status</span>
          <select value={status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">Any status</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{STATUS_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr-only">Verification</span>
          <select value={verified} onChange={(event) => update({ verified: event.target.value })}>
            <option value="">Verified or not</option>
            <option value="true">Verified</option>
            <option value="false">Not verified</option>
          </select>
        </label>
        {hasFilters && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setQInput('')
              pushedQ.current = ''
              update({ q: '', role: '', status: '', verified: '' })
            }}
          >
            Clear filters
          </button>
        )}
      </form>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}{' '}
          <button type="button" className="link-button" onClick={() => setReload((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}

      <div className={`table-wrap card card-flush${loading ? ' is-loading' : ''}`} aria-busy={loading}>
        <table className="table table-hover">
          <thead>
            <tr>
              <SortHead column={SORTABLE[0]} ordering={ordering} onSort={sortBy} />
              <th scope="col">College or office</th>
              <SortHead column={SORTABLE[1]} ordering={ordering} onSort={sortBy} />
              <SortHead column={SORTABLE[2]} ordering={ordering} onSort={sortBy} />
              <th scope="col">Verification</th>
              <SortHead column={SORTABLE[3]} ordering={ordering} onSort={sortBy} />
            </tr>
          </thead>
          <tbody key={dataKey} className={`rows rows-${slide}`}>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                style={{ '--i': Math.min(index, 12) } as CSSProperties}
                className={row.id === selectedId ? 'is-selected' : undefined}
                onClick={() => setSelectedId(row.id)}
              >
                <td>
                  <button type="button" className="row-button" onClick={() => setSelectedId(row.id)}>
                    <strong>{row.display_name}</strong>
                    <small>{row.student_number ?? row.email}</small>
                  </button>
                </td>
                <td>
                  <div className="cell-name">
                    <span>{row.college || 'Not given'}</span>
                    <small>{row.member_type}</small>
                  </div>
                </td>
                <td><RoleBadge role={row.role} /></td>
                <td><StatusBadge status={row.status} /></td>
                <td><VerifiedBadge verified={row.is_verified} /></td>
                <td>{formatDate(row.date_joined)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="empty">
                  {hasFilters ? 'No accounts match these filters.' : 'There are no accounts yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="pager" aria-label="Pages">
        <span className="muted" role="status">
          {total > 0 ? `Showing ${first} to ${last} of ${total}` : loading ? 'Loading…' : ''}
        </span>
        <div className="pager-buttons">
          <button
            type="button"
            className="btn"
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn"
            disabled={!data?.next || loading}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </div>
      </nav>

      {selected && (
        <AccountPanel account={selected} onClose={() => setSelectedId(null)} onChanged={onChanged} />
      )}
    </>
  )
}

function SortHead({
  column,
  ordering,
  onSort,
}: {
  column: { key: string; label: string }
  ordering: string
  onSort: (key: string) => void
}) {
  const active = ordering === column.key || ordering === `-${column.key}`
  const descending = ordering === `-${column.key}`
  return (
    <th scope="col" aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="sort" onClick={() => onSort(column.key)}>
        {column.label}
        <span aria-hidden="true" className="sort-mark">{active ? (descending ? '↓' : '↑') : ''}</span>
      </button>
    </th>
  )
}
