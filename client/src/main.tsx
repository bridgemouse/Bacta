// client/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'

// Placeholder until App.tsx exists
function Placeholder() {
  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400">Bacta loading...</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>
)
