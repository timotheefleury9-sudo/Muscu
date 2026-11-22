import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach } from 'vitest'
import App from './App'
import { db } from './data/db'
import { seedIfEmpty } from './data/seed'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedIfEmpty()
})

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('affiche les 4 onglets', () => {
    renderApp()
    const nav = screen.getByRole('navigation')
    for (const label of ['Séance', 'Programmes', 'Progression', 'Réglages']) {
      expect(nav).toHaveTextContent(label)
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('affiche la page Séance par défaut (séance proposée)', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
  })

  it('un clic sur Progression affiche la page correspondante', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 1, name: 'Push' })
    await userEvent.click(screen.getByRole('link', { name: 'Progression' }))
    expect(screen.getByRole('heading', { name: 'Progression' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Push' })).not.toBeInTheDocument()
  })
})
