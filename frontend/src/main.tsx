import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { api, modoDemo } from './api/cliente'
import './estilos.css'
import { AreaDeTrabalho } from './paginas/AreaDeTrabalho'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <AreaDeTrabalho api={api} modoDemo={modoDemo} />
  </StrictMode>,
)
