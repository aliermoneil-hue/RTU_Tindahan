import { useState } from 'react'
import { navigate } from '@/common/router/router'
import { Icon } from '@/common/components/Icon'
import { VerifyForm } from '../components/VerifyForm'
import logoImg from '@/assets/logo-removebg-preview.png'
import './VerifyPage.css'

const STEPS = [
  ['Student account', 'Name, RTU email, password'],
  ['Email code', 'Sent to your RTU email'],
  ['All set', 'Start using Tindahan'],
] as const

export function VerifyPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const handleStep3Complete = () => {
    setStep(3)
  }

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      navigate('')
    }
  }

  const side = STEPS.map((s, i) => {
    const n = i + 1
    const done = step > n
    const cur = step === n
    return (
      <div
        key={n}
        className="step-row"
        style={{
          background: cur ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)',
        }}
      >
        <span
          className="avatar"
          style={{
            background: done ? 'var(--green)' : cur ? 'var(--yellow)' : 'rgba(255,255,255,.18)',
          }}
        >
          {done ? <Icon name="check" size="sm" /> : String(n)}
        </span>
        <div>
          <b style={{ fontSize: 13, display: 'block' }}>{s[0]}</b>
          <span className="tiny" style={{ opacity: 0.75 }}>
            {s[1]}
          </span>
        </div>
      </div>
    )
  })

  return (
    <div className="split rev">
      <div className="l">
        <button className="logo" type="button" onClick={goBack}>
          <img className="logo-img" src={logoImg} alt="RTU Tindahan Campus Marketplace" />
        </button>
        <span className="eyebrow">JOIN YOUR CAMPUS</span>
        <h1>Sign up with a code sent to your RTU email.</h1>
        <div className="stack" style={{ gap: 8 }}>{side}</div>
        <div className="note blue">
          <Icon name="lock" />
          <span>
            Only students with an RTU student-number email can join. The code is sent to your RTU
            email only.
          </span>
        </div>
      </div>
      <div className="r">
        <div className="row between" style={{ marginBottom: 14, width: '100%' }}>
          <span className="eyebrow">STEP {step} OF 3</span>
          <span className="pill green">
            <Icon name="lock" size="sm" /> Secure sign up
          </span>
        </div>
        <VerifyForm onStep3Complete={handleStep3Complete} />
      </div>
    </div>
  )
}
