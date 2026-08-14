import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)

// Dev-only podglądy bez logowania: `?preview=table` (sam stół) i `?preview=sidebar`
// (sam panel boczny). Dynamiczny import — w produkcyjnym buildzie ta gałąź wypada
// razem z modułami. Nieznana wartość ląduje na stole, jak dotąd.
const preview = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('preview')
  : null

if (preview !== null) {
  if (preview === 'sidebar') {
    import('./dev/SidebarPreview').then(({ SidebarPreview }) => {
      root.render(<StrictMode><SidebarPreview /></StrictMode>)
    })
  } else {
    import('./dev/TablePreview').then(({ TablePreview }) => {
      root.render(<StrictMode><TablePreview /></StrictMode>)
    })
  }
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
