// Idiomas de la interfaz. La clave de cada texto es el propio texto en español: `t('Vaciar lista')` devuelve
// "Empty list" en inglés. Si falta una traducción se muestra el español (no se rompe nada) y el test
// tests/traducciones.test.ts avisa cuáles faltan. Para agregar un idioma basta otro diccionario como `en.ts`.
//
// Los valores se pasan aparte para que la frase se traduzca entera: t('Quedan {n} ofertas', { n: 3 }).
// Lo que publican las tiendas (nombres de productos, descripciones) no se traduce: se muestra como lo escriben.

import { EN } from './i18n/en.ts';

export type Idioma = 'es' | 'en';

export const IDIOMAS: { id: Idioma; nombre: string; corto: string }[] = [
  { id: 'es', nombre: 'Español', corto: 'ES' },
  { id: 'en', nombre: 'English', corto: 'EN' },
];

const DICCIONARIOS: Record<Exclude<Idioma, 'es'>, Record<string, string>> = { en: EN };
const CLAVE_GUARDADA = 'perfumescan_idioma';

function idiomaInicial(): Idioma {
  // Fuera del navegador (tests en Node, backend en Deno) siempre español: los tests revisan las frases en español
  if (typeof window === 'undefined') return 'es';
  try {
    const guardado = localStorage.getItem(CLAVE_GUARDADA);
    if (guardado === 'es' || guardado === 'en') return guardado;
  } catch {
    // Sin almacenamiento (ventana privada): se usa el del navegador
  }
  const navegador = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return /^es\b/i.test(navegador) || !navegador ? 'es' : 'en';
}

let actual: Idioma = idiomaInicial();
if (typeof document !== 'undefined') document.documentElement.lang = actual;

export function idioma(): Idioma {
  return actual;
}

export function fijarIdioma(nuevo: Idioma) {
  actual = nuevo;
  try { localStorage.setItem(CLAVE_GUARDADA, nuevo); } catch { /* sin almacenamiento */ }
  if (typeof document !== 'undefined') document.documentElement.lang = nuevo;
}

// Solo para los tests: cambiar el idioma sin tocar el navegador
export function usarIdioma(nuevo: Idioma) {
  actual = nuevo;
}

export function t(es: string, valores?: Record<string, string | number>): string {
  const base = actual === 'es' ? es : DICCIONARIOS[actual][es] ?? es;
  if (!valores) return base;
  return base.replace(/\{(\w+)\}/g, (todo, clave) => (clave in valores ? String(valores[clave]) : todo));
}

// Singular o plural según la cantidad, con la cantidad ya puesta: tn(1, '{n} oferta', '{n} ofertas')
export function tn(n: number, singular: string, plural: string, valores?: Record<string, string | number>): string {
  return t(n === 1 ? singular : plural, { ...valores, n });
}

// Fechas y números con el formato del idioma. Los precios siguen en pesos chilenos con punto de miles en los dos
// idiomas: son precios de tiendas chilenas.
export function localeFechas(): string {
  return actual === 'en' ? 'en-US' : 'es-CL';
}

// Mensajes que manda el backend (errores de la cuenta, de las reseñas, del análisis de fotos): llegan en español,
// que es lo que queda en el registro, y se traducen al mostrarlos. Los que traen un valor se reconocen por su forma.
const MENSAJES_CON_VALORES: [RegExp, string, string[]][] = [
  [/^La búsqueda falló: ([\s\S]*)$/, 'La búsqueda falló: {detalle}', ['detalle']],
  [/^Error interno: ([\s\S]*)$/, 'Error interno: {detalle}', ['detalle']],
  [/^(\d+) fragancias descubiertas con (.*)\.$/, '{n} fragancias descubiertas con {notas}.', ['n', 'notas']],
];

export function tServidor(mensaje: string | null | undefined): string {
  if (!mensaje) return '';
  if (actual === 'es') return mensaje;
  for (const [patron, clave, nombres] of MENSAJES_CON_VALORES) {
    const m = mensaje.match(patron);
    if (m) return t(clave, Object.fromEntries(nombres.map((n, i) => [n, m[i + 1]])));
  }
  return t(mensaje);
}
