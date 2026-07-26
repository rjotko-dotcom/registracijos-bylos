import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// signal the page is natively dark so mobile browsers' forced-dark modes
// (Chrome Auto Dark, Samsung dark mode) do not re-transform our colors
if (!document.querySelector('meta[name="color-scheme"]')) {
  const meta = document.createElement('meta')
  meta.name = 'color-scheme'
  meta.content = 'dark'
  document.head.appendChild(meta)
}
document.documentElement.style.colorScheme = 'dark'

// offline support for the installed app — only on the real deployment host,
// never inside the claude.ai artifact preview or local dev
if ('serviceWorker' in navigator && location.hostname.endsWith('.github.io')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
