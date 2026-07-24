import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)

// Dev-only podgląd samego stołu (bez logowania): `?preview=table`.
// Dynamiczny import — w produkcyjnym buildzie ta gałąź wypada razem z modułem.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')) {
  import('./dev/TablePreview').then(({ TablePreview }) => {
    root.render(<StrictMode><TablePreview /></StrictMode>)
  })
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
