import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { db } from '../../data/db'
import { exportData } from '../../data/backup'
import { loadAll } from '../../data/repo'
import { seedIfEmpty } from '../../data/seed'
import { APP_VERSION } from '../../config'
import { LAST_EXPORT_KEY } from './exportReminder'
import { pendingSettingsLoad } from './SettingsPage'

const renderSettings = () =>
  render(
    <MemoryRouter initialEntries={['/reglages']}>
      <App />
    </MemoryRouter>,
  )

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await db.delete()
  await db.open()
  await seedIfEmpty()
  URL.createObjectURL = vi.fn(() => 'blob:muscu-test')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function captureDownload() {
  const clicks: { download: string; href: string }[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ download: this.download, href: this.href })
  })
  return clicks
}

const backupFile = (content: string, name = 'sauvegarde.json') => new File([content], name, { type: 'application/json' })
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement

describe('Réglages', () => {
  it('affiche la version', () => {
    renderSettings()
    expect(screen.getByText(`Version ${APP_VERSION}`)).toBeInTheDocument()
  })

  it('Exporter télécharge muscu-sauvegarde-YYYY-MM-DD.json (date locale) et mémorise la date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 5, 23, 59))
    const clicks = captureDownload()
    const user = userEvent.setup()
    renderSettings()
    await user.click(screen.getByRole('button', { name: 'Exporter' }))
    await waitFor(() => expect(clicks).toHaveLength(1))
    expect(clicks[0].download).toBe('muscu-sauvegarde-2026-11-05.json')
    expect(clicks[0].href).toBe('blob:muscu-test')
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
    expect(JSON.parse(await blob.text()).format).toBe('muscu-backup')
    expect(localStorage.getItem(LAST_EXPORT_KEY)).not.toBeNull()
    expect(await screen.findByRole('status')).toHaveTextContent('Sauvegarde exportée')
  })

  it("Importer un fichier valide demande confirmation puis remplace les données", async () => {
    const json = await exportData()
    await db.sessions.clear()
    await db.exercises.update('Barbell_Squat', { name: 'Modifié' })
    const user = userEvent.setup()
    renderSettings()
    await user.upload(fileInput(), backupFile(json))
    const dialog = await screen.findByRole('dialog', { name: 'Remplacer toutes tes données ?' })
    expect((await db.exercises.get('Barbell_Squat'))!.name).toBe('Modifié')
    await user.click(within(dialog).getByRole('button', { name: 'Remplacer' }))
    expect(await screen.findByText('Données importées')).toBeInTheDocument()
    expect((await db.exercises.get('Barbell_Squat'))!.name).not.toBe('Modifié')
  })

  it('Annuler la confirmation ne modifie rien', async () => {
    const json = await exportData()
    await db.exercises.update('Barbell_Squat', { name: 'Modifié' })
    const user = userEvent.setup()
    renderSettings()
    await user.upload(fileInput(), backupFile(json))
    const dialog = await screen.findByRole('dialog', { name: 'Remplacer toutes tes données ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await db.exercises.get('Barbell_Squat'))!.name).toBe('Modifié')
    expect(screen.queryByText('Données importées')).not.toBeInTheDocument()
  })

  it('un fichier invalide affiche l\'erreur directement, sans demander confirmation, et ne modifie rien', async () => {
    const before = await loadAll()
    const user = userEvent.setup()
    renderSettings()
    await user.upload(fileInput(), backupFile('pas du json'))
    expect(await screen.findByRole('alert')).toHaveTextContent("Ce fichier n'est pas un JSON valide.")
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await loadAll()).toEqual(before)
  })

  const addSession = () => db.sessions.add({ id: 'sess', templateId: 'tpl-push', startedAt: new Date().toISOString(), endedAt: new Date().toISOString() })

  it('rappelle de sauvegarder si le dernier export date de plus de 30 jours', async () => {
    await addSession()
    localStorage.setItem(LAST_EXPORT_KEY, new Date(Date.now() - 31 * 86400000).toISOString())
    renderSettings()
    await waitFor(() => expect(document.querySelector('.set-reminder')).toHaveTextContent('Ta dernière sauvegarde date de plus de 30 jours.'))
  })

  it('pas de rappel après un export récent', async () => {
    await addSession()
    localStorage.setItem(LAST_EXPORT_KEY, new Date(Date.now() - 5 * 86400000).toISOString())
    renderSettings()
    await screen.findByRole('button', { name: 'Exporter' })
    await pendingSettingsLoad()
    expect(document.querySelector('.set-reminder')).toBeNull()
  })

  it('pas de rappel sur une installation neuve (aucune séance)', async () => {
    renderSettings()
    await pendingSettingsLoad()
    expect(document.querySelector('.set-reminder')).toBeNull()
  })

  it("le rappel s'affiche aussi sans aucun export, et reste fonctionnel si localStorage échoue", async () => {
    await addSession()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué') })
    renderSettings()
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.set-reminder')).toHaveTextContent("Tu n'as pas encore sauvegardé tes données."))
  })
})

describe('InstallBanner', () => {
  const text = "Installe l'app sur ton écran d'accueil : tes données dans le navigateur sont séparées de celles de l'app installée."
  const stubMatchMedia = (standalone: boolean) =>
    vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: standalone && q.includes('standalone'), media: q, addEventListener() {}, removeEventListener() {} })))

  it('est affichée dans un navigateur', () => {
    stubMatchMedia(false)
    renderSettings()
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('est masquée en mode standalone (display-mode)', () => {
    stubMatchMedia(true)
    renderSettings()
    expect(screen.queryByText(text)).not.toBeInTheDocument()
  })

  it('est masquée si navigator.standalone est vrai (iOS)', () => {
    stubMatchMedia(false)
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    try {
      renderSettings()
      expect(screen.queryByText(text)).not.toBeInTheDocument()
    } finally {
      delete (navigator as unknown as Record<string, unknown>).standalone
    }
  })

  it('se ferme pour la session', async () => {
    stubMatchMedia(false)
    const user = userEvent.setup()
    const { unmount } = renderSettings()
    await user.click(screen.getByRole('button', { name: "Masquer l'invitation à installer l'app" }))
    expect(screen.queryByText(text)).not.toBeInTheDocument()
    unmount()
    renderSettings()
    expect(screen.queryByText(text)).not.toBeInTheDocument()
  })
})
