import './Hero.css'
import Icon from './Icon'
import Carousel from './Carousel'
import { authHref } from '../config'

/* The welcome area: one centered column on navy. */
export default function Hero() {
  return (
    <section className="lp-hero">
      <div className="wrap lp-center">
        <span className="lp-counter">Rizal Technological University · Pasig Campus</span>
        <h1>Buy, sell and meet up right on campus.</h1>
        <p className="lp-lead">
          RTU Tindahan is the student marketplace for RTU Pasig. Find food, books, school supplies and student services from
          verified RTU students, then meet on campus to pick up and pay.
        </p>
        <div className="lp-actions">
          <a className="btn yellow lg" href={authHref('create-account')}>
            Create your account
            <Icon name="arrow" small />
          </a>
          <a className="btn ghost lg lp-white" href={authHref('sign-in')}>
            Sign in
          </a>
        </div>
        <ul className="lp-trust" aria-label="Why students trust it">
          <li>
            <Icon name="shield" small />
            Verified RTU accounts only
          </li>
          <li>
            <Icon name="pin" small />
            Campus meetups, no delivery
          </li>
          <li>
            <Icon name="bag" small />
            Pay in person
          </li>
        </ul>
        <div className="lp-visual">
          <Carousel />
        </div>
      </div>
    </section>
  )
}
