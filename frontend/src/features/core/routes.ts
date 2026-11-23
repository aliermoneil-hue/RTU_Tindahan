import type { IconName } from '@/common/components/icons'
import type { Role } from '@/common/types'

/**
 * PAGE REGISTRY
 * ---------------------------------------------------------------
 * One list that describes every signed-in page. The sidebar menu, the
 * placeholder pages and the page titles are all built from it.
 *
 * To add a page to the sidebar: add an entry here, then add its component
 * in AppRoutes.tsx. `backend` tells us if an API exists for it yet.
 */
export type NavSection = 'BUY' | 'SELL' | 'COMMUNITY' | 'ADMIN'

export interface PageInfo {
  path: string
  title: string
  icon: IconName
  /** Which sidebar group it belongs to. Omit for pages not in the sidebar. */
  section?: NavSection
  /** Short description of the prototype page this will become. */
  about: string
  /** 'missing' = the Django backend has no endpoint for this yet. */
  backend: 'missing' | 'available'
}

export const APP_PAGES: PageInfo[] = [
  { path: 'marketplace', title: 'Marketplace', icon: 'home', section: 'BUY', backend: 'available',
    about: 'Category tiles and the latest listings from verified RTU sellers.' },
  { path: 'product', title: 'Product', icon: 'tag', backend: 'available',
    about: 'Listing detail page: photos, price, meetup point, and reserve button.' },
  { path: 'browse', title: 'Browse All', icon: 'grid', section: 'BUY', backend: 'available',
    about: 'Search, filter and sort every listing.' },
  { path: 'orders', title: 'My Orders', icon: 'bag', section: 'BUY', backend: 'available',
    about: 'Your requests and pickups, grouped by status.' },
  { path: 'student-sellers', title: 'Student Sellers', icon: 'user', section: 'BUY', backend: 'available',
    about: 'Listings posted by RTU students.' },
  { path: 'store', title: 'Official RTU Store', icon: 'shield', section: 'BUY', backend: 'available',
    about: 'Uniforms, books and merchandise published by RTU staff.' },
  { path: 'create', title: 'Sell an item', icon: 'tag', section: 'SELL', backend: 'available',
    about: 'The form for posting an item or service.' },
  { path: 'shop', title: 'My shop', icon: 'eye', section: 'SELL', backend: 'available',
    about: 'Your listings and the requests you received.' },
  { path: 'forum', title: 'Forum', icon: 'mega', section: 'COMMUNITY', backend: 'available',
    about: 'Campus discussion board.' },
  { path: 'help', title: 'Help Center', icon: 'info', section: 'COMMUNITY', backend: 'missing',
    about: 'Website user manual, pickup/delivery rules, policies, and frequently asked questions.' },
  { path: 'moderation', title: 'Listing approval', icon: 'shield', section: 'ADMIN', backend: 'available',
    about: 'Staff review of new listings.' },
  { path: 'users', title: 'Users and audit', icon: 'user', section: 'ADMIN', backend: 'available',
    about: 'Account management and the audit log.' },
  { path: 'baoorders', title: 'Store orders', icon: 'bag', section: 'ADMIN', backend: 'available',
    about: 'BAO Official RTU Store tickets, face-to-face entry, order sheet, and email outbox.' },
  { path: 'baostock', title: 'Store inventory', icon: 'tag', section: 'ADMIN', backend: 'available',
    about: 'BAO Official RTU Store stock ledger, item types, windows/limits, and daily count.' },
  { path: 'transactions', title: 'Transactions', icon: 'bag', section: 'ADMIN', backend: 'available',
    about: 'Completed pickups and CSV export.' },
  { path: 'forum-reports', title: 'Forum Reports', icon: 'flag', section: 'ADMIN', backend: 'available',
    about: 'Reported forum posts.' },
  { path: 'staff', title: 'Staff tools', icon: 'edit', section: 'ADMIN', backend: 'available',
    about: 'Backup, restore and other staff utilities.' },
  // Pages reached from the top bar (not in the sidebar):
  { path: 'messages', title: 'Messages', icon: 'msg', backend: 'available',
    about: 'Chat with sellers and the Official RTU Store.' },
  { path: 'cart', title: 'Request cart', icon: 'cart', backend: 'available',
    about: 'Reserve items for a campus meetup.' },
  { path: 'favorites', title: 'Favorites', icon: 'heart', backend: 'available',
    about: 'Listings you saved.' },
  { path: 'profile', title: 'My profile', icon: 'user', backend: 'available',
    about: 'Your account details. The backend already supports reading and editing them (GET/PATCH /auth/me/).' },
]

export const NAV_SECTIONS: NavSection[] = ['BUY', 'SELL', 'COMMUNITY', 'ADMIN']

export function findPage(path: string): PageInfo | undefined {
  return APP_PAGES.find((p) => p.path === path)
}

/** Staff roles see the ADMIN group in the sidebar (same rule as the prototype's moderator). */
export function canSeeAdmin(role: Role): boolean {
  return role === 'moderator' || role === 'administrator'
}
