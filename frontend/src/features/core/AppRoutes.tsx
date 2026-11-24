import { Suspense, useEffect } from 'react'
import { navigate, useRoute } from '@/common/router/router'
import { clearAfterLogin, peekAfterLogin, setAfterLogin } from '@/common/utils/afterLogin'
import { useAuth } from '@/features/authentication'
import { useTindahan } from '../marketplace/context/TindahanContext'
import {
  BrowsePage,
  CartPage,
  ConfirmPage,
  CreateListingPage,
  FavoritesPage,
  ForumPage,
  ForumPostPage,
  ForumReportsPage,
  ForgotPasswordPage,
  GuestOfficialStorePage,
  GuestSectionPage,
  GuestStudentSellersPage,
  HelpCenterPage,
  LandingPage,
  LoginPage,
  MarketplacePage,
  MessagesPage,
  ModerationPage,
  MyShopPage,
  NotFoundPage,
  OfficialStorePage,
  OrdersPage,
  ProductPage,
  ProfilePage,
  StaffToolsPage,
  StoreInventoryPage,
  StoreOrdersPage,
  StudentSellersPage,
  TransactionsPage,
  UsersAuditPage,
  VerifyPage,
} from './lazyPages'
import { AppLayout } from './layouts/AppLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { BrandLoader } from '@/common/components/BrandLoader/BrandLoader'
import { useAppReady } from '@/common/components/BrandLoader/useAppReady'

/**
 * ROUTES: decides which page to show.
 *  - Visitors (not signed in): landing page, login, register/verify, books, merch.
 *  - Signed-in users: all student, seller, community, and admin pages inside AppLayout.
 *  - Wrong combination: redirect (visitor opens a member page -> login).
 */

/** Import page icons from src/assets/icons/ so they are version-controlled and processed by Vite. */
import buyMarketplaceIco from '@/assets/icons/buy-marketplace.ico'
import buyBrowseIco from '@/assets/icons/buy-browse.ico'
import buyProductIco from '@/assets/icons/buy-product.ico'
import buyOrdersIco from '@/assets/icons/buy-orders.ico'
import buyStudentSellersIco from '@/assets/icons/buy-student-sellers.ico'
import buyStoreIco from '@/assets/icons/buy-store.ico'
import sellCreateIco from '@/assets/icons/sell-create.ico'
import sellShopIco from '@/assets/icons/sell-shop.ico'
import communityForumIco from '@/assets/icons/community-forum.ico'
import communityHelpIco from '@/assets/icons/community-help.ico'
import adminModerationIco from '@/assets/icons/admin-moderation.ico'
import adminUsersIco from '@/assets/icons/admin-users.ico'
import adminBaoOrdersIco from '@/assets/icons/admin-baoorders.ico'
import adminBaoStockIco from '@/assets/icons/admin-baostock.ico'
import adminTransactionsIco from '@/assets/icons/admin-transactions.ico'
import adminForumReportsIco from '@/assets/icons/admin-forum-reports.ico'
import adminStaffIco from '@/assets/icons/admin-staff.ico'
import topbarMessagesIco from '@/assets/icons/topbar-messages.ico'
import topbarCartIco from '@/assets/icons/topbar-cart.ico'
import topbarFavoritesIco from '@/assets/icons/topbar-favorites.ico'
import topbarProfileIco from '@/assets/icons/topbar-profile.ico'
import signInIco from '@/assets/icons/sign-in.ico'
import signUpIco from '@/assets/icons/sign-up.ico'

