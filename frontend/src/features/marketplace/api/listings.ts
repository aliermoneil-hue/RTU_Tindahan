/**
 * CATALOGUE API
 * ---------------------------------------------------------------
 * The bridge between the Django backend and the marketplace UI.
 *
 * The pages do not know about this module: they keep reading
 * `PrototypeProduct` from `TindahanContext`. This file is the only place that
 * knows the backend's field names, so when the API changes, only this file
 * changes.
 *
 * Two naming traps are handled here:
 *   - the backend calls a listing's name `title`, and its category by id/name
 *   - the frontend groups listings into CATEGORIES, which the backend does not
 *     use, so `mapCategory()` translates (and falls back to 'Other Items')
 *
 * Everything is public: these endpoints need no token.
 */

import { apiFetch } from '@/common/api/client'
import type { IconName } from '@/common/components/icons'

import { CAT_META, OFFCAT } from '../constants'
import type { PrototypeProduct, UserListingRecord } from '../types'

/** Prefix for ids that came from the backend, so local ids never collide. */
export const API_ID_PREFIX = 'api:'

export interface ApiPhoto {
  id: number
  url: string
  alt_text: string
  sort_order: number
}

export interface ApiVariant {
  id: number
  name: string
  sku: string
  price: string | null
  unit_price: string
  on_hand: number
  available: number
  reserved: number
  low_stock_threshold: number | null
  is_active: boolean
}

export interface ApiListing {
  id: number
  slug: string
  title: string
  description: string
  category: number
  category_name: string
  category_slug: string
  listing_type: 'product' | 'service'
  condition: 'new' | 'used' | 'na'
  price: string
  quantity: number
  meetup_place: string
  is_official: boolean
  status: string
  view_count: number
  sold_count: number
  created_at: string
  seller_name: string
  seller_email: string
  photos: ApiPhoto[]
  variants: ApiVariant[]
}

export interface ApiCategory {
  id: number
  name: string
  slug: string
  parent: number | null
  sort_order: number
  is_active: boolean
}

export interface ApiPage<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ---------------------------------------------------------------------------
// Backend category -> UI category
// ---------------------------------------------------------------------------

const CATEGORY_ALIASES: Array<[RegExp, string]> = [
  [/uniform|apparel|clothing|shirt|polo|pants|skirt|blouse/i, 'Clothing and Accessories'],
  [/book|manual|textbook|module|worksheet|reviewer/i, 'Books and Academic Materials'],
  [/food|snack|drink|meal|rice|coffee|pastry/i, 'Food and Snacks'],
  [/merch|souvenir|lanyard|id lace/i, 'RTU Merchandise'],
  [/suppl|pen|paper|notebook|folder/i, 'School Supplies'],
  [/gadget|electronic|calc|charger|usb|cable/i, 'Electronics and Gadgets'],
  [/collect|craft|knick|custom/i, 'Knickknacks and Collectibles'],
]

/** Translate the backend's category into one the existing filters understand. */
export function mapCategory(dto: ApiListing): string {
  if (dto.listing_type === 'service') return 'Services'

  const name = dto.category_name ?? ''
  if (CAT_META[name]) return name

  for (const [pattern, category] of CATEGORY_ALIASES) {
    if (pattern.test(name)) return category
  }
  return 'Other Items'
}

/** Rough "how long ago" label, used when a card has no meetup window. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.floor((Date.now() - then) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** The prototype's official sub-type (OFFSUB keys), guessed from the title. */
function officialSub(title: string): string {
  const name = title.toLowerCase()
  if (name.includes('uniform')) return 'Uniform'
  if (name.includes('manual')) return 'Manual'
  if (name.includes('textbook')) return 'Textbook'
  return ''
}

