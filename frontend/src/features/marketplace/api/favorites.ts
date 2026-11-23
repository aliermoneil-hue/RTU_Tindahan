/**
 * FAVORITES API
 * ---------------------------------------------------------------
 * Saved products and saved sellers, per signed-in member.
 *
 * The UI keeps reading `currentAccount.favs` / `.sfavs`, so this bridge only
 * translates between the server rows and the two id lists the prototype
 * already uses:
 *   - a saved listing is the UI id `api:<slug>`
 *   - a saved seller is the seller's email (the same key the UI uses as `owner`)
 * "Official RTU Store" is a bucket, not a user, so that one stays local.
 */

import { apiFetch } from '@/common/api/client'

import { API_ID_PREFIX } from './listings'

export interface ApiFavorite {
  id: number
  kind: 'listing' | 'seller'
  listing_id: number | null
  listing_slug: string | null
  listing_title: string | null
  seller_id: number | null
  seller_email: string | null
  seller_name: string | null
  created_at: string
}

interface ToggleResponse {
  saved: boolean
  favorite?: ApiFavorite
}

/** The caller's saved rows. Private: the server filters by the token. */
export function fetchFavorites(): Promise<ApiFavorite[]> {
  return apiFetch<ApiFavorite[]>('/favorites/')
}

/** Save or remove one listing on the server. Returns the resulting state. */
export function toggleListingFavorite(listingId: number): Promise<ToggleResponse> {
  return apiFetch<ToggleResponse>('/favorites/toggle/', {
    method: 'POST',
    body: { listing: listingId },
  })
}

/** Save or remove one seller on the server. Returns the resulting state. */
export function toggleSellerFavorite(email: string): Promise<ToggleResponse> {
  return apiFetch<ToggleResponse>('/favorites/toggle/', {
    method: 'POST',
    body: { seller: email },
  })
}

/** Server rows -> the two id lists the prototype renders from. */
export function favoriteKeys(list: ApiFavorite[]): { favs: string[]; sfavs: string[] } {
  const favs: string[] = []
  const sfavs: string[] = []

  for (const row of list) {
    if (row.kind === 'listing' && row.listing_slug) {
      favs.push(API_ID_PREFIX + row.listing_slug)
    } else if (row.kind === 'seller' && row.seller_email) {
      sfavs.push(row.seller_email)
    }
  }

  return { favs: [...new Set(favs)], sfavs: [...new Set(sfavs)] }
}
