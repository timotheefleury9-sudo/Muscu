import { useEffect, useRef, useState } from 'react'

const PROBES: [string, string][] = [
  ['100vh', '100vh'],
  ['100lvh', '100lvh'],
  ['100dvh', '100dvh'],
  ['100svh', '100svh'],
  ['100%', '100%'],
]

function readValues(probes: HTMLDivElement | null) {
  const out: [string, string][] = []
  out.push(['innerHeight', String(window.innerHeight)])
  out.push(['documentElement.clientHeight', String(document.documentElement.clientHeight)])
  out.push(['visualViewport.height', String(window.visualViewport?.height ?? 'n/a')])
  out.push(['screen.height', String(window.screen.height)])
  out.push(['display-mode standalone', String(window.matchMedia('(display-mode: standalone)').matches)])
  if (probes) {
    for (const [label] of PROBES) {
      const el = probes.querySelector<HTMLElement>(`[data-probe="${label}"]`)
      out.push([`sonde ${label}`, el ? String(el.getBoundingClientRect().height) : 'n/a'])
    }
    for (const side of ['top', 'bottom']) {
      const el = probes.querySelector<HTMLElement>(`[data-inset="${side}"]`)
      out.push([`inset ${side}`, el ? String(el.getBoundingClientRect().height) : 'n/a'])
    }
  }
  const app = document.querySelector('.app')
  out.push(['.app height', app ? String(app.getBoundingClientRect().height) : 'n/a'])
  return out
}

export default function DisplayDiagnostic() {
  const probes = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<[string, string][]>([])
  const [colored, setColored] = useState(false)

  useEffect(() => {
    const update = () => setValues(readValues(probes.current))
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    const app = document.querySelector<HTMLElement>('.app')
    if (colored) {
      document.documentElement.style.background = 'magenta'
      if (app) app.style.background = 'teal'
    } else {
      document.documentElement.style.background = ''
      if (app) app.style.background = ''
    }
    return () => {
      document.documentElement.style.background = ''
      if (app) app.style.background = ''
    }
  }, [colored])

  return (
    <section className="diagnostic">
      <h2>Diagnostic d'affichage</h2>
      <label className="diagnostic-toggle">
        <input type="checkbox" checked={colored} onChange={(e) => setColored(e.target.checked)} />
        Colorer les zones
      </label>
      <pre className="diagnostic-values">
        {values.map(([k, v]) => `${k}: ${v}`).join('\n')}
      </pre>
      <div
        ref={probes}
        aria-hidden="true"
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', top: 0, left: 0, width: 0 }}
      >
        {PROBES.map(([label, h]) => (
          <div key={label} data-probe={label} style={{ height: h, width: 1 }} />
        ))}
        <div data-inset="top" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} />
        <div data-inset="bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </section>
  )
}
