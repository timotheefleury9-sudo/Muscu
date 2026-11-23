import { useEffect, useRef, type ReactNode } from 'react'
import { animate, motion, useDragControls, useMotionValue, useTransform } from 'framer-motion'
import { EASE, T } from '../session/motion'

/** Largeur de l'action « Supprimer » découverte par le glissement. */
const ACTION = 96

interface Props {
  /** Nom accessible de l'action (l'action reste atteignable au lecteur d'écran sans glisser). */
  actionLabel: string
  open: boolean
  /** null : ligne non glissable (séance en cours). */
  onOpenChange: ((open: boolean) => void) | null
  onAction: () => void
  /** Toucher la ligne fermée. */
  onPress: () => void
  children: ReactNode
}

/**
 * Ligne glissable vers la gauche (même geste que la suppression d'une série sur l'écran Séance : glissement
 * horizontal par la ligne, défilement vertical libre) ; au-delà de la moitié de l'action, la ligne reste ouverte
 * sur un bouton rouge « Supprimer ». Flèche gauche / droite au clavier.
 */
export default function SwipeRow({ actionLabel, open, onOpenChange, onAction, onPress, children }: Props) {
  const x = useMotionValue(0)
  const drag = useDragControls()
  const dragged = useRef(false)
  // Fond rouge visible seulement hors repos (pas de liseré sous les coins arrondis).
  const actionOpacity = useTransform(x, (v) => (v < 0 ? 1 : 0))
  const locked = onOpenChange === null

  useEffect(() => {
    void animate(x, open ? -ACTION : 0, { duration: T, ease: EASE })
  }, [open, x])

  return (
    <div className={`h-swipe${open ? ' is-open' : ''}${locked ? ' is-locked' : ''}`}>
      {!locked && (
        <motion.button type="button" className="h-swipe-action" aria-label={actionLabel} style={{ opacity: actionOpacity }} onClick={onAction}>
          Supprimer
        </motion.button>
      )}
      <motion.div
        className="h-swipe-row"
        style={{ x }}
        drag={locked ? false : 'x'}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ left: -ACTION, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        dragMomentum={false}
        onDragStart={() => { dragged.current = true }}
        onDragEnd={(_, info) => {
          window.setTimeout(() => { dragged.current = false }, 300)
          const next = x.get() < -ACTION / 2 || info.velocity.x < -400
          if (next === open) void animate(x, open ? -ACTION : 0, { duration: T, ease: EASE })
          else onOpenChange?.(next)
        }}
      >
        <button
          type="button"
          className="p-ex-row h-session"
          onPointerDown={(e) => { if (!locked) drag.start(e) }}
          onKeyDown={(e) => {
            if (locked) return
            if (e.key === 'ArrowLeft') onOpenChange?.(true)
            else if (e.key === 'ArrowRight' || e.key === 'Escape') onOpenChange?.(false)
          }}
          onClick={() => {
            if (dragged.current) return
            if (open) onOpenChange?.(false)
            else onPress()
          }}
        >
          {children}
        </button>
      </motion.div>
    </div>
  )
}
