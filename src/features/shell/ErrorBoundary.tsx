import { Component, type ErrorInfo, type ReactNode } from 'react'
import './shell.css'

export const RELOAD_KEY = 'muscu:chunkReloadAt'
// Un rechargement automatique au plus par fenêtre : évite toute boucle si le bloc reste introuvable.
const RELOAD_WINDOW_MS = 10_000

/** Échec de chargement d'un bloc dynamique (nouvelle version déployée, ancien bloc absent du cache). */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'ChunkLoadError') return true
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(error.message)
}

function tryAutoReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY))
    if (last && Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

interface State { failed: boolean }

/** Filet de sécurité autour des écrans : jamais de page blanche. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && tryAutoReload()) return
    console.error('Erreur d\'affichage', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="page app-error" role="alert">
        <h1>Une erreur est survenue</h1>
        <p>Tes données sont intactes. Recharge l'app pour continuer.</p>
        <button type="button" onClick={() => window.location.reload()}>Recharger</button>
      </section>
    )
  }
}
