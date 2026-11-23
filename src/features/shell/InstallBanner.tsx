import { useState } from 'react'
import '../settings/settings.css'

const DISMISS_KEY = 'muscu:installBannerDismissed'

function isStandalone(): boolean {
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches === true
  } catch {
    return false
  }
}

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** Invite à installer l'app quand elle tourne dans un navigateur ; fermable pour la session. */
export default function InstallBanner() {
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed())
  if (hidden) return null
  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* sans conséquence */ }
    setHidden(true)
  }
  return (
    <div className="install-banner">
      <span>Installe l'app sur ton écran d'accueil : tes données dans le navigateur sont séparées de celles de l'app installée.</span>
      <button type="button" aria-label="Masquer l'invitation à installer l'app" onClick={dismiss}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
      </button>
    </div>
  )
}
