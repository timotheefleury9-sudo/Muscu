import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { seedIfEmpty } from './data/seed'
import './styles/theme.css'

async function start() {
  try {
    await seedIfEmpty()
  } catch (e) {
    console.error('Initialisation des données échouée', e)
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

void start()
