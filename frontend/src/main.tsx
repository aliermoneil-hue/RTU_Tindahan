import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode is intentionally omitted: it double-invokes useLayoutEffect,
// which kills GSAP animation contexts before their onComplete callbacks fire,
// leaving the loader stuck on screen.
createRoot(document.getElementById('root')!).render(<App />)




