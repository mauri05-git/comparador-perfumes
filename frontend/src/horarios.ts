// ¿Está abierto un local ahora? Lee los horarios tal como vienen de las tiendas:
// "Lunes a Domingo: 10:00 - 21:00", "Lunes a Viernes: 10:00 - 19:30, Sáb: 10:00 - 15:00",
// "Lunes a Viernes: 08:00 - 21:00 · Sábado: 08:00 - 21:00 · Domingo: 08:00 - 21:00".
// Devuelve null si el horario no se entiende: en ese caso no se afirma nada.
import { sinTildes } from './alergenos.ts';

const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']; // índice = Date.getDay()

function dia(palabra: string): number {
  return DIAS.indexOf(sinTildes(palabra.toLowerCase()).slice(0, 3));
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function abiertoAhora(horario: string, ahora = new Date()): boolean | null {
  const hoy = ahora.getDay();
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  if (/24\s*horas/i.test(horario || '')) return true;
  let entendido = false;
  for (const tramo of (horario || '').split(/[,·•;|]/)) {
    const m = tramo.match(/([a-záéíóú]+)\.?(?:\s+a\s+([a-záéíóú]+)\.?)?\s*:\s*(\d{1,2}:\d{2})(?::\d{2})?\s*[-–a]+\s*(\d{1,2}:\d{2})(?::\d{2})?/i);
    if (!m) {
      if (/cerrado/i.test(tramo)) entendido = true;
      continue;
    }
    const desde = dia(m[1]);
    const hasta = m[2] ? dia(m[2]) : desde;
    if (desde < 0 || hasta < 0) continue;
    entendido = true;
    // "Lunes a Domingo" cruza el fin de la semana (domingo es 0)
    const incluye = desde <= hasta ? hoy >= desde && hoy <= hasta : hoy >= desde || hoy <= hasta;
    if (incluye && minAhora >= minutos(m[3]) && minAhora < minutos(m[4])) return true;
  }
  return entendido ? false : null;
}