/** Maps each signed-in route path to its .ico favicon. */
const PAGE_FAVICONS: Record<string, string> = {
  marketplace: buyMarketplaceIco,
  browse: buyBrowseIco,
  product: buyProductIco,
  orders: buyOrdersIco,
  'student-sellers': buyStudentSellersIco,
  store: buyStoreIco,
  create: sellCreateIco,
  shop: sellShopIco,
  forum: communityForumIco,
  help: communityHelpIco,
  moderation: adminModerationIco,
  users: adminUsersIco,
  baoorders: adminBaoOrdersIco,
  baostock: adminBaoStockIco,
  transactions: adminTransactionsIco,
  'forum-reports': adminForumReportsIco,
  staff: adminStaffIco,
  messages: topbarMessagesIco,
  cart: topbarCartIco,
  favorites: topbarFavoritesIco,
  profile: topbarProfileIco,
  login: signInIco,
  register: signUpIco,
  'forgot-password': signInIco,
}

/** Held only while a page's chunk downloads; the layout above is already up. */
function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="sr-only">Loading</span>
    </div>
  )
}

/** Routes that use the icon of another page (sub pages and alias paths). */
const FAVICON_ALIASES: Record<string, string> = {
  post: 'forum',
  market: 'marketplace',
  official: 'store',
  sellers: 'student-sellers',
  list: 'create',
  seller: 'shop',
  forumreports: 'forum-reports',
  'store-orders': 'baoorders',
  'store-inventory': 'baostock',
  confirm: 'orders',
  'help-center': 'help',
  verify: 'register',

}

function renderActiveRoute(path: string, user: { email: string; role: string } | null) {
  const active = path === '' || path === 'landing' ? 'marketplace' : path

  // ----- signed-in -----
  if (user) {
    switch (active) {
      case 'marketplace':
      case 'market':
        return <MarketplacePage />
      case 'browse':
        return <BrowsePage />
      case 'product':
        return <ProductPage />
      case 'store':
      case 'official':
        return <OfficialStorePage />
      case 'student-sellers':
      case 'sellers':
        return <StudentSellersPage />
      case 'cart':
        return <CartPage />
      case 'confirm':
        return <ConfirmPage />
      case 'orders':
        return <OrdersPage />
      case 'create':
      case 'list':
        return <CreateListingPage />
      case 'shop':
      case 'seller':
        return <MyShopPage />
      case 'forum':
        return <ForumPage />
      case 'help':
      case 'help-center':
        return <HelpCenterPage />
      case 'post':
        return <ForumPostPage />
      case 'messages':
        return <MessagesPage />
      case 'favorites':
        return <FavoritesPage />
      case 'profile':
        return <ProfilePage />
      case 'books':
        return <GuestSectionPage kind="books" />
      case 'merch':
        return <GuestSectionPage kind="merch" />
      case 'moderation':
        return <ModerationPage />
      case 'users':
        return <UsersAuditPage />
      case 'baoorders':
      case 'store-orders':
        return <StoreOrdersPage />
      case 'baostock':
      case 'store-inventory':
        return <StoreInventoryPage />
      case 'transactions':
        return <TransactionsPage />
      case 'forum-reports':
      case 'forumreports':
        return <ForumReportsPage />
      case 'staff':
        return <StaffToolsPage />
      default:
        return <NotFoundPage />
    }
  }

  // ----- visitor -----
  if (path === 'login') {
    return <LoginPage />
  }
  if (path === 'register' || path === 'verify') {
    return <VerifyPage />
  }
  if (path === 'forgot-password') {
    return <ForgotPasswordPage />
  }
  if (path === 'books') {
    return <GuestSectionPage kind="books" />
  }
  if (path === 'merch') {
    return <GuestSectionPage kind="merch" />
  }
  if (path === 'student-sellers') {
    return <GuestStudentSellersPage />
  }
  if (path === 'store') {
    return <GuestOfficialStorePage />
  }
  if (path === 'help' || path === 'help-center') {
    return (
      <div className="g-wrap" style={{ padding: '24px 16px' }}>
        <HelpCenterPage />
      </div>
    )
  }
  return <LandingPage />
}

