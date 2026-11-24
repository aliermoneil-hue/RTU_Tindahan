import { useEffect } from 'react'
import { navigate } from '@/common/router/router'
import { useTindahan } from '../context/TindahanContext'

export function ConfirmPage() {
  const { cartStep, setCartStep } = useTindahan()

  useEffect(() => {
    // Old /#/confirm links: if Step 3 is active on Cart, return there;
    // otherwise fall back to orders.
    if (cartStep === 3) {
      setCartStep(1)
      navigate('cart')
    } else {
      navigate('orders')
    }
  }, [cartStep, setCartStep])

  return null
}
