import { useMemo, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import type { IconName } from '@/common/components/icons'
import { navigate } from '@/common/router/router'
import { useAuth } from '@/features/authentication'
import './HelpCenterPage.css'

export interface HelpArticle {
  id: string
  title: string
  summary: string
  steps: string[]
}

export interface HelpSection {
  id: string
  code: string
  title: string
  subtitle: string
  icon: IconName
  requiresAdminConfirmation?: boolean
  articles: HelpArticle[]
}

export interface FaqEntry {
  id: string
  category: string
  q: string
  a: string
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    code: 'A',
    title: 'A. Getting Started',
    subtitle:
      'Learn what RTU Tindahan is, how to verify your campus account, and how to navigate the platform.',
    icon: 'home',
    articles: [
      {
        id: 'what-is-rtu-tindahan',
        title: 'What is RTU Tindahan?',
        summary:
          'RTU Tindahan is the official campus marketplace and service hub for Rizal Technological University (Pasig Campus). It connects verified students, faculty, personnel, and the Business Affairs Office (BAO) Official RTU Store.',
        steps: [
          'Browse Official RTU Store merchandise (blue top border), Student Seller items (yellow top border), and Student Services (red top border).',
          'Coordinate campus pickups or campus deliveries directly with fellow RTU members — there is no off-campus shipping or online checkout fee.',
          'Pay in person only after inspecting the item or receiving the service on campus.',
        ],
      },
      {
        id: 'create-and-verify-account',
        title: 'How to create an account and verify an account',
        summary:
          'Only verified RTU community members can buy, sell, post services, or join the campus forum.',
        steps: [
          'Click Create Account on the top navigation bar or landing page.',
          'Enter your full name, your official @rtu.edu.ph email address, your RTU Student/Employee ID number, and your college or department affiliation.',
          'Complete the verification step so your profile displays the Verified RTU badge.',
          'Sign in with your verified credentials to unlock the Marketplace, Official RTU Store, Request Cart, My Shop, and Messages.',
        ],
      },
      {
        id: 'navigate-website',
        title: 'How to navigate the website & access the marketplace',
        summary:
          'RTU Tindahan organizes tools into four clear sidebar sections: BUY, SELL, COMMUNITY, and ADMIN (for staff).',
        steps: [
          'Use BUY → Marketplace, Browse All, Student Sellers, or Official RTU Store to discover items and services.',
          'Use the top search bar to search by textbook title, uniform size, course code, or seller name.',
          'Use SELL → Sell an item or My shop (or Admin | RTU Shop for administrators) to post listings and manage incoming buyer requests.',
          'Use the top-right icons to open Help Center, Messages (Inbox), Notifications (Bell), Request Cart, and your Profile.',
        ],
      },
    ],
  },
  {
    id: 'buying-products',
    code: 'B',
    title: 'B. Buying Products',
    subtitle:
      'Browse listings, inspect product details, choose Delivery or Pickup, and track your orders.',
    icon: 'cart',
    articles: [
      {
        id: 'browse-and-view-details',
        title: 'How to browse products and view product details',
        summary:
          'Filter by category, subcategory, condition, price range, or seller type to quickly find what you need for class.',
        steps: [
          'Open Marketplace or Browse All and select a category (such as Clothing and Accessories → Uniform, Books and Academic Materials, or RTU Merchandise).',
          'Click any product card to open the Product Detail page.',
          'Inspect all uploaded photos in the gallery, read the item condition and description, and check the seller’s campus rating and available schedule.',
        ],
      },
      {
        id: 'choose-delivery-or-pickup',
        title: 'How to choose Delivery or Pickup & place an order',
        summary:
          'Sellers configure whether their listing supports Pickup only, Delivery only, or Both pickup and delivery.',
        steps: [
          'On the Product Detail page (or inside your Request Cart), check the Fulfillment Method section.',
          'If the seller enabled Pickup only, Pickup is automatically selected. If the seller enabled Delivery only, Delivery is selected. If the seller enabled Both, choose either Pickup or Delivery.',
          'Pick an available date and time window that matches the seller’s selling days and hours, and choose a campus location (or select "Others" to write your specific campus room/spot).',
          'Review your Request Summary, confirm the campus meetup/delivery agreement, and click Send order request.',
        ],
      },
      {
        id: 'view-order-status-and-contact',
        title: 'How to view order status and communicate with sellers',
        summary:
          'Every order request is tracked step-by-step from Request Sent to Completed.',
        steps: [
          'Open BUY → My Orders to view Active, Completed, and Cancelled orders.',
          'Check the Fulfillment badge (Pickup or Delivery) and scheduled campus location and time on each order.',
          'Click Message seller on the Product page, Order Confirmation page, or My Orders page to coordinate directly in your Inbox.',
          'Once you inspect the item and pay in person, click Confirm pickup to complete the order and unlock verified 1–5 star ratings.',
        ],
      },
    ],
  },
  {
    id: 'selling-products',
    code: 'C',
    title: 'C. Selling Products',
    subtitle:
      'Create student listings, upload up to 10 photos, configure fulfillment, and pass admin review.',
    icon: 'tag',
    articles: [
      {
        id: 'create-listing-and-upload-images',
        title: 'How to create a listing & upload up to 10 images',
        summary:
          'Sellers can list textbooks, uniforms, calculators, supplies, and campus essentials with up to 10 photos.',
        steps: [
          'Go to SELL → Sell an item and select Sell a product.',
          'Enter an accurate title, choose the Category and Subcategory (for example, Clothing and Accessories → Uniform), select Condition, and write a clear description (at least 20 characters).',
          'Upload up to 10 photos (displayed as 0/10 Photos up to 10/10 Photos). Use Adjust to crop/zoom without leaving empty space, and use ‹ / › or Make main to arrange the image order. Photo #1 is your primary marketplace cover.',
          'Optionally enable variations (such as Size or Color) with individual stock counts.',
        ],
      },
      {
        id: 'configure-fulfillment-and-submit',
        title: 'How to configure Pickup/Delivery and submit for approval (3–5 working days)',
        summary:
          'Before your listing goes live, choose your fulfillment options and confirm submission in the popup modal.',
        steps: [
          'On Step 2 (Meetup & schedule), choose which fulfillment methods you offer: Pickup only, Delivery only, or Both pickup and delivery.',
          'Select your preferred campus location (or pick "Others" to type your exact spot), hours (7:00 AM – 7:00 PM), and available days.',
          'On Step 3 (Review & submit), confirm that your item follows RTU Tindahan rules and click Submit for approval.',
          'A centered confirmation popup titled "Submit for Approval?" will appear reminding you that administrative review takes an estimated 3–5 working days (estimated review period, not a guaranteed approval time). Click Confirm Submission to submit.',
        ],
      },
      {
        id: 'manage-approved-and-rejected-listings',
        title: 'How to manage listings, rejections, and buyer orders',
        summary:
          'Track views, incoming requests, and administrative feedback from My Shop and Messages.',
        steps: [
          'Open SELL → My shop to see your Overview KPIs, Incoming orders, Listings, and Shop ratings.',
          'In Incoming orders, check whether the buyer selected Pickup or Delivery, then click Accept, Message, or Mark picked up.',
          'If a listing is not approved by an administrator, the rejection reason appears in your Notifications and automatically opens a two-way conversation in your Messages inbox so you can ask questions, edit your listing, and resubmit.',
        ],
      },
    ],
  },
  {
    id: 'services',
    code: 'D',
    title: 'D. Services',
    subtitle:
      'Offer or book student services such as printing, tutoring, ID photos, repairs, and commissions.',
    icon: 'print',
    articles: [
      {
        id: 'create-and-submit-service',
        title: 'How to create a service listing and submit for approval',
        summary:
          'Services are displayed with a red top border so buyers immediately distinguish them from physical products.',
        steps: [
          'Open SELL → Sell an item and switch the listing type to Offer a service.',
          'Provide your Service Name, Type of Service, billing unit (per page, per hour, per session, etc.), rate, and up to 10 sample photos.',
          'On Step 2, select whether your service is fulfilled via Pickup/Meetup only, Campus Delivery only, or Both, along with your location (including "Others") and available days.',
          'On Step 3, review the "Submit for Approval?" confirmation popup (estimated 3–5 working days review period) and confirm submission.',
        ],
      },
      {
        id: 'request-and-schedule-services',
        title: 'How buyers request, schedule, and communicate with service providers',
        summary:
          'Unlike physical items, services must always be scheduled in advance so the provider can prepare.',
        steps: [
          'Open any service listing to view what is included, sample work photos, and the provider’s available days.',
          'Choose your fulfillment method (Pickup or Delivery, depending on what the provider enabled) and click Request service or Add to request cart.',
          'Select an advance date from the provider’s available schedule (same-day booking is disabled for services so providers have preparation time).',
          'Use Contact provider / Messages to share file specifications, tutoring topics, or layout instructions.',
        ],
      },
    ],
  },
  {
    id: 'official-rtu-store',
    code: 'E',
    title: 'E. Official RTU Store',
    subtitle:
      'Browse and request official university uniforms, manuals, and merchandise managed by RTU administrators.',
    icon: 'shield',
    articles: [
      {
        id: 'what-is-official-store',
        title: 'What the Official RTU Store is & how to browse official products',
        summary:
          'The Official RTU Store page exclusively displays authentic university merchandise managed and sold by authorized RTU administrators.',
        steps: [
          'Open BUY → Official RTU Store from the sidebar. All Official RTU Store items feature a blue top border and the Official RTU Store badge.',
          'When an administrator publishes a product in Sell an item, it goes live immediately as an Official RTU Store product and is managed under Admin | RTU Shop.',
          'Student-sold pre-loved uniforms are kept separate in the Student Marketplace (Browse All / Student Sellers) so the Official RTU Store only shows administrator-managed university stock.',
        ],
      },
      {
        id: 'official-store-orders-and-pickup',
        title: 'How to place an Official RTU Store order and check ticket status',
        summary:
          'Official RTU Store requests generate a BAO Ticket Reference and Queue Number tracked through a 6-step progress bar.',
        steps: [
          'Select your size or variation on an Official RTU Store item and click Reserve for pickup or Add to request cart.',
          'Submit your request to receive a Ticket Reference (e.g., BAO-2601) and Queue Number (e.g., Q-014).',
          'Open BUY → My Orders to watch your 6-step progress bar: Request Received → Approved → Ready for Pickup → Payment Confirmed → Receipt Issued → Claimed.',
          'Bring your RTU Student ID and exact cash to the Pasig Campus Store window on your assigned pickup date.',
        ],
      },
    ],
  },
  {
    id: 'messaging-and-notifications',
    code: 'F',
    title: 'F. Messaging and Notifications',
    subtitle:
      'Use the Inbox, respond to buyers/sellers/administrators, react to messages, and track alerts.',
    icon: 'msg',
    articles: [
      {
        id: 'how-to-use-inbox',
        title: 'How to use the Inbox to contact buyers, sellers, and administrators',
        summary:
          'The Messages page keeps all your order chats, product inquiries, and administrative listing reviews in one place.',
        steps: [
          'Click the Messages icon in the top bar to open your Inbox.',
          'Each conversation shows a context chip linking to the specific Listing, Service, Order, or Admin Review.',
          'When an administrator rejects a submitted listing, their comment is automatically delivered as a two-way Inbox conversation so you can reply directly to the administrator and clarify what needs to be fixed.',
        ],
      },
      {
        id: 'chat-reactions-and-notifications',
        title: 'How to use chat reactions and how notifications work',
        summary:
          'React to individual messages with quick emojis and stay updated with real-time sound and bell alerts.',
        steps: [
          'Hover over (or tap) any chat message bubble to reveal the reaction button anchored at the bottom corner of the message bubble.',
          'Pick an emoji (👍, ❤️, 😊, 😮, 🙏, 🎉) to add or toggle your reaction without covering the message text.',
          'Click the Bell icon in the top bar to inspect unread notifications for order updates, messages, forum replies, and listing approvals or rejections.',
        ],
      },
    ],
  },
  {
    id: 'rules-and-regulations',
    code: 'G',
    title: 'G. Rules and Regulations',
    subtitle:
      'Campus marketplace standards for accurate listings, genuine photos, respectful conduct, and safety.',
    icon: 'flag',
    requiresAdminConfirmation: true,
    articles: [
      {
        id: 'listing-and-image-standards',
        title: 'Accurate descriptions, genuine images & prohibited listings',
        summary:
          'Every listing must honestly represent the actual item or service being offered on campus.',
        steps: [
          'Accurate Product Descriptions: State the real condition, edition, size, defects, and what is included.',
          'Appropriate & Genuine Product Images: Upload clear, original photos of the actual item (1 to 10 photos). Do not use misleading stock photos or inappropriate imagery.',
          'Prohibited Listings: Prescription or over-the-counter medicines, vaping/tobacco/alcohol products, weapons, exam leakage or academic dishonesty services, counterfeit Official RTU merchandise, and unauthorized event ticket resales are strictly prohibited.',
        ],
      },
      {
        id: 'conduct-and-responsibilities',
        title: 'Proper communication, order commitments & buyer/seller responsibilities',
        summary:
          'RTU Tindahan is built on mutual respect and accountability among members of the RTU community.',
        steps: [
          'Proper Communication & Respectful Interactions: Keep all chat messages, forum posts, and reviews courteous and free from harassment, spam, or discrimination.',
          'Seller Responsibilities: Keep stock counts accurate, honor agreed pickup/delivery windows, and update or pause listings when unavailable.',
          'Buyer Responsibilities & Order Commitments: Show up on time at the agreed campus location, communicate promptly if you need to reschedule, and never place prank or fraudulent reservations.',
          'Proper Use of the Platform: Do not share external payment phishing links or attempt to bypass campus safety rules.',
        ],
      },
    ],
  },
  {
    id: 'violations-and-consequences',
    code: 'H',
    title: 'H. Violations and Consequences',
    subtitle:
      'Administrative enforcement actions for rule violations, rejected listings, and repeat offenses.',
    icon: 'shield',
    requiresAdminConfirmation: true,
    articles: [
      {
        id: 'consequences-of-violations',
        title: 'Possible consequences of violating RTU Tindahan rules',
        summary:
          'To keep the campus marketplace safe and trustworthy, administrators may apply graduated enforcement actions when rules are violated.',
        steps: [
          'Listing Rejection: Submitted products or services that have incomplete descriptions, unclear photos, or policy issues are rejected during review, with feedback sent to your Notifications and Inbox.',
          'Listing Removal: Active listings reported or found to contain prohibited items or misleading information may be removed immediately by staff.',
          'Temporary Account Restrictions & Suspension of Selling Privileges: Repeatedly submitting prohibited items, failing to honor confirmed meetups, or engaging in disrespectful conduct may result in temporary restriction or suspension of selling privileges.',
          'Permanent Account Suspension / Escalation: Severe violations, fraudulent activity, or violations of university conduct codes may result in permanent account suspension and referral to the appropriate RTU office.',
        ],
      },
    ],
  },
]

