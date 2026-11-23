import { useEffect, useState } from 'react'
import { loadAll } from '../../data/repo'
import type { AppData } from '../../domain/types'
import { pendingEditorWrites } from '../history/useSessionEditor'

/** Toutes les données, chargées au montage puis à chaque retour au premier plan de la page. */
export function useAppData(): AppData | null {
  const [data, setData] = useState<AppData | null>(null)
  useEffect(() => {
    let alive = true
    const reload = () => {
      if (document.visibilityState === 'hidden') return
      // Une correction de séance passée peut encore s'écrire (retour immédiat depuis le détail) : on l'attend.
      pendingEditorWrites()
        .then(loadAll)
        .then((d) => { if (alive) setData(d) }, (e) => console.error('Chargement des données échoué', e))
    }
    reload()
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', reload)
    return () => {
      alive = false
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', reload)
    }
  }, [])
  return data
}
