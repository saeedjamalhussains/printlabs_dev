import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installConsoleScrubber } from './utils/consoleScrubber'
import { installContentProtection } from './utils/contentProtection'

// Filter noisy third-party console output (Razorpay/Sentry/Sardine/etc.)
// from the production console. Dev keeps everything visible.
installConsoleScrubber()

// Right-click, drag and Ctrl+S deterrents for the artwork. Installed at
// the document level so it covers every route including lazy ones. Read
// the module header before relying on it — it stops the reflex, not a
// determined copy.
installContentProtection()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