const FAQ_ITEMS: FaqEntry[] = [
  {
    id: 'faq-1',
    category: 'Selling Products',
    q: 'How long does product or service approval take?',
    a: 'Student product and service submissions are reviewed by RTU administrators before becoming publicly visible. The estimated review period is approximately 3–5 working days (this is an estimated timeframe, not a guaranteed approval time).',
  },
  {
    id: 'faq-2',
    category: 'Selling Products',
    q: 'Why was my listing rejected, and how can I reply to the administrator?',
    a: 'Listings are usually rejected if photos are missing/unclear, the description is incomplete, or the item falls under the prohibited items list. When an administrator rejects your listing, the feedback appears in your Notifications and automatically opens a two-way conversation in your Messages Inbox so you can reply to the administrator, edit your listing in My Shop, and resubmit.',
  },
  {
    id: 'faq-3',
    category: 'Selling Products',
    q: 'How many images can I upload per listing?',
    a: 'You can upload up to 10 images per product or service listing (0/10 Photos up to 10/10 Photos). You can crop/adjust each photo, remove photos, and rearrange their order before submitting. The first image (#1) is used as the primary listing cover.',
  },
  {
    id: 'faq-4',
    category: 'Buying Products',
    q: 'How do I choose between Delivery and Pickup?',
    a: 'Sellers configure which fulfillment methods they offer for each listing: Pickup only, Delivery only, or Both pickup and delivery. On the Product page and in your Request Cart, you can select from the options enabled by the seller. You can also select "Others" under the campus location dropdown to type your specific room or spot.',
  },
  {
    id: 'faq-5',
    category: 'Buying Products',
    q: 'How do I contact a seller or service provider?',
    a: 'Open any product or service page and click the "Message seller" or "Contact provider" button, or message them directly from your Order Confirmation or My Orders page. All conversations appear in your Messages Inbox.',
  },
  {
    id: 'faq-6',
    category: 'Services',
    q: 'Can I book a service for today, or does it need to be scheduled in advance?',
    a: 'Physical products can be ordered for same-day pickup as long as the seller’s daily time window has not yet closed. Services (such as printing, tutoring, or layout work) must always be scheduled in advance from the provider’s available days.',
  },
  {
    id: 'faq-7',
    category: 'Official RTU Store',
    q: 'Where can I find student-sold pre-loved uniforms vs. Official RTU Store uniforms?',
    a: 'The Official RTU Store page exclusively displays brand-new, official university items managed by authorized RTU administrators. Student-sold pre-loved uniforms can be found in the Student Marketplace under Browse All → Clothing and Accessories → Uniform.',
  },
  {
    id: 'faq-8',
    category: 'Messaging & Safety',
    q: 'How do I report a problem or a suspicious listing?',
    a: 'You can message RTU staff via the Official RTU Store inbox in Messages, flag community forum posts using the Report button, or visit the Business Affairs Office / Office of Student Affairs on campus.',
  },
]

