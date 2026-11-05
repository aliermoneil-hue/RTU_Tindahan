import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import {
  CATEGORIES,
  CAT_META,
  CONDITIONS,
  DAYS,
  PLACES,
  SUBCATS,
  SVC_TYPES,
  SVC_UNITS,
  VAR_LIMITS,
  cleanDays,
  peso,
  sellerLabel,
  timeError,
  toMin,
  vSyncRows,
  winText,
} from '../constants'
import { useTindahan } from '../context/TindahanContext'
import { IMG_RULES, imgSrc } from '../imageStore'
import type { FulfillmentMethod } from '../types'
import { PhotoUploader } from '../components/PhotoUploader'
import './CreateListingPage.css'

const FULFILLMENT_OPTIONS: {
  id: FulfillmentMethod
  label: string
  desc: string
  icon: IconName
}[] = [
  {
    id: 'pickup',
    label: 'Pickup only',
    desc: 'Buyer meets you at your chosen campus pickup spot and time window.',
    icon: 'pin',
  },
  {
    id: 'delivery',
    label: 'Delivery only',
    desc: 'You deliver the item or service to the buyer’s agreed campus room or spot.',
    icon: 'bag',
  },
  {
    id: 'both',
    label: 'Both pickup and delivery',
    desc: 'Buyer can choose either campus pickup or campus delivery when ordering.',
    icon: 'check',
  },
]

