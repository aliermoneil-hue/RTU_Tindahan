import logoImg from '@/assets/rtu-tindahan-logo.png'
import './Logo.css'

export function Logo() {
  return (
    <button className="logo" type="button" aria-label="RTU Tindahan home">
      <img className="logo-img" src={logoImg} alt="RTU Tindahan" />
    </button>
  )
}
