import { Logo } from '@/common/components/Logo'
import { Link } from '@/common/router/router'
import { scrollToSection } from '@/common/utils/scrollToSection'
import { useTindahan } from '@/features/marketplace/context/TindahanContext'
import { Banderitas } from '@/common/components/Banderitas'
import './SiteFooter.css'

interface SiteFooterProps {
  /** 'guest' = public landing page, 'member' = signed-in pages */
  variant: 'guest' | 'member'
}

/** Footer shown at the bottom of every page. Links differ for guests and members. */
export function SiteFooter({ variant }: SiteFooterProps) {
  const guest = variant === 'guest'
  const { openModal } = useTindahan()

  return (
    <footer className={`sitefoot ${guest ? 'sf-guest' : ''}`} aria-label="Site footer">
      <Banderitas variant="corner-left" surface="dark" compact opacity={0.75} />
      <Banderitas variant="corner-right" surface="dark" compact opacity={0.75} />
      <div className="page-content-shell" style={{ position: 'relative', zIndex: 2 }}>
        <div className="sf-grid">
          <div className="sf-brand">
          <div className="row" style={{ gap: 10 }}>
            <Logo />
          </div>
          <p className="small muted">
            A student marketplace for the RTU Pasig Campus. Students buy, sell and offer services,
            then coordinate campus pickup or campus delivery. Payment is settled in person on campus.
          </p>
        </div>

        <nav aria-label="Quick links">
          <h3>Quick links</h3>
          <ul>
            {guest ? (
              <>
                <li>
                  <button
                    type="button"
                    className="flink"
                    onClick={() => scrollToSection('about')}
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="flink"
                    onClick={() => scrollToSection('insights')}
                  >
                    Insights
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="flink"
                    onClick={() => scrollToSection('help')}
                  >
                    Need Help?
                  </button>
                </li>
                <li>
                  <Link className="flink" to="login">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link className="flink" to="register">
                    Create account
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link className="flink" to="marketplace">
                    Marketplace
                  </Link>
                </li>
                <li>
                  <Link className="flink" to="browse">
                    Browse All
                  </Link>
                </li>
                <li>
                  <Link className="flink" to="orders">
                    My Orders
                  </Link>
                </li>
                <li>
                  <Link className="flink" to="create">
                    Sell an item
                  </Link>
                </li>
                <li>
                  <Link className="flink" to="forum">
                    Forum
                  </Link>
                </li>
                <li>
                  <Link className="flink" to="favorites">
                    Favorites
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        <nav aria-label="Help">
          <h3>Help</h3>
          <ul>
            {guest ? (
              <>
                <li>
                  <Link className="flink" to="help">
                    Help Center & User Manual
                  </Link>
                </li>
                <li>
                  <Link className="flink" to="register">
                    Need help verifying?
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="flink"
                    onClick={() => scrollToSection('help')}
                  >
                    Community guidelines
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="flink"
                    onClick={() => scrollToSection('help')}
                  >
                    Prohibited items policy
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link className="flink" to="help">
                    Help Center & User Manual
                  </Link>
                </li>
                <li>
                  <Link className="flink" to="messages">
                    Messages
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="flink"
                    onClick={() => openModal({ kind: 'guidelines' })}
                  >
                    Campus guidelines
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="flink"
                    onClick={() => openModal({ kind: 'policy' })}
                  >
                    Listing policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="flink"
                    onClick={() => openModal({ kind: 'rules' })}
                  >
                    Selling rules
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
      <div className="sf-base tiny muted">
        © {new Date().getFullYear()} RTU Tindahan. A student capstone project for the Pasig Campus
        community.
      </div>
      </div>
    </footer>
  )
}