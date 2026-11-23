import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import ErrorBoundary, { RELOAD_KEY } from './ErrorBoundary'

function Boom({ error }: { error: Error }): never {
  throw error
}

let reload: ReturnType<typeof vi.fn>
const realLocation = window.location
// React (dev) relance l'erreur capturée en événement « error » ; jsdom l'afficherait sinon.
const swallow = (e: ErrorEvent) => e.preventDefault()

beforeEach(() => {
  sessionStorage.clear()
  reload = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } })
  // React journalise l'erreur capturée : on la tait pour garder une sortie propre.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  window.addEventListener('error', swallow)
})

afterEach(() => {
  window.removeEventListener('error', swallow)
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('affiche les enfants sans erreur', () => {
    render(<ErrorBoundary><p>ok</p></ErrorBoundary>)
    expect(screen.getByText('ok')).toBeInTheDocument()
  })

  it('erreur quelconque : message et bouton Recharger', async () => {
    render(<ErrorBoundary><Boom error={new Error('bug')} /></ErrorBoundary>)
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Recharger' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it.each([
    'Failed to fetch dynamically imported module: https://x/Muscu/assets/a.js',
    'Importing a module script failed.',
  ])('erreur de chargement de bloc (%s) : un seul rechargement automatique', (message) => {
    const { unmount } = render(<ErrorBoundary><Boom error={new TypeError(message)} /></ErrorBoundary>)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(RELOAD_KEY)).not.toBeNull()
    unmount()
    // Après rechargement, nouvel échec : pas de boucle, on affiche le message.
    render(<ErrorBoundary><Boom error={new TypeError(message)} /></ErrorBoundary>)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument()
  })

  it('ChunkLoadError (par son nom) déclenche aussi le rechargement', () => {
    const e = new Error('Loading chunk 3 failed')
    e.name = 'ChunkLoadError'
    render(<ErrorBoundary><Boom error={e} /></ErrorBoundary>)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
