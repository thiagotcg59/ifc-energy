import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { api, modoDemo } from './api/cliente'
import './estilos.css'
import { PaginaInicial } from './paginas/PaginaInicial'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <PaginaInicial api={api} modoDemo={modoDemo} />
  </StrictMode>,
)