/** Turn one backend listing into the shape the pages already render. */
export function toPrototypeProduct(dto: ApiListing): PrototypeProduct {
  const browseCategory = mapCategory(dto)
  const service = dto.listing_type === 'service'
  // The Official Store page filters on cat === 'Official' (see sellerKind), so
  // official items must move into that bucket, exactly like the prototype does.
  const official = dto.is_official && !service
  const sub = official ? officialSub(dto.title) : ''
  const cat = official ? 'Official' : browseCategory
  const category = (sub ? OFFCAT[sub] : '') || browseCategory

  const meta = CAT_META[category] ?? CAT_META['Other Items']
  const tone = meta[0]
  const icon = meta[1] as IconName
  const shortLabel = meta[2]

  const variants = (dto.variants ?? []).filter((v) => v.is_active)
  const hasVariants = variants.length > 0

  const vars = hasVariants
    ? {
        attrs: [{ name: 'Size', opts: variants.map((v) => v.name) }],
        rows: variants.map((v) => ({
          id: `v${v.id}`,
          opts: { Size: v.name },
          qty: v.available,
          onHand: v.on_hand,
          price: Number(v.unit_price),
        })),
      }
    : undefined

  const left = hasVariants
    ? variants.reduce((total, v) => total + v.available, 0)
    : dto.quantity

  return {
    id: API_ID_PREFIX + dto.slug,
    name: dto.title,
    price: Number(dto.price),
    cat,
    category,
    sub: official ? sub : undefined,
    tone,
    icon,
    tag: official ? sub || shortLabel : service ? 'Service' : dto.condition === 'used' ? 'Used' : shortLabel,
    seller: dto.seller_name,
    // 'official' is the prototype's seller key for the RTU store.
    owner: official ? 'official' : dto.seller_email,
    off: official,
    left,
    unit: 'pc',
    when: dto.meetup_place || timeAgo(dto.created_at),
    cond: service ? undefined : dto.condition === 'used' ? 'Used' : 'New',
    desc: dto.description,
    imgs: dto.photos && dto.photos.length > 0 ? dto.photos.map((p) => p.url) : undefined,
    pub: new Date(dto.created_at).getTime() || undefined,
    kind: service ? 'service' : undefined,
    vars,
    soldCount: dto.sold_count,
    hidden: false,
  }
}

/** `http://host/api/v1/listings/?page=2` -> `/listings/?page=2` */
function pathFromNextUrl(url: string): string {
  const marker = '/api/v1'
  const at = url.indexOf(marker)
  return at >= 0 ? url.slice(at + marker.length) : url
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

/** Every published listing, following pagination (5 pages = 100 listings). */
export async function fetchListings(maxPages = 5): Promise<ApiListing[]> {
  const collected: ApiListing[] = []
  let path: string | null = '/listings/'

  for (let page = 0; page < maxPages && path; page += 1) {
    const data: ApiPage<ApiListing> = await apiFetch<ApiPage<ApiListing>>(path)
    collected.push(...(data.results ?? []))
    path = data.next ? pathFromNextUrl(data.next) : null
  }
  return collected
}

/** One listing by its slug, or undefined when it is not visible to the caller. */
export async function fetchListing(slug: string): Promise<ApiListing | undefined> {
  try {
    return await apiFetch<ApiListing>(`/listings/${encodeURIComponent(slug)}/`)
  } catch {
    return undefined
  }
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  return apiFetch<ApiCategory[]>('/categories/')
}

// ---------------------------------------------------------------------------
// Merging into the local snapshot
// ---------------------------------------------------------------------------

// The context's DatabaseSnapshot is not exported, so describe just what is
// needed here. Keeping the merge dumb makes it easy to test and to remove.
export interface DatabaseShape {
  official: PrototypeProduct[]
  userListings: UserListingRecord[]
}

/**
 * Replace the backend-sourced entries in the snapshot with a fresh copy.
 * Local entries (ids that do not carry the API prefix) are left untouched, so
 * nothing a user created in the prototype disappears.
 */
export function mergeApiCatalogue<T extends DatabaseShape>(prev: T, listings: ApiListing[]): T {
  const isFromApi = (id: string) => id.startsWith(API_ID_PREFIX)

  const mapped = listings.map((dto) => ({ dto, product: toPrototypeProduct(dto) }))

  const officialFromApi = mapped.filter((x) => x.dto.is_official).map((x) => x.product)
  const studentFromApi = mapped.filter((x) => !x.dto.is_official).map((x) => x.product)

  const studentRecords: UserListingRecord[] = studentFromApi.map((product) => ({
    lid: product.id,
    ownerEmail: product.owner ?? '',
    state: 'live',
    paused: false,
    product,
  }))

  return {
    ...prev,
    official: [...officialFromApi, ...prev.official.filter((p) => !isFromApi(p.id))],
    userListings: [
      ...studentRecords,
      ...prev.userListings.filter((l) => !isFromApi(l.lid)),
    ],
  }
}