const ALL_NAV_KEYS = [...HELP_SECTIONS.map((s) => s.id), 'faq']

export function HelpCenterPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string>('getting-started')
  const [openFaqIds, setOpenFaqIds] = useState<Record<string, boolean>>({
    'faq-1': true,
    'faq-2': true,
  })

  const trimmedQuery = searchQuery.trim().toLowerCase()

  const filteredSections = useMemo(() => {
    if (!trimmedQuery) return HELP_SECTIONS
    return HELP_SECTIONS.map((sec) => {
      const matchingArticles = sec.articles.filter(
        (art) =>
          art.title.toLowerCase().includes(trimmedQuery) ||
          art.summary.toLowerCase().includes(trimmedQuery) ||
          art.steps.some((s) => s.toLowerCase().includes(trimmedQuery)),
      )
      return { ...sec, articles: matchingArticles }
    }).filter((sec) => sec.articles.length > 0)
  }, [trimmedQuery])

  const filteredFaqs = useMemo(() => {
    if (!trimmedQuery) return FAQ_ITEMS
    return FAQ_ITEMS.filter(
      (f) =>
        f.q.toLowerCase().includes(trimmedQuery) ||
        f.a.toLowerCase().includes(trimmedQuery) ||
        f.category.toLowerCase().includes(trimmedQuery),
    )
  }, [trimmedQuery])

  const currentSection =
    HELP_SECTIONS.find((s) => s.id === activeSectionId) || HELP_SECTIONS[0]
  const currentIdx = ALL_NAV_KEYS.indexOf(activeSectionId)
  const prevKey = currentIdx > 0 ? ALL_NAV_KEYS[currentIdx - 1] : null
  const nextKey =
    currentIdx >= 0 && currentIdx < ALL_NAV_KEYS.length - 1
      ? ALL_NAV_KEYS[currentIdx + 1]
      : null

  const labelForNavKey = (key: string) => {
    if (key === 'faq') return 'I. Frequently Asked Questions'
    return HELP_SECTIONS.find((s) => s.id === key)?.title || 'Section'
  }

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="hc-page">
      {/* Breadcrumb navigation */}
      <div className="crumbs">
        <button
          type="button"
          onClick={() => navigate(user ? 'marketplace' : 'landing')}
        >
          {user ? 'Marketplace' : 'Home'}
        </button>{' '}
        / <span>Help Center</span>
        {!trimmedQuery ? (
          <>
            {' '}
            / <span>{labelForNavKey(activeSectionId)}</span>
          </>
        ) : null}
      </div>

      {/* Clean Search Hero */}
      <section className="hc-hero" aria-label="Help Center search">
        <div className="hc-hero-top">
          <span className="hc-hero-eyebrow">
            <Icon name="shield" size="sm" />
            RTU TINDAHAN HELP CENTER & USER MANUAL
          </span>
        </div>
        <h1>How can we help you today?</h1>
        <p>
          Find step-by-step instructions on buying, selling, pickup and delivery options,
          the 3–5 working day review process, and Official RTU Store orders.
        </p>

        <div className="hc-search-wrap" role="search">
          <Icon name="search" size="sm" />
          <input
            type="search"
            placeholder="Search help articles or FAQs (e.g. Delivery or Pickup, 10 photos, 3-5 working days)..."
            aria-label="Search Help Center"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="hc-search-clear"
              onClick={() => setSearchQuery('')}
            >
              Clear
            </button>
          )}
        </div>

        <div className="hc-quick-chips">
          <span className="tiny" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Quick links:
          </span>
          {(
            [
              ['Delivery or Pickup', 'buying-products'],
              ['Upload up to 10 Photos', 'selling-products'],
              ['3–5 Working Days Review', 'selling-products'],
              ['Rejected Listing Inbox Chat', 'messaging-and-notifications'],
              ['Official RTU Store', 'official-rtu-store'],
              ['FAQs', 'faq'],
            ] as const
          ).map(([label, secId]) => (
            <button
              key={label}
              type="button"
              className="hc-quick-chip"
              onClick={() => {
                setSearchQuery('')
                setActiveSectionId(secId)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Main Two-Column Portal Layout */}
      <div className="hc-layout">
        {/* Left Sidebar Category Navigation */}
        <aside className="card hc-sidebar" aria-label="Manual categories">
          <div className="hc-sidebar-head">Categories (A – I)</div>
          {HELP_SECTIONS.map((sec) => {
            const on = !trimmedQuery && activeSectionId === sec.id
            return (
              <button
                key={sec.id}
                type="button"
                className={`hc-nav-btn ${on ? 'on' : ''}`.trim()}
                onClick={() => {
                  setSearchQuery('')
                  setActiveSectionId(sec.id)
                }}
              >
                <span className="hc-nav-ic">
                  <Icon name={sec.icon} size="sm" />
                </span>
                <span className="hc-nav-title">{sec.title}</span>
              </button>
            )
          })}
          <button
            type="button"
            className={`hc-nav-btn ${!trimmedQuery && activeSectionId === 'faq' ? 'on' : ''}`.trim()}
            onClick={() => {
              setSearchQuery('')
              setActiveSectionId('faq')
            }}
          >
            <span className="hc-nav-ic">
              <Icon name="info" size="sm" />
            </span>
            <span className="hc-nav-title">I. Frequently Asked Questions</span>
          </button>

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '10px 0 6px' }} />
          <div className="stack" style={{ padding: '4px 8px', gap: 6 }}>
            <b className="tiny">Need direct assistance?</b>
            <p className="tiny muted" style={{ margin: 0 }}>
              Reach out to RTU staff or the Campus Store through your Messages Inbox.
            </p>
            {user ? (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => navigate('messages')}
              >
                <Icon name="msg" size="sm" />
                Open Messages
              </button>
            ) : (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => navigate('login')}
              >
                Sign in to message staff
              </button>
            )}
          </div>
        </aside>

        {/* Right Article & FAQ Reader */}
        <div className="stack" style={{ gap: 14 }}>
          {trimmedQuery ? (
            <>
              <div className="card row between wrap">
                <div>
                  <b>Search results for “{searchQuery}”</b>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Showing {filteredSections.reduce((a, s) => a + s.articles.length, 0)} guide(s)
                    and {filteredFaqs.length} FAQ(s).
                  </p>
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              </div>

              {filteredSections.map((sec) => (
                <div key={sec.id} className="stack" style={{ gap: 10 }}>
                  <b className="small muted">{sec.title}</b>
                  {sec.articles.map((art) => (
                    <article key={art.id} className="hc-topic-card">
                      <h3>{art.title}</h3>
                      <p className="hc-topic-summary">{art.summary}</p>
                      <ol className="hc-step-list">
                        {art.steps.map((st, idx) => (
                          <li key={idx}>{st}</li>
                        ))}
                      </ol>
                    </article>
                  ))}
                </div>
              ))}

              {filteredFaqs.length > 0 && (
                <div className="stack" style={{ gap: 8 }}>
                  <b className="small muted">Frequently Asked Questions</b>
                  <div className="hc-faq-list">
                    {filteredFaqs.map((faq) => {
                      const isOpen = Boolean(openFaqIds[faq.id])
                      return (
                        <div
                          key={faq.id}
                          className={`hc-faq-item ${isOpen ? 'open' : ''}`.trim()}
                        >
                          <button
                            type="button"
                            className="hc-faq-q"
                            aria-expanded={isOpen}
                            onClick={() => toggleFaq(faq.id)}
                          >
                            <span>
                              <span className="pill" style={{ marginRight: 8 }}>
                                {faq.category}
                              </span>
                              {faq.q}
                            </span>
                            <span className="hc-faq-toggle">{isOpen ? '−' : '+'}</span>
                          </button>
                          {isOpen && <div className="hc-faq-a">{faq.a}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!filteredSections.length && !filteredFaqs.length && (
                <div
                  className="card stack"
                  style={{ alignItems: 'center', padding: 36, textAlign: 'center' }}
                >
                  <b>No matching help articles found</b>
                  <p className="small muted">
                    Try searching for keywords like "pickup", "delivery", "photos", "approval", or
                    "uniform".
                  </p>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setSearchQuery('')}
                  >
                    Reset search
                  </button>
                </div>
              )}
            </>
          ) : activeSectionId === 'faq' ? (
            <>
              <div className="card hc-section-head">
                <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
                  <span className="hc-section-badge">
                    <Icon name="info" />
                  </span>
                  <div>
                    <span className="eyebrow">SECTION I</span>
                    <h2 style={{ fontSize: 19, margin: '2px 0 4px' }}>
                      I. Frequently Asked Questions (FAQ)
                    </h2>
                    <p className="small muted" style={{ margin: 0 }}>
                      Click any question below to expand the answer.
                    </p>
                  </div>
                </div>
              </div>

              <div className="hc-faq-list">
                {FAQ_ITEMS.map((faq) => {
                  const isOpen = Boolean(openFaqIds[faq.id])
                  return (
                    <div
                      key={faq.id}
                      className={`hc-faq-item ${isOpen ? 'open' : ''}`.trim()}
                    >
                      <button
                        type="button"
                        className="hc-faq-q"
                        aria-expanded={isOpen}
                        onClick={() => toggleFaq(faq.id)}
                      >
                        <span>
                          <span className="pill" style={{ marginRight: 8 }}>
                            {faq.category}
                          </span>
                          {faq.q}
                        </span>
                        <span className="hc-faq-toggle">{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && <div className="hc-faq-a">{faq.a}</div>}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="card stack" style={{ gap: 10, padding: '18px 20px' }}>
                <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
                  <span className="hc-section-badge">
                    <Icon name={currentSection.icon} />
                  </span>
                  <div>
                    <span className="eyebrow">SECTION {currentSection.code}</span>
                    <h2 style={{ fontSize: 19, margin: '2px 0 4px' }}>
                      {currentSection.title}
                    </h2>
                    <p className="small muted" style={{ margin: 0 }}>
                      {currentSection.subtitle}
                    </p>
                  </div>
                </div>

                {currentSection.requiresAdminConfirmation && (
                  <div className="note blue">
                    <Icon name="info" size="sm" />
                    <span className="small">
                      <b>Administrative Policy Notice:</b> The operational rules and enforcement
                      consequences outlined below reflect RTU Tindahan’s platform moderation
                      workflow. Specific campus disciplinary policies and sanction durations remain
                      subject to confirmation by authorized RTU administrators.
                    </span>
                  </div>
                )}
              </div>

              {currentSection.articles.map((art) => (
                <article key={art.id} className="hc-topic-card">
                  <h3>{art.title}</h3>
                  <p className="hc-topic-summary">{art.summary}</p>
                  <ol className="hc-step-list">
                    {art.steps.map((st, idx) => (
                      <li key={idx}>{st}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </>
          )}

          {/* Clean Previous / Next Section Pager */}
          {!trimmedQuery && (
            <div className="hc-pager">
              {prevKey ? (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    setActiveSectionId(prevKey)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  ← {labelForNavKey(prevKey)}
                </button>
              ) : (
                <span />
              )}
              {nextKey ? (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    setActiveSectionId(nextKey)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  {labelForNavKey(nextKey)} →
                </button>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
