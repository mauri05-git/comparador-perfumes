// Búsqueda que tolera errores de tipeo ("savage dior", "versache eroz"). La usan el backend, para corregir la
// consulta antes de ir a las tiendas, y el frontend, para filtrar el catálogo y la lista de perfumes guardados.
import { sinTildes } from './alergenos.ts';

const palabras = (t: string) => sinTildes(t.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);

// Distancia de edición entre dos palabras; un cambio de orden de dos letras vecinas ("erso") cuenta como un error
export function distancia(a: string, b: string): number {
  let anterior2: number[] = [];
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(anterior[j] + 1, fila[j - 1] + 1, anterior[j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) fila[j] = Math.min(fila[j], anterior2[j - 2] + 1);
    }
    [anterior2, anterior] = [anterior, fila];
  }
  return anterior[b.length];
}

// Errores que se perdonan según el largo: una palabra corta casi no admite cambios
const tolerancia = (p: string) => (p.length <= 3 ? 0 : p.length <= 6 ? 1 : 2);

// Errores entre lo escrito y una palabra real, o Infinity si no se parecen lo suficiente
function errores(escrita: string, real: string): number {
  if (escrita === real) return 0;
  const d = distancia(escrita, real);
  return d <= Math.min(tolerancia(escrita), tolerancia(real)) ? d : Infinity;
}

// ¿El texto contiene todas las palabras de la consulta? Cada una puede venir incompleta (se está escribiendo) o con errores
export function coincideFlexible(texto: string, consulta: string): boolean {
  const ts = palabras(texto);
  return palabras(consulta).every((q) => ts.some((t) => t.startsWith(q) || errores(q, t) < Infinity));
}

// Palabras que no distinguen un perfume de otro: no se corrigen ni se exigen
const GENERICAS = new Set([
  'perfume', 'perfumes', 'colonia', 'cologne', 'fragancia', 'eau', 'de', 'di', 'du', 'la', 'le', 'el', 'parfum', 'toilette',
  'edp', 'edt', 'edc', 'hombre', 'mujer', 'unisex', 'men', 'man', 'women', 'woman', 'pour', 'homme', 'femme', 'for', 'ml', 'set',
]);

const NUMEROS: Record<string, string> = { one: '1', uno: '1', two: '2', dos: '2' };
const propias = (t: string) =>
  palabras(t).map((p) => NUMEROS[p] ?? p).filter((p) => (p.length > 2 || /^\d+$/.test(p)) && !GENERICAS.has(p));

// ¿El nombre oficial que entregó la IA es de otro perfume que el buscado? Lo es cuando a cada lado sobra una palabra
// propia ("power of you" contra "Stronger With You"): la IA no conocía el perfume y puso uno parecido de la marca.
// Que sobre solo a un lado es normal: "sauvage" contra "Sauvage Eau de Toilette", o el título largo de una tienda.
export function nombresDistintos(consulta: string, nombreOficial: string, marca = ''): boolean {
  const q = propias(consulta);
  const marcaPs = propias(marca);
  const n = propias(nombreOficial).filter((p) => !marcaPs.includes(p));
  const sobra = (as: string[], bs: string[]) => as.some((a) => !bs.some((b) => errores(a, b) < Infinity));
  return sobra(q, [...n, ...marcaPs]) && sobra(n, q);
}

// Corrige la consulta contra los perfumes conocidos ("marca nombre"). Solo propone un cambio si TODAS las palabras
// calzan con un mismo perfume conocido; si no, devuelve null y la consulta se busca tal cual (puede ser un perfume nuevo).
export function corregirBusqueda(consulta: string, conocidos: string[]): string | null {
  const qs = palabras(consulta).filter((p) => !GENERICAS.has(p) && !/^\d+$/.test(p));
  if (qs.length === 0) return null;
  let mejor: { costo: number; cambios: Map<string, string> } | null = null;
  for (const conocido of conocidos) {
    const ns = palabras(conocido);
    const cambios = new Map<string, string>();
    let costo = 0;
    for (const q of qs) {
      let menor = Infinity;
      let real = q;
      for (const n of ns) {
        const e = errores(q, n);
        if (e < menor) [menor, real] = [e, n];
      }
      costo += menor;
      if (costo === Infinity) break;
      if (menor > 0) cambios.set(q, real);
    }
    if (costo === 0) return null; // ya está bien escrita
    if (costo < (mejor?.costo ?? Infinity)) mejor = { costo, cambios };
  }
  if (!mejor) return null;
  const cambios = mejor.cambios;
  return consulta.trim().split(/\s+/).map((p) => cambios.get(palabras(p).join('')) ?? p).join(' ');
}
