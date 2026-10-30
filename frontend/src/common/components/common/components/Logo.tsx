import logoImg from '@/assets/rtu-tindahan-logo.png'
import { navigate } from '@/common/router/router'
import './Logo.css'

/**
 * The RTU Tindahan logo. Clicking it goes to the home page.
 * Its height is set by the parent (e.g. .pub-top .logo-img, .side .logo-img).
 */
export function Logo() {
  return (
    <button
      className="logo"
      type="button"
      aria-label="RTU Tindahan home"
      onClick={() => navigate('')}
    >
      <img className="logo-img" src={logoImg} alt="RTU Tindahan Campus Marketplace" />
    </button>
  )
}
