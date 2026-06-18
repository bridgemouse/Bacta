import '../index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Force Safari to re-fetch the apple-touch-icon on every page load so icon
// changes in Settings take effect when the user re-adds to home screen.
const iconLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null
if (iconLink) iconLink.href = `/apple-touch-icon.png?v=${Date.now()}`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