export function CreateListingPage() {
  const {
    currentAccount,
    isStaffUser,
    draft,
    setDraft,
    listStep,
    setListStep,
    draftErrs,
    setDraftErrs,
    cancelEditListing,
    saveListingDraftToAccount,
    validateCurrentListingForSubmit,
    submitListingStepOrPublish,
    openModal,
    toast,
  } = useTindahan()

  // Local input state for the per-attribute option chip inputs (+ Add)
  const [optInputs, setOptInputs] = useState<[string, string, string]>(['', '', ''])
  // Confirmation modal before final submission (Requirement #4)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const presetPlaces = PLACES.filter((p) => p !== 'Others')
  const [othersPlaceMode, setOthersPlaceMode] = useState(
    () => Boolean(draft.place && !presetPlaces.includes(draft.place)),
  )

  if (!currentAccount) return null

  const svc = draft.type === 'service'
  const editing = !!draft.editLid
  const m = svc ? SVC_TYPES[draft.svcType] || ['t-print', 'print'] : CAT_META[draft.cat] || ['t-study', 'book', 'Study']
  const subs = !svc && SUBCATS[draft.cat] ? SUBCATS[draft.cat] : []
  const syncedRows = draft.vOn ? vSyncRows(draft) : []
  const varStock = draft.vOn
    ? syncedRows.reduce((a, r) => a + (parseInt(r.qty, 10) || 0), 0)
    : Number(draft.qty) || 1
  const sMin = toMin(draft.tStart)
  const eMin = toMin(draft.tEnd)
  const timeErrNow = timeError(draft)
  const validWin = !timeErrNow && sMin !== null && eMin !== null ? winText(sMin, eMin) : draft.window
  const firstImgSrc = draft.images.length ? imgSrc(draft.images[0]) : ''
  const activeFulfillment: FulfillmentMethod =
    draft.fulfillment === 'pickup' || draft.fulfillment === 'delivery' || draft.fulfillment === 'both'
      ? draft.fulfillment
      : 'pickup'

  const addVarOption = (idx: 0 | 1 | 2) => {
    const val = (optInputs[idx] || '').trim().slice(0, VAR_LIMITS.optName)
    if (!val) return
    const curOpts = draft.vAttrs[idx]?.opts || []
    if (curOpts.length >= VAR_LIMITS.opts) {
      toast(`Up to ${VAR_LIMITS.opts} options per attribute.`)
      return
    }
    if (curOpts.some((x) => x.toLowerCase() === val.toLowerCase())) {
      toast('That option is already in the list.')
      return
    }
    setDraft((prev) => {
      const nextAttrs = prev.vAttrs.map((a, i) =>
        i === idx ? { ...a, opts: [...a.opts, val] } : { ...a, opts: [...a.opts] },
      )
      const nextDraft = { ...prev, vAttrs: nextAttrs }
      nextDraft.vRows = vSyncRows(nextDraft)
      return nextDraft
    })
    setOptInputs((prev) => {
      const next: [string, string, string] = [...prev]
      next[idx] = ''
      return next
    })
    setDraftErrs((prev) => ({ ...prev, vars: '' }))
  }

  const removeVarOption = (idx: 0 | 1 | 2, optIdx: number) => {
    setDraft((prev) => {
      const nextAttrs = prev.vAttrs.map((a, i) =>
        i === idx
          ? { ...a, opts: a.opts.filter((_, j) => j !== optIdx) }
          : { ...a, opts: [...a.opts] },
      )
      const nextDraft = { ...prev, vAttrs: nextAttrs }
      nextDraft.vRows = vSyncRows(nextDraft)
      return nextDraft
    })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // On Step 1 or Step 2, advance normally
    if (listStep < 3) {
      submitListingStepOrPublish()
      return
    }
    // On Step 3, validate first; for new submissions, show the confirmation modal before final submission
    if (!validateCurrentListingForSubmit()) {
      return
    }
    if (!editing && !isStaffUser) {
      setShowSubmitConfirm(true)
      return
    }
    submitListingStepOrPublish()
  }

  return (
    <>
      <div className="row between wrap">
        <div>
          <span className="eyebrow">
            {editing ? 'EDIT YOUR LISTING' : isStaffUser ? 'ADMIN | SELL AN ITEM' : 'SELL ON CAMPUS'}
          </span>
          <h1>
            {editing
              ? svc
                ? 'Edit service'
                : 'Edit listing'
              : isStaffUser
                ? svc
                  ? 'Admin | Offer a Service'
                  : 'Admin | Sell an Item'
                : svc
                  ? 'Offer a service'
                  : 'Sell an item'}
          </h1>
          <p className="muted small">
            {editing
              ? 'Update your details below. Saving on the last step updates your listing.'
              : isStaffUser
                ? 'As RTU staff, what you post goes live right away.'
                : 'Every student listing and service is checked by RTU staff before buyers can see it.'}
          </p>
        </div>
        {editing && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={cancelEditListing}
          >
            Cancel editing
          </button>
        )}
      </div>

      {/* Type cards: Sell a product vs Offer a service */}
      <div className="lt-row" role="radiogroup" aria-label="What are you posting?">
        {(
          [
            [
              'product',
              'tag',
              'Sell a product',
              'Books, uniforms, calculators, food and other physical items.',
            ],
            [
              'service',
              'print',
              'Offer a service',
              'Printing, tutoring, ID photos, repairs, rentals and commission work.',
            ],
          ] as const
        ).map((t) => (
          <button
            key={t[0]}
            type="button"
            role="radio"
            aria-checked={draft.type === t[0]}
            className={`lt-card ${draft.type === t[0] ? 'on' : ''}`.trim()}
            disabled={editing}
            onClick={() => {
              if (editing) return
              setDraft((prev) => ({ ...prev, type: t[0] }))
              setDraftErrs({})
            }}
          >
            <span className="lt-ic">
              <Icon name={t[1] as IconName} />
            </span>
            <span>
              <b style={{ display: 'block' }}>{t[2]}</b>
              <span className="small muted">{t[3]}</span>
            </span>
          </button>
        ))}
      </div>

      {/* 3-step stepper */}
      <div className="steps" role="list">
        {(
          [
            svc ? '1. Service details' : '1. Item details',
            '2. Meetup & schedule',
            editing ? '3. Review & save' : '3. Review & submit',
          ] as const
        ).map((label, i) => (
          <div
            key={label}
            role="listitem"
            className={`step ${
              listStep === i + 1 ? 'on' : listStep > i + 1 ? 'done' : ''
            }`.trim()}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="create-two two">
        <form
          className="card stack"
          noValidate
          onSubmit={handleFormSubmit}
        >
          {listStep === 1 &&
            (svc ? (
              <>
                <div className="field">
                  <label htmlFor="lt">Service name</label>
                  <input
                    className="input"
                    id="lt"
                    value={draft.title}
                    maxLength={80}
                    placeholder="What service are you offering?"
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, title: e.target.value }))
                      setDraftErrs((prev) => ({ ...prev, title: '' }))
                    }}
                  />
                  {draftErrs.title && (
                    <span className="err" role="alert">
                      {draftErrs.title}
                    </span>
                  )}
                </div>

                <div className="grid2">
                  <div className="field">
                    <label htmlFor="lst">Type of service</label>
                    <select
                      className="input"
                      id="lst"
                      value={draft.svcType}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, svcType: e.target.value }))
                      }
                    >
                      {Object.keys(SVC_TYPES).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {draftErrs.svcType && (
                      <span className="err" role="alert">
                        {draftErrs.svcType}
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor="lu">Charged</label>
                    <select
                      className="input"
                      id="lu"
                      value={draft.unit}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, unit: e.target.value }))
                      }
                    >
                      {SVC_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    {draftErrs.unit && (
                      <span className="err" role="alert">
                        {draftErrs.unit}
                      </span>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="ld">What is included</label>
                  <textarea
                    className="input"
                    id="ld"
                    maxLength={400}
                    placeholder="Describe paper size, turnaround time, software or what the student should bring"
                    value={draft.desc}
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, desc: e.target.value }))
                      setDraftErrs((prev) => ({ ...prev, desc: '' }))
                    }}
                  />
                  <div className="row between">
                    {draftErrs.desc ? (
                      <span className="err" role="alert">
                        {draftErrs.desc}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="tiny muted tnum">{draft.desc.length}/400</span>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="lp">Rate (₱)</label>
                  <input
                    className="input tnum"
                    id="lp"
                    type="number"
                    min="1"
                    max="1000000"
                    inputMode="numeric"
                    value={draft.price}
                    placeholder="0"
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, price: e.target.value }))
                      setDraftErrs((prev) => ({ ...prev, price: '' }))
                    }}
                  />
                  {draftErrs.price && (
                    <span className="err" role="alert">
                      {draftErrs.price}
                    </span>
                  )}
                </div>

                <PhotoUploader
                  ids={draft.images}
                  max={IMG_RULES.listing}
                  label="Sample photos (optional, up to 10)"
                  errorMsg={draftErrs.photos}
                  onChange={(nextIds) => {
                    setDraft((prev) => ({ ...prev, images: nextIds }))
                    setDraftErrs((prev) => ({ ...prev, photos: '' }))
                  }}
                />
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="lt">Listing title</label>
                  <input
                    className="input"
                    id="lt"
                    value={draft.title}
                    maxLength={80}
                    placeholder="Name of your item"
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, title: e.target.value }))
                      setDraftErrs((prev) => ({ ...prev, title: '' }))
                    }}
                  />
                  {draftErrs.title && (
                    <span className="err" role="alert">
                      {draftErrs.title}
                    </span>
                  )}
                </div>

                <div className="grid2">
                  <div className="field">
                    <label htmlFor="lc">Category</label>
                    <select
                      className="input"
                      id="lc"
                      value={draft.cat}
                      onChange={(e) => {
                        const nextCat = e.target.value
                        setDraft((prev) => ({
                          ...prev,
                          cat: nextCat,
                          sub: (SUBCATS[nextCat] || []).includes(prev.sub) ? prev.sub : '',
                        }))
                        setDraftErrs((prev) => ({ ...prev, cat: '' }))
                      }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {draftErrs.cat && (
                      <span className="err" role="alert">
                        {draftErrs.cat}
                      </span>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="lco">Condition</label>
                    <select
                      className="input"
                      id="lco"
                      value={draft.cond}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, cond: e.target.value }))
                      }
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {draftErrs.cond && (
                      <span className="err" role="alert">
                        {draftErrs.cond}
                      </span>
                    )}
                  </div>
                </div>

                {subs.length > 0 && (
                  <div className="field">
                    <label htmlFor="lsub">Subcategory (optional)</label>
                    <select
                      className="input"
                      id="lsub"
                      value={draft.sub}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, sub: e.target.value }))
                      }
                    >
                      <option value="">None</option>
                      {subs.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="ld">Description</label>
                  <textarea
                    className="input"
                    id="ld"
                    maxLength={400}
                    placeholder="Condition, edition, size, what is included (at least 20 characters)..."
                    value={draft.desc}
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, desc: e.target.value }))
                      setDraftErrs((prev) => ({ ...prev, desc: '' }))
                    }}
                  />
                  <div className="row between">
                    {draftErrs.desc ? (
                      <span className="err" role="alert">
                        {draftErrs.desc}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="tiny muted tnum">{draft.desc.length}/400</span>
                  </div>
                </div>

                <div className="grid2">
                  <div className="field">
                    <label htmlFor="lp">Price (₱)</label>
                    <input
                      className="input tnum"
                      id="lp"
                      type="number"
                      min="1"
                      max="1000000"
                      inputMode="numeric"
                      value={draft.price}
                      placeholder="0"
                      onChange={(e) => {
                        setDraft((prev) => ({ ...prev, price: e.target.value }))
                        setDraftErrs((prev) => ({ ...prev, price: '' }))
                      }}
                    />
                    {draftErrs.price && (
                      <span className="err" role="alert">
                        {draftErrs.price}
                      </span>
                    )}
                  </div>

                  {!draft.vOn ? (
                    <div className="field">
                      <label htmlFor="lq">Quantity available</label>
                      <input
                        className="input tnum"
                        id="lq"
                        type="number"
                        min="1"
                        max={VAR_LIMITS.stock}
                        inputMode="numeric"
                        value={draft.qty}
                        onChange={(e) => {
                          setDraft((prev) => ({ ...prev, qty: e.target.value }))
                          setDraftErrs((prev) => ({ ...prev, qty: '' }))
                        }}
                      />
                      {draftErrs.qty && (
                        <span className="err" role="alert">
                          {draftErrs.qty}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="field">
                      <label>Total stock across variations</label>
                      <div className="input tnum" style={{ background: 'var(--bg)' }}>
                        {varStock}
                      </div>
                    </div>
                  )}
                </div>

                <PhotoUploader
                  ids={draft.images}
                  max={IMG_RULES.listing}
                  label="Photos (required, at least 1, up to 10)"
                  errorMsg={draftErrs.photos}
                  onChange={(nextIds) => {
                    setDraft((prev) => ({ ...prev, images: nextIds }))
                    setDraftErrs((prev) => ({ ...prev, photos: '' }))
                  }}
                />

                {/* Variation editor (varEditorHtml in js/9d-listings.js) */}
                <div className="card flat stack" style={{ background: 'var(--bg)', gap: 10 }}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.vOn}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setDraft((prev) => {
                          const next = { ...prev, vOn: checked }
                          if (checked) next.vRows = vSyncRows(next)
                          return next
                        })
                        setDraftErrs((prev) => ({ ...prev, vars: '', qty: '' }))
                      }}
                    />
                    <span>
                      <b>This item has variations</b> (such as color, size or edition, each with
                      its own stock)
                    </span>
                  </label>

                  {draft.vOn && (
                    <>
                      <p className="tiny muted">
                        Add up to 3 option types (for example Color, Size, and Style) and up to{' '}
                        {VAR_LIMITS.opts} choices in each (e.g., 2XS to 5XL). Then set the stock
                        for each combination.
                      </p>

                      {([0, 1, 2] as const).map((i) => {
                        const defaultName = i === 0 ? 'Color' : i === 1 ? 'Size' : 'Style'
                        const a = draft.vAttrs[i] || {
                          name: defaultName,
                          opts: [],
                        }
                        return (
                          <div
                            key={i}
                            className="stack"
                            style={{
                              gap: 6,
                              borderTop: '1px solid var(--line)',
                              paddingTop: 8,
                            }}
                          >
                            <div className="grid2">
                              <div className="field">
                                <label htmlFor={`va-n-${i}`}>
                                  Option {i + 1} name {i > 0 ? '(optional)' : ''}
                                </label>
                                <input
                                  className="input"
                                  id={`va-n-${i}`}
                                  maxLength={VAR_LIMITS.attrName}
                                  value={a.name}
                                  placeholder={defaultName}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setDraft((prev) => {
                                      const nextAttrs = prev.vAttrs.map((attr, idx) =>
                                        idx === i ? { ...attr, name: val } : attr,
                                      )
                                      const nextDraft = { ...prev, vAttrs: nextAttrs }
                                      nextDraft.vRows = vSyncRows(nextDraft)
                                      return nextDraft
                                    })
                                  }}
                                />
                              </div>

                              <div className="field">
                                <label htmlFor={`va-add-${i}`}>
                                  Add a {(a.name || 'option').toLowerCase()}
                                </label>
                                <div className="row" style={{ gap: 6 }}>
                                  <input
                                    className="input"
                                    id={`va-add-${i}`}
                                    maxLength={VAR_LIMITS.optName}
                                    placeholder={
                                      i === 0
                                        ? 'Add a color, then press Add'
                                        : i === 1
                                          ? 'Add a size (e.g. 2XS to 5XL), then press Add'
                                          : 'Add a style or option, then press Add'
                                    }
                                    value={optInputs[i]}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setOptInputs((prev) => {
                                        const next: [string, string, string] = [...prev]
                                        next[i] = v
                                        return next
                                      })
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        addVarOption(i)
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="btn ghost sm"
                                    onClick={() => addVarOption(i)}
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="row wrap" style={{ gap: 6 }}>
                              {a.opts.length ? (
                                a.opts.map((opt, j) => (
                                  <span key={`${opt}-${j}`} className="chip">
                                    {opt}{' '}
                                    <button
                                      type="button"
                                      aria-label={`Remove ${opt}`}
                                      onClick={() => removeVarOption(i, j)}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))
                              ) : (
                                <span className="tiny muted">No choices added yet.</span>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {syncedRows.length ? (
                        <div className="scroll-x">
                          <table className="tbl">
                            <thead>
                              <tr>
                                <th>Variation</th>
                                <th>Stock *</th>
                                <th>Price (₱, optional)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {syncedRows.map((r, i) => (
                                <tr key={r.key}>
                                  <td>
                                    <b>{Object.values(r.opts).join(' / ')}</b>
                                  </td>
                                  <td>
                                    <input
                                      className="input tnum"
                                      type="number"
                                      min="0"
                                      max={VAR_LIMITS.stock}
                                      inputMode="numeric"
                                      value={r.qty}
                                      style={{ maxWidth: 110 }}
                                      aria-label={`Stock for ${Object.values(r.opts).join(' ')}`}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        setDraft((prev) => {
                                          const baseRows = vSyncRows(prev)
                                          if (baseRows[i]) baseRows[i].qty = val
                                          return { ...prev, vRows: baseRows }
                                        })
                                        setDraftErrs((prev) => ({ ...prev, vars: '' }))
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="input tnum"
                                      type="number"
                                      min="1"
                                      max="1000000"
                                      inputMode="numeric"
                                      value={r.price}
                                      placeholder={draft.price || 'Same'}
                                      style={{ maxWidth: 130 }}
                                      aria-label={`Price for ${Object.values(r.opts).join(' ')}`}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        setDraft((prev) => {
                                          const baseRows = vSyncRows(prev)
                                          if (baseRows[i]) baseRows[i].price = val
                                          return { ...prev, vRows: baseRows }
                                        })
                                        setDraftErrs((prev) => ({ ...prev, vars: '' }))
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="tiny muted">
                          Add at least one choice above to set stock for each variation.
                        </p>
                      )}
                      {draftErrs.vars && (
                        <span className="err" role="alert">
                          {draftErrs.vars}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </>
            ))}

          {listStep === 2 && (
            <>
              {/* Requirement #1: Seller configures available fulfillment method(s) */}
              <div className="field">
                <label>Fulfillment methods available to buyers</label>
                <div
                  className="stack"
                  role="radiogroup"
                  aria-label="Fulfillment methods"
                  style={{ gap: 8 }}
                >
                  {FULFILLMENT_OPTIONS.map((opt) => {
                    const on = activeFulfillment === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`lt-card ${on ? 'on' : ''}`.trim()}
                        style={{ padding: '10px 12px' }}
                        onClick={() => {
                          setDraft((prev) => ({ ...prev, fulfillment: opt.id }))
                          setDraftErrs((prev) => ({ ...prev, fulfillment: '' }))
                        }}
                      >
                        <span className="lt-ic">
                          <Icon name={opt.icon} />
                        </span>
                        <span>
                          <b style={{ display: 'block' }}>{opt.label}</b>
                          <span className="small muted">{opt.desc}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {draftErrs.fulfillment && (
                  <span className="err" role="alert">
                    {draftErrs.fulfillment}
                  </span>
                )}
              </div>

              <div className="field">
                <label htmlFor="lpl">
                  {activeFulfillment === 'delivery'
                    ? 'Base campus location / delivery hub'
                    : 'Preferred campus meetup spot'}
                </label>
                <select
                  className="input"
                  id="lpl"
                  value={
                    othersPlaceMode || !presetPlaces.includes(draft.place)
                      ? 'Others'
                      : draft.place
                  }
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === 'Others') {
                      setOthersPlaceMode(true)
                      if (presetPlaces.includes(draft.place)) {
                        setDraft((prev) => ({ ...prev, place: '' }))
                      }
                    } else {
                      setOthersPlaceMode(false)
                      setDraft((prev) => ({ ...prev, place: val }))
                    }
                    setDraftErrs((prev) => ({ ...prev, place: '' }))
                  }}
                >
                  {PLACES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {(othersPlaceMode || !presetPlaces.includes(draft.place)) && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      className="input"
                      id="lpl-custom"
                      placeholder="Write your specific campus spot (e.g. Gate 2 bench, Room 402, Gymnasium lobby)..."
                      maxLength={80}
                      value={presetPlaces.includes(draft.place) ? '' : draft.place}
                      onChange={(e) => {
                        setDraft((prev) => ({ ...prev, place: e.target.value }))
                        setDraftErrs((prev) => ({ ...prev, place: '' }))
                      }}
                    />
                  </div>
                )}
                {draftErrs.place && (
                  <span className="err" role="alert">
                    {draftErrs.place}
                  </span>
                )}
              </div>

              <div className="field">
                <label htmlFor="lts">
                  Preferred {svc ? 'hours' : 'pickup / delivery window'} (7:00 AM to 7:00 PM)
                </label>
                <div className="timepair">
                  <div className="tp">
                    <span className="tiny muted">Start</span>
                    <input
                      className="input tnum"
                      id="lts"
                      type="time"
                      min="07:00"
                      max="19:00"
                      value={draft.tStart}
                      aria-label="Start time"
                      onChange={(e) => {
                        setDraft((prev) => ({ ...prev, tStart: e.target.value }))
                        setDraftErrs((prev) => ({ ...prev, window: '' }))
                      }}
                    />
                  </div>
                  <span className="muted tp-to">to</span>
                  <div className="tp">
                    <span className="tiny muted">End</span>
                    <input
                      className="input tnum"
                      id="lte"
                      type="time"
                      min="07:00"
                      max="19:00"
                      value={draft.tEnd}
                      aria-label="End time"
                      onChange={(e) => {
                        setDraft((prev) => ({ ...prev, tEnd: e.target.value }))
                        setDraftErrs((prev) => ({ ...prev, window: '' }))
                      }}
                    />
                  </div>
                </div>
                <span className="tiny muted">
                  Shown to buyers as: <b>{validWin}</b>
                </span>
                {(draftErrs.window || timeErrNow) && (
                  <span className="err" role="alert">
                    {draftErrs.window || timeErrNow}
                  </span>
                )}
              </div>

              <div className="field">
                <label>{svc ? 'Days you are available' : 'Selling days'}</label>
                <div
                  className="daypick"
                  role="group"
                  aria-label={svc ? 'Days you are available' : 'Selling days'}
                >
                  {DAYS.map((day) => {
                    const on = draft.days.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`btn sm ${on ? '' : 'ghost'}`.trim()}
                        aria-pressed={on}
                        onClick={() => {
                          setDraft((prev) => {
                            const has = prev.days.includes(day)
                            const nextDays = cleanDays(
                              has
                                ? prev.days.filter((x) => x !== day)
                                : [...prev.days, day],
                            )
                            return { ...prev, days: nextDays }
                          })
                          setDraftErrs((prev) => ({ ...prev, days: '' }))
                        }}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
                {draftErrs.days && (
                  <span className="err" role="alert">
                    {draftErrs.days}
                  </span>
                )}
              </div>

              <div className="note blue">
                <Icon name="shield" />
                <span>
                  Choose well-lit, busy areas on campus. Never share personal bank details in public
                  listings.
                </span>
              </div>
            </>
          )}

          {listStep === 3 && (
            <>
              <div className="note green">
                <Icon name="check" />
                <span>
                  {editing
                    ? 'Review your changes below, then save.'
                    : isStaffUser
                      ? `Ready to publish. As staff, this ${
                          svc ? 'service' : 'listing'
                        } goes live right away.`
                      : `Almost ready. When you submit, this ${
                          svc ? 'service' : 'listing'
                        } is sent to RTU staff for approval before buyers can see it.`}
                </span>
              </div>

              <div className="card flat stack" style={{ background: 'var(--bg)', gap: 6 }}>
                <b className="small">Summary before submitting</b>
                <div className="row between small">
                  <span className="muted">Fulfillment offered</span>
                  <b>
                    {activeFulfillment === 'both'
                      ? 'Pickup & Delivery'
                      : activeFulfillment === 'delivery'
                        ? 'Delivery only'
                        : 'Pickup only'}
                  </b>
                </div>
                <div className="row between small">
                  <span className="muted">Photos uploaded</span>
                  <b className="tnum">
                    {draft.images.length}/{IMG_RULES.listing} Photos
                  </b>
                </div>
                <div className="row between small">
                  <span className="muted">Schedule</span>
                  <b>
                    {draft.place} · {validWin}
                  </b>
                </div>
              </div>

              <label className="check">
                <input
                  type="checkbox"
                  id="lagree"
                  checked={draft.agree}
                  onChange={(e) => {
                    setDraft((prev) => ({ ...prev, agree: e.target.checked }))
                    setDraftErrs((prev) => ({ ...prev, agree: '' }))
                  }}
                />
                <span>
                  I confirm that this {svc ? 'service' : 'item'} follows the RTU Tindahan guidelines
                  and is not on the prohibited list (medicines, vaping products, exam materials,
                  resale tickets).
                </span>
              </label>
              {draftErrs.agree && (
                <span className="err" role="alert">
                  {draftErrs.agree}
                </span>
              )}

              <button
                type="button"
                className="link"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => openModal({ kind: 'rules' })}
              >
                Read prohibited items guide
              </button>
            </>
          )}

          <div className="row between wrap">
            {listStep > 1 ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setListStep((listStep - 1) as 1 | 2)}
              >
                Back
              </button>
            ) : (
              <span />
            )}

            <div className="row">
              {!editing && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={saveListingDraftToAccount}
                >
                  Save draft
                </button>
              )}
              <button
                type="submit"
                className={`btn ${listStep === 3 ? 'yellow lg' : ''}`.trim()}
              >
                {listStep < 3
                  ? 'Continue'
                  : editing
                    ? 'Save changes'
                    : isStaffUser
                      ? 'Publish now'
                      : 'Submit for approval'}
              </button>
            </div>
          </div>
        </form>

        {/* Right live preview card */}
        <div className="card stack">
          <span className="eyebrow">LIVE PREVIEW</span>
          <div
            className={`photo ${m[0]} ${firstImgSrc ? 'has-img' : ''}`.trim()}
            style={{ aspectRatio: '4 / 3' }}
          >
            {firstImgSrc ? (
              <img className="pimg" src={firstImgSrc} alt="Preview" />
            ) : null}
            <Icon name={m[1] as IconName} />
            <span className="tag">{svc ? 'Service' : m[2]}</span>
          </div>

          <div className="row wrap" style={{ gap: 6 }}>
            <span className={`srcpill ${isStaffUser ? 'school' : 'student'}`}>
              {isStaffUser ? 'Official RTU Store' : 'Student seller'}
            </span>
            {svc ? (
              <span className="srcpill svc">Service · {draft.svcType}</span>
            ) : (
              draft.sub && <span className="pill">{draft.sub}</span>
            )}
            <span className="pill blue">
              {activeFulfillment === 'both'
                ? 'Pickup or Delivery'
                : activeFulfillment === 'delivery'
                  ? 'Delivery only'
                  : 'Pickup only'}
            </span>
          </div>

          <h3 style={{ overflowWrap: 'anywhere' }}>
            {draft.title || (svc ? 'Your service name' : 'Your listing title')}
          </h3>

          <span className="price tnum">
            {draft.price ? peso(Number(draft.price)) : '₱0'}
            {svc ? <small> {draft.unit}</small> : null}
          </span>

          <p className="small muted" style={{ overflowWrap: 'anywhere' }}>
            {draft.desc || 'Your description will appear here as you type.'}
          </p>

          <div className="tiny muted">
            {draft.place} · {validWin} · {cleanDays(draft.days).join(', ') || 'No days picked'}
            {svc ? '' : ` · ${varStock} available`}
          </div>

          <div className="tiny muted">
            Seller: <b>{sellerLabel(currentAccount)}</b> · Verified
          </div>
        </div>
      </div>

      {/* Requirement #4: Seller Confirmation Popup Modal Before Submitting for Approval */}
      {showSubmitConfirm && (
        <>
          <div
            className="modal-scrim cfm-scrim show"
            onClick={() => setShowSubmitConfirm(false)}
          />
          <div
            className="card dlg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-approval-modal-title"
            style={{ zIndex: 112, width: 'min(500px, calc(100vw - 32px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between">
              <div className="row" style={{ gap: 8 }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'var(--soft)',
                    color: 'var(--blue)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name="shield" size="sm" />
                </span>
                <h2 id="submit-approval-modal-title" style={{ fontSize: 18 }}>
                  Submit for Approval?
                </h2>
              </div>
              <button
                type="button"
                className="iconbtn"
                aria-label="Close"
                onClick={() => setShowSubmitConfirm(false)}
              >
                <Icon name="x" />
              </button>
            </div>

            <div className="stack" style={{ gap: 10 }}>
              <p className="small">
                Before submitting your listing, please make sure that all information and uploaded
                images are accurate and that your product or service follows the RTU Tindahan rules
                and regulations.
              </p>
              <p className="small">
                Your submission will be reviewed by the administrator before it becomes available on
                the marketplace.
              </p>
              <div className="note blue">
                <Icon name="clock" size="sm" />
                <span className="small">
                  The review process may take approximately <b>3–5 working days</b> (estimated
                  review period).
                </span>
              </div>
              <p className="small">
                <b>Are you sure you want to submit this listing for approval?</b>
              </p>
            </div>

            <div className="row between wrap" style={{ marginTop: 6, gap: 8 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Go Back / Review Listing
              </button>
              <button
                type="button"
                className="btn yellow"
                onClick={() => {
                  setShowSubmitConfirm(false)
                  submitListingStepOrPublish()
                }}
              >
                <Icon name="check" size="sm" />
                Confirm Submission
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
