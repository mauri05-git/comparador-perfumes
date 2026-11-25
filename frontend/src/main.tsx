import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { urlDelBackend } from './api.ts'

// Las fotos descargadas las sirve el backend local: si la página carga antes de que termine de arrancar, fallan y el
// navegador no las vuelve a pedir. Se reintentan unas veces; una foto que no carga se oculta en vez de mostrar su texto.
window.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  // Desde un celular, la foto guardada con la dirección del notebook se pide al backend por la red
  const enRed = urlDelBackend(img.src);
  if (enRed !== img.src) {
    img.src = enRed;
    return;
  }
  const intentos = Number(img.dataset.reintentos || 0);
  if (img.src.includes(':8000/imagenes/') && intentos < 4) {
    img.dataset.reintentos = String(intentos + 1);
    const original = img.src.split('?')[0];
    setTimeout(() => { img.src = `${original}?reintento=${intentos + 1}`; }, 2500);
    return;
  }
  img.style.visibility = 'hidden';
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
