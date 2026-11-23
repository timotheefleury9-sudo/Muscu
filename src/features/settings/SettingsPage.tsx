import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { APP_VERSION } from '../../config'
import { exportData, importData, validateBackup } from '../../data/backup'
import { countSessions } from '../../data/repo'
import { ConfirmSheet, type ConfirmRequest } from '../programs/parts'
import { backupFileName, getLastExport, isExportReminderDue, setLastExport } from './exportReminder'
import './settings.css'

type Message = { kind: 'ok' | 'error'; text: string }

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

/** Déclenche le téléchargement ; en mode standalone sur iOS, cela ouvre la feuille d'enregistrement. */
function download(json: string, name: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const loads = new Set<Promise<unknown>>()
/** Attend la fin du comptage des séances (tests). */
export async function pendingSettingsLoad(): Promise<void> {
  while (loads.size > 0) await Promise.allSettled([...loads])
}

export default function SettingsPage() {
  const [lastExport, setLast] = useState(getLastExport)
  const [message, setMessage] = useState<Message | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [busy, setBusy] = useState(false)
  // Nombre de séances : pas de rappel d'export sur une installation neuve. null = en cours de comptage.
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    const p = countSessions()
      .then((n) => { if (alive) setSessionCount(n) })
      .catch((e: unknown) => console.error('Comptage des séances échoué', e))
    loads.add(p)
    void p.finally(() => loads.delete(p))
    return () => { alive = false }
  }, [])

  const onExport = async () => {
    setBusy(true)
    try {
      const now = new Date()
      download(await exportData(), backupFileName(now))
      setLastExport(now)
      setLast(now.toISOString())
      setMessage({ kind: 'ok', text: 'Sauvegarde exportée' })
    } catch {
      setMessage({ kind: 'error', text: "L'export a échoué." })
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de rechoisir le même fichier
    if (!file) return
    setMessage(null)
    let text: string
    try {
      text = await readText(file)
    } catch {
      setMessage({ kind: 'error', text: 'Lecture du fichier impossible.' })
      return
    }
    // Fichier invalide : erreur tout de suite, sans demander de confirmation (importData revalide).
    const check = validateBackup(text)
    if (!check.ok) {
      setMessage({ kind: 'error', text: check.error })
      return
    }
    setConfirm({
      title: 'Remplacer toutes tes données ?',
      text: 'Tes programmes, séances et séries actuels seront remplacés par ceux du fichier. Cette action est irréversible.',
      confirm: 'Remplacer',
      onConfirm: async () => {
        setBusy(true)
        const res = await importData(text)
        setBusy(false)
        setMessage(res.ok ? { kind: 'ok', text: 'Données importées' } : { kind: 'error', text: res.error })
        if (res.ok) setSessionCount(await countSessions().catch(() => null))
      },
    })
  }

  const due = sessionCount !== null && isExportReminderDue(lastExport, new Date(), sessionCount)

  return (
    <>
      <section className="page set" aria-busy={busy || undefined}>
        <h1 className="set-title">Réglages</h1>
        {due && (
          <div className="set-card set-reminder">
            <p>{lastExport ? 'Ta dernière sauvegarde date de plus de 30 jours.' : "Tu n'as pas encore sauvegardé tes données."} Exporte-les pour ne rien perdre.</p>
          </div>
        )}
        <div className="set-card">
          <h2>Sauvegarde</h2>
          <p>Tes données restent sur cet appareil. Exporte-les dans un fichier pour les conserver ou les transférer.</p>
          <div className="set-actions">
            <button type="button" className="set-btn" disabled={busy} onClick={() => void onExport()}>Exporter</button>
            <button type="button" className="set-btn" disabled={busy} onClick={() => input.current?.click()}>Importer</button>
          </div>
          <input ref={input} className="set-file" type="file" accept="application/json,.json" aria-label="Fichier de sauvegarde" tabIndex={-1} onChange={(e) => void onFile(e)} />
          {message && (
            <p className={`set-msg ${message.kind === 'error' ? 'is-error' : 'is-ok'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>
          )}
        </div>
        <p className="build-id">Version {APP_VERSION}</p>
      </section>
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
