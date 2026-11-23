import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { deleteSession } from '../../data/repo'
import { sessionSummaries } from '../../domain/sessionLog'
import { ConfirmSheet, SaveError, type ConfirmRequest } from '../programs/parts'
import { BackButton, Chevron, ProgressScreen, type BackState } from '../progress/parts'
import { useAppData } from '../progress/useAppData'
import { EASE, T } from '../session/motion'
import { byMonth, currentMonth, monthLabel, sessionLine } from './labels'
import SwipeRow from './SwipeRow'
import './history.css'

export default function SessionListPage() {
  const data = useAppData()
  const navigate = useNavigate()
  /** Séances supprimées depuis cet écran (la liste n'est pas relue). */
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [saveError, setSaveError] = useState(false)
  const groups = useMemo(
    () => (data ? byMonth(sessionSummaries(data).filter((s) => !removed.has(s.id))) : null),
    [data, removed],
  )
  const back: BackState = { back: 'Toutes mes séances' }

  const askDelete = (id: string) => setConfirm({
    title: 'Supprimer cette séance ?',
    text: 'C\'est définitif.',
    confirm: 'Supprimer',
    onConfirm: () => {
      // Séance et séries en une transaction ; en cas d'échec la ligne reste (refermée).
      deleteSession(id).then(
        () => setRemoved((r) => new Set(r).add(id)),
        (e: unknown) => {
          console.error('Suppression de la séance échouée', e)
          setSaveError(true)
        },
      ).finally(() => setOpenId((o) => (o === id ? null : o)))
    },
  })

  const overlays = (
    <>
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
      <SaveError show={saveError} onDismiss={() => setSaveError(false)} />
    </>
  )

  return (
    <ProgressScreen detail busy={!groups} overlays={overlays}>
      <BackButton fallbackTo={`/progression/calendrier?mois=${currentMonth()}`} fallbackLabel="Calendrier" />
      <h1 className="p-title">Toutes mes séances</h1>
      {groups?.length === 0 && (
        <div className="p-card p-empty">
          <strong>Aucune séance enregistrée</strong>
          <p>Lance ta première séance depuis l'onglet Séance.</p>
        </div>
      )}
      {groups?.map((g) => (
        <section key={g.month} className="p-card" aria-labelledby={`h-m-${g.month}`}>
          <h2 className="p-card-title" id={`h-m-${g.month}`}>{monthLabel(g.month)}</h2>
          <AnimatePresence initial={false}>
            {g.sessions.map((s) => (
              <motion.div
                key={s.id}
                className="h-swipe-item"
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: T, ease: EASE }}
              >
                <SwipeRow
                  actionLabel={`Supprimer : ${sessionLine(s)}`}
                  open={openId === s.id}
                  onOpenChange={s.open ? null : (o) => setOpenId(o ? s.id : null)}
                  onAction={() => askDelete(s.id)}
                  onPress={() => navigate(`/seances/${encodeURIComponent(s.id)}`, { state: back })}
                >
                  <span className="p-ex-main h-session-line">{sessionLine(s)}</span>
                  {s.open && <span className="p-tag">En cours</span>}
                  <Chevron />
                </SwipeRow>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      ))}
    </ProgressScreen>
  )
}
