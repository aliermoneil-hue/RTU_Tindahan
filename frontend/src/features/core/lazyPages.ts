import { lazy } from 'react'

/**
 * Every page is loaded on demand.
 *
 * All of them used to be imported eagerly, so the first paint carried the
 * marketplace, the store, the admin screens and the login artwork in one
 * 900 KB bundle, whatever the visitor asked for. Splitting per page means a
 * phone opening the marketplace downloads only the marketplace.
 */
export const MarketplacePage = lazy(() =>
  import('@/features/marketplace/pages/MarketplacePage').then((m) => ({
    default: m.MarketplacePage,
  })),
)
export const BrowsePage = lazy(() =>
  import('@/features/marketplace/pages/BrowsePage').then((m) => ({ default: m.BrowsePage })),
)
export const ProductPage = lazy(() =>
  import('@/features/marketplace/pages/ProductPage').then((m) => ({ default: m.ProductPage })),
)
export const CartPage = lazy(() =>
  import('@/features/marketplace/pages/CartPage').then((m) => ({ default: m.CartPage })),
)
export const ConfirmPage = lazy(() =>
  import('@/features/marketplace/pages/ConfirmPage').then((m) => ({ default: m.ConfirmPage })),
)
export const OrdersPage = lazy(() =>
  import('@/features/marketplace/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })),
)
export const CreateListingPage = lazy(() =>
  import('@/features/marketplace/pages/CreateListingPage').then((m) => ({
    default: m.CreateListingPage,
  })),
)
export const MyShopPage = lazy(() =>
  import('@/features/marketplace/pages/MyShopPage').then((m) => ({ default: m.MyShopPage })),
)
export const MessagesPage = lazy(() =>
  import('@/features/marketplace/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
)
export const FavoritesPage = lazy(() =>
  import('@/features/marketplace/pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })),
)
export const ProfilePage = lazy(() =>
  import('@/features/marketplace/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
export const StudentSellersPage = lazy(() =>
  import('@/features/marketplace/pages/StudentSellersPage').then((m) => ({
    default: m.StudentSellersPage,
  })),
)
export const OfficialStorePage = lazy(() =>
  import('@/features/marketplace/pages/OfficialStorePage').then((m) => ({
    default: m.OfficialStorePage,
  })),
)
export const ForumPage = lazy(() =>
  import('@/features/marketplace/pages/ForumPage').then((m) => ({ default: m.ForumPage })),
)
export const ForumPostPage = lazy(() =>
  import('@/features/marketplace/pages/ForumPostPage').then((m) => ({ default: m.ForumPostPage })),
)
export const OutboxPage = lazy(() =>
  import('@/features/marketplace/pages/admin/OutboxPage').then((m) => ({ default: m.OutboxPage })),
)
export const CategoriesPage = lazy(() =>
  import('@/features/marketplace/pages/admin/CategoriesPage').then((m) => ({
    default: m.CategoriesPage,
  })),
)
export const PrivacyPage = lazy(() =>
  import('@/features/core/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
)
export const HelpCenterPage = lazy(() =>
  import('@/features/marketplace/pages/HelpCenterPage').then((m) => ({
    default: m.HelpCenterPage,
  })),
)
export const GuestSectionPage = lazy(() =>
  import('@/features/marketplace/pages/GuestSectionPage').then((m) => ({
    default: m.GuestSectionPage,
  })),
)
export const GuestStudentSellersPage = lazy(() =>
  import('@/features/marketplace/pages/GuestStudentSellersPage').then((m) => ({
    default: m.GuestStudentSellersPage,
  })),
)
export const GuestOfficialStorePage = lazy(() =>
  import('@/features/marketplace/pages/GuestOfficialStorePage').then((m) => ({
    default: m.GuestOfficialStorePage,
  })),
)

// Administration: staff-only screens, never part of a student's first load.
export const ModerationPage = lazy(() =>
  import('@/features/marketplace/pages/admin/ModerationPage').then((m) => ({
    default: m.ModerationPage,
  })),
)
export const UsersAuditPage = lazy(() =>
  import('@/features/marketplace/pages/admin/UsersAuditPage').then((m) => ({
    default: m.UsersAuditPage,
  })),
)
export const StoreOrdersPage = lazy(() =>
  import('@/features/marketplace/pages/admin/StoreOrdersPage').then((m) => ({
    default: m.StoreOrdersPage,
  })),
)
export const StoreInventoryPage = lazy(() =>
  import('@/features/marketplace/pages/admin/StoreInventoryPage').then((m) => ({
    default: m.StoreInventoryPage,
  })),
)
export const TransactionsPage = lazy(() =>
  import('@/features/marketplace/pages/admin/TransactionsPage').then((m) => ({
    default: m.TransactionsPage,
  })),
)
export const ForumReportsPage = lazy(() =>
  import('@/features/marketplace/pages/admin/ForumReportsPage').then((m) => ({
    default: m.ForumReportsPage,
  })),
)
export const ScreeningRulesPage = lazy(() =>
  import('@/features/marketplace/pages/admin/ScreeningRulesPage').then((m) => ({
    default: m.ScreeningRulesPage,
  })),
)
export const MessageReportsPage = lazy(() =>
  import('@/features/marketplace/pages/admin/MessageReportsPage').then((m) => ({
    default: m.MessageReportsPage,
  })),
)
export const AppealsPage = lazy(() =>
  import('@/features/marketplace/pages/admin/AppealsPage').then((m) => ({
    default: m.AppealsPage,
  })),
)
export const ReportPage = lazy(() =>
  import('@/features/marketplace/pages/ReportPage').then((m) => ({
    default: m.ReportPage,
  })),
)
export const AppealPage = lazy(() =>
  import('@/features/marketplace/pages/AppealPage').then((m) => ({
    default: m.AppealPage,
  })),
)
export const StaffToolsPage = lazy(() =>
  import('@/features/marketplace/pages/admin/StaffToolsPage').then((m) => ({
    default: m.StaffToolsPage,
  })),
)

export const LandingPage = lazy(() =>
  import('@/features/core/pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)
export const NotFoundPage = lazy(() =>
  import('@/features/core/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
export const LoginPage = lazy(() =>
  import('@/features/authentication/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
export const VerifyPage = lazy(() =>
  import('@/features/authentication/pages/VerifyPage').then((m) => ({ default: m.VerifyPage })),
)
export const ForgotPasswordPage = lazy(() =>
  import('@/features/authentication/pages/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
)
