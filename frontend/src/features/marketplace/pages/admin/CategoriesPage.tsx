import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { ApiRequestError } from '@/common/api/client'
import {
  createCategory,
  deleteCategory,
  fetchCategoriesAdmin,
  updateCategory,
  type ApiCategory,
} from '../../api/listings'

/**
 * AD-03 and MN-02: the marketplace's categories, managed from the panel.
 *
 * The screen is administrator-only because the endpoint is: every write here is
 * refused for a moderator, a member or a visitor, and the server is the one
 * saying no. A category that still holds listings cannot be deleted — the API
 * refuses it and this screen offers "turn it off" instead, because a listing
 * must never lose its place.
 */
export function CategoriesPage() {
  const [rows, setRows] = useState<ApiCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [sortOrder, setSortOrder] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchCategoriesAdmin())
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'The categories could not be loaded. Are you signed in as an administrator?',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    const clean = name.trim()
    if (!clean) {
      setError('A category needs a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createCategory({
        name: clean,
        parent: parentId ? Number(parentId) : null,
        sort_order: sortOrder ? Number(sortOrder) : 0,
      })
      setName('')
      setParentId('')
      setSortOrder('')
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That category was not created.')
    } finally {
      setBusy(false)
    }
  }

  async function patch(slug: string, body: Parameters<typeof updateCategory>[1]) {
    setBusy(true)
    setError(null)
    try {
      await updateCategory(slug, body)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That change was not saved.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(category: ApiCategory) {
    setBusy(true)
    setError(null)
    try {
      await deleteCategory(category.slug)
      await load()
    } catch (err) {
      // The server refuses a delete while listings rely on it; offer the safe path.
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'That category could not be deleted. Try turning it off instead.',
      )
    } finally {
      setBusy(false)
    }
  }

  const topLevel = rows.filter((r) => r.parent === null)

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card stack" style={{ gap: 4 }}>
        <b>Marketplace categories</b>
        <p className="small muted" style={{ margin: 0 }}>
          What a seller picks from when they post. Changes take effect at once — no deploy. Turning
          a category off stops new listings choosing it and keeps the ones already there where they
          are.
        </p>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <b className="small">Add a category</b>
        <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
          <label className="small" style={{ gap: 4 }}>
            Name
            <input
              className="input"
              value={name}
              placeholder="Sports equipment"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="small" style={{ gap: 4 }}>
            Parent (optional)
            <select
              className="input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Top level</option>
              {topLevel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="small" style={{ gap: 4 }}>
            Order
            <input
              className="input"
              type="number"
              min={0}
              value={sortOrder}
              placeholder="0"
              style={{ width: 90 }}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
          <button type="button" className="btn" disabled={busy} onClick={() => void add()}>
            <Icon name="plus" size="sm" /> Add
          </button>
        </div>
        {error && (
          <p className="small" role="alert" style={{ color: 'var(--red)', margin: 0 }}>
            {error}
          </p>
        )}
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <div className="row between wrap">
          <b className="small">
            {rows.length} categor{rows.length === 1 ? 'y' : 'ies'}
          </b>
          {loading && <span className="tiny muted">Loading…</span>}
        </div>

        {rows.map((c) => (
          <div key={c.id} className="row between wrap" style={{ gap: 8, padding: '6px 0' }}>
            <div className="row wrap" style={{ gap: 8, minWidth: 0 }}>
              <input
                className="input"
                defaultValue={c.name}
                aria-label={`Name of ${c.name}`}
                style={{ maxWidth: 240 }}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== c.name) void patch(c.slug, { name: next })
                }}
              />
              {c.parent_name && <span className="tiny muted">in {c.parent_name}</span>}
              <span className="pill">
                {c.listing_count ?? 0} listing{(c.listing_count ?? 0) === 1 ? '' : 's'}
              </span>
              {!c.is_active && <span className="pill yellow">Off</span>}
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              <label className="small row" style={{ gap: 4 }}>
                Order
                <input
                  className="input"
                  type="number"
                  min={0}
                  defaultValue={c.sort_order}
                  aria-label={`Order of ${c.name}`}
                  style={{ width: 80 }}
                  onBlur={(e) => {
                    const next = Number(e.target.value)
                    if (Number.isFinite(next) && next !== c.sort_order)
                      void patch(c.slug, { sort_order: next })
                  }}
                />
              </label>
              <button
                type="button"
                className="btn ghost sm"
                disabled={busy}
                onClick={() => void patch(c.slug, { is_active: !c.is_active })}
              >
                {c.is_active ? 'Turn off' : 'Turn on'}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                disabled={busy || (c.listing_count ?? 0) > 0}
                title={
                  (c.listing_count ?? 0) > 0
                    ? 'Turn it off instead: listings still use it'
                    : 'Delete this empty category'
                }
                onClick={() => void remove(c)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {!loading && !rows.length && (
          <p className="small muted" style={{ margin: 0 }}>
            No categories yet. Add the first one above.
          </p>
        )}
      </div>
    </div>
  )
}
