import { useEffect } from 'react'
import { navigate, useRoute } from '@/common/router/router'
import { LoginPage, VerifyPage, useAuth } from '@/features/authentication'
import { BrowsePage } from '@/features/marketplace/pages/BrowsePage'
import { CartPage } from '@/features/marketplace/pages/CartPage'
import { ConfirmPage } from '@/features/marketplace/pages/ConfirmPage'
import { CreateListingPage } from '@/features/marketplace/pages/CreateListingPage'
import { FavoritesPage } from '@/features/marketplace/pages/FavoritesPage'
import { ForumPage } from '@/features/marketplace/pages/ForumPage'
import { ForumPostPage } from '@/features/marketplace/pages/ForumPostPage'
import { GuestSectionPage } from '@/features/marketplace/pages/GuestSectionPage'
import { HelpCenterPage } from '@/features/marketplace/pages/HelpCenterPage'
import { MarketplacePage } from '@/features/marketplace/pages/MarketplacePage'
import { MessagesPage } from '@/features/marketplace/pages/MessagesPage'
import { MyShopPage } from '@/features/marketplace/pages/MyShopPage'
import { OfficialStorePage } from '@/features/marketplace/pages/OfficialStorePage'
import { OrdersPage } from '@/features/marketplace/pages/OrdersPage'
import { ProductPage } from '@/features/marketplace/pages/ProductPage'
import { ProfilePage } from '@/features/marketplace/pages/ProfilePage'
import { StudentSellersPage } from '@/features/marketplace/pages/StudentSellersPage'
import { ForumReportsPage } from '@/features/marketplace/pages/admin/ForumReportsPage'
import { ModerationPage } from '@/features/marketplace/pages/admin/ModerationPage'
import { StaffToolsPage } from '@/features/marketplace/pages/admin/StaffToolsPage'
import { StoreInventoryPage } from '@/features/marketplace/pages/admin/StoreInventoryPage'
import { StoreOrdersPage } from '@/features/marketplace/pages/admin/StoreOrdersPage'
import { TransactionsPage } from '@/features/marketplace/pages/admin/TransactionsPage'
import { UsersAuditPage } from '@/features/marketplace/pages/admin/UsersAuditPage'
import { AppLayout } from './layouts/AppLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'

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
}

export function AppRoutes() {
  const { path } = useRoute()
  const { user, isLoading } = useAuth()

  /** Canonical page key used for both rendering and favicon selection. */
  const activePage = path === '' || path === 'landing' ? 'marketplace' : path

  const isPublicPath =
    path === '' ||
    path === 'landing' ||
    path === 'login' ||
    path === 'register' ||
    path === 'verify' ||
    path === 'books' ||
    path === 'merch' ||
    path === 'help' ||
    path === 'help-center'

  const redirectTo =
    !isLoading &&
    (user
      ? path === 'login' || path === 'register' || path === 'verify'
        ? 'marketplace'
        : null
      : !isPublicPath
        ? 'login'
        : null)

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true })
  }, [redirectTo])

  /** Swap the page favicon to match the current route. */
  useEffect(() => {
    const href = PAGE_FAVICONS[activePage] || '/favicon.svg'
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
    if (link) link.href = href
  }, [activePage])

  if (isLoading || redirectTo) {
    return (
      <p style={{ padding: 40, textAlign: 'center' }} className="muted">
        Loading...
      </p>
    )
  }

  // ----- signed-in -----
  if (user) {
    const active = activePage

    const renderAuthenticatedPage = () => {
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

    return (
      <AppLayout user={user} activePath={active}>
        {renderAuthenticatedPage()}
      </AppLayout>
    )
  }

  // ----- visitor -----
  if (path === 'login') {
    return <LoginPage />
  }
  if (path === 'register' || path === 'verify') {
    return <VerifyPage />
  }
  if (path === 'books') {
    return <GuestSectionPage kind="books" />
  }
  if (path === 'merch') {
    return <GuestSectionPage kind="merch" />
  }
  if (path === 'help' || path === 'help-center') {
    return (
      <PublicLayout>
        <div className="g-wrap" style={{ padding: '24px 16px' }}>
          <HelpCenterPage />
        </div>
      </PublicLayout>
    )
  }
  return (
    <PublicLayout>
      <LandingPage />
    </PublicLayout>
  )
}
