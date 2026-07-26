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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