export function AppRoutes() {
  const { path, params } = useRoute()
  const { user, isLoading: authLoading, isSigningIn } = useAuth()
  const { hasSettledInitialFetch } = useTindahan()

  /** Canonical page key used for both rendering and favicon selection. */
  const activePage = path === '' || path === 'landing' ? 'marketplace' : path

  const isPublicPath =
    path === '' ||
    path === 'landing' ||
    path === 'login' ||
    path === 'register' ||
    path === 'verify' ||
    path === 'forgot-password' ||
    path === 'books' ||
    path === 'merch' ||
    path === 'student-sellers' ||
    path === 'store' ||
    path === 'help' ||
    path === 'help-center'

  const redirectTo =
    !authLoading &&
    (user
      ? path === 'login' || path === 'register' || path === 'verify' || path === 'forgot-password'
        ? peekAfterLogin() ?? 'marketplace'
        : null
      : !isPublicPath
        ? 'login'
        : null)

  const appReady = useAppReady({
    authLoading,
    isAuthenticated: !!user,
    listingsSettled: hasSettledInitialFetch,
  })

  const showOverlay = !appReady || Boolean(redirectTo) || Boolean(isSigningIn)

  /** Swap the page favicon to match the current route. */
  useEffect(() => {
    const key = FAVICON_ALIASES[activePage] || activePage
    const href = PAGE_FAVICONS[key] || '/favicon.svg'
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
    if (!link) return
    // index.html declares the icon as svg+xml, but the page icons are .ico files
    link.type = href === '/favicon.svg' ? 'image/svg+xml' : 'image/x-icon'
    link.href = href
  }, [activePage])

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true })
  }, [redirectTo])

  // When the user lands on the page they were redirected to after login, clear the saved target.
  useEffect(() => {
    if (!user) return
    const target = peekAfterLogin()
    if (!target) return
    const targetPath = target.split('?')[0]
    if (path === targetPath || path === '' && targetPath === 'marketplace') {
      clearAfterLogin()
    }
  }, [user, path])

  // When a visitor opens a member page directly, save the current path so it can be restored after login.
  useEffect(() => {
    if (redirectTo === 'login' && !user) {
      const withQuery = params.toString() ? `${path}?${params.toString()}` : path
      setAfterLogin(withQuery)
    }
  }, [redirectTo, user, path, params])

  /** Mobile only: after signing in / creating an account from the landing page,
   * stay at the top for 3 seconds, then scroll down with animation. The flag is
   * set in sessionStorage by PubTop before navigation, so it survives the page
   * change (PubTop unmounts on login/register). */
  useEffect(() => {
    const isMobile = window.innerWidth <= 900
    const shouldScroll = sessionStorage.getItem('rtu:scroll-after-login') === 'true'
    const isAuthPage = path === 'login' || path === 'register' || path === 'forgot-password'

    if (!isMobile || !shouldScroll || !isAuthPage) return

    sessionStorage.removeItem('rtu:scroll-after-login')

    const timer = setTimeout(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }, 1000)

    return () => clearTimeout(timer)
  }, [path])

  return (
    <>
      <BrandLoader
        isLoading={showOverlay}
        variant={isSigningIn ? 'full' : 'auto'}
        immediate={isSigningIn}
        onExited={() => {}}
      />
      {!authLoading && !redirectTo && (
        <>
          {/* Signed-in pages use AppLayout; login/verify pages have their own layout */}
          {user ? (
            <AppLayout user={user} activePath={activePage}>
              <Suspense fallback={<PageLoading />}>{renderActiveRoute(path, user)}</Suspense>
            </AppLayout>
          ) : path === 'login' || path === 'register' || path === 'verify' || path === 'forgot-password' ? (
            <Suspense fallback={<PageLoading />}>{renderActiveRoute(path, user)}</Suspense>
          ) : (
            <PublicLayout>
              <Suspense fallback={<PageLoading />}>{renderActiveRoute(path, user)}</Suspense>
            </PublicLayout>
          )}
        </>
      )}
    </>
  )
}
