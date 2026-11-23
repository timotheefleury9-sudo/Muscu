import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useLocation, useNavigationType } from 'react-router-dom'
import { EASE, T } from '../session/motion'
import '../session/session.css'
import './programs.css'

export const IconLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
)
export const Chevron = () => (
  <svg className="prg-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
)
export const IconPlus = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
)
export const IconMinus = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 10h12" /></svg>
)

/** Écran de l'onglet ; l'éditeur entre par la droite, un retour par la gauche. */
export function ProgramsScreen({ detail, busy, overlays, children }: { detail: boolean; busy?: boolean; overlays?: ReactNode; children: ReactNode }) {
  const pop = useNavigationType() === 'POP'
  const first = useLocation().key === 'default'
  const slide = !first && (detail || pop)
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: T, ease: EASE }}>
      <motion.section
        className="page prg"
        aria-busy={busy || undefined}
        initial={slide ? { opacity: 0, x: pop ? -24 : 24 } : false}
        animate={{ opacity: 1, x: 0 }}
      >
        {children}
      </motion.section>
      {/* Hors de la section animée : un ancêtre transformé fausserait le position: fixed. */}
      {overlays}
    </MotionConfig>
  )
}

/** Échec d'écriture : même bandeau que l'écran de séance. */
export function SaveError({ show, onDismiss }: { show: boolean; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="save-error"
          className="save-error"
          role="alert"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: T, ease: EASE }}
        >
          <span>Enregistrement impossible — ta dernière modification n'a pas été sauvegardée</span>
          <button type="button" onClick={onDismiss}>Fermer</button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export interface ConfirmRequest { title: string; text: string; confirm: string; onConfirm: () => void }

/** Feuille de confirmation d'une suppression (jamais window.confirm). */
export function ConfirmSheet({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (request) cancel.current?.focus()
  }, [request])
  return (
    <AnimatePresence>
      {request && (
        <Fragment key="confirm">
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: T, ease: EASE }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ duration: T, ease: EASE }}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
          >
            <h2 id="confirm-title">{request.title}</h2>
            <p>{request.text}</p>
            <button type="button" className="danger-btn" onClick={() => { request.onConfirm(); onClose() }}>{request.confirm}</button>
            <button ref={cancel} type="button" className="secondary-btn" onClick={onClose}>Annuler</button>
          </motion.div>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
