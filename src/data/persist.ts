/** Demande au navigateur de ne pas purger les données (Safari peut vider le stockage d'un site peu utilisé). Résultat ignoré. */
export function requestPersistentStorage(): void {
  try {
    const p = navigator.storage?.persist?.()
    void Promise.resolve(p).catch(() => {})
  } catch {
    // API absente ou refusée : sans conséquence.
  }
}
