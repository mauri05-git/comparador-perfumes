// Lectura de la lista de ingredientes del envase (INCI). La etiqueta no trae porcentajes: la ley exige
// ordenarlos de mayor a menor cantidad (bajo 1 % el orden es libre) y declarar los alérgenos sobre 0,001 %.
// Por eso las cantidades son rangos típicos según la concentración, no valores medidos.

import { alergenosEnTexto } from './alergenos.ts';

export type TipoIngrediente = 'solvente' | 'fragancia' | 'agua' | 'alergeno' | 'filtro_uv' | 'colorante' | 'estabilizante' | 'otro';

export interface IngredienteLeido {
  nombre: string;
  tipo: TipoIngrediente;
  funcion: string;
  cantidad: string;
  // Valor central aproximado en %, para dibujar la barra
  aprox: number;
}

// % de concentrado aromático típico de cada concentración
// El orden importa: "Eau de Parfum" también contiene "parfum"
const RANGO_FRAGANCIA: [RegExp, number, number, string][] = [
  [/eau de parfum|\bedp\b/, 15, 20, 'Eau de Parfum'],
  [/eau de toilette|\bedt\b/, 5, 15, 'Eau de Toilette'],
  [/eau de cologne|\bedc\b|colonia|cologne/, 2, 5, 'Eau de Cologne'],
  [/extrait|\bparfum\b|perfume oil|elixir/, 20, 30, 'Parfum'],
];

const FILTRO_UV = /etilhexil|ethylhexyl|metoxidibenzoilmetano|methoxydibenzoylmethane|benzofenona|benzophenone|octocril|octocrylene|metoxicinamato|methoxycinnamate/;
// Los colorantes van con su número CI de 5 dígitos (a veces mal traducido: "En 19140 / Año 5")
const COLORANTE = /\b\d{5}\b|colorante|\b(red|yellow|blue|violet|rojo|amarillo|azul|violeta)\b/;
const ESTABILIZANTE = /\bbht\b|tocopher|tocofer|hidroxitolueno|piperidinol|edta|edetato|citrato|citric|citrico|antioxidante|conservante/;

function normalizar(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function clasificar(n: string): TipoIngrediente {
  // Solo el alcohol etílico es la base; "alcohol bencílico" o "alcohol de anís" son moléculas del aroma
  if (/^(sd )?alcohol( (etilico|denat\w*\.?|desnaturalizado))?( \d+\w*)?$/.test(n) || /denat/.test(n)) return 'solvente';
  if (/^(aqua|agua|water)\b/.test(n)) return 'agua';
  if (/\b(parfum|perfume|fragancia|fragrance|aroma)\b/.test(n)) return 'fragancia';
  if (FILTRO_UV.test(n)) return 'filtro_uv';
  if (alergenosEnTexto(n).length > 0) return 'alergeno';
  if (COLORANTE.test(n)) return 'colorante';
  if (ESTABILIZANTE.test(n)) return 'estabilizante';
  return 'otro';
}

const FUNCION: Record<TipoIngrediente, string> = {
  solvente: 'Base que disuelve y proyecta el aroma',
  fragancia: 'Concentrado aromático del perfumista',
  agua: 'Ajusta la base',
  alergeno: 'Alérgeno del aroma',
  filtro_uv: 'Filtro UV: protege el color y el aroma de la luz',
  colorante: 'Colorante del líquido',
  estabilizante: 'Estabilizante o antioxidante',
  otro: 'Componente aromático o auxiliar',
};

const pct = (n: number) => `${n.toLocaleString('es-CL')} %`;

// Nombres frecuentes en listas de perfume (INCI y su traducción), para separar listas que la tienda publica sin comas
const CONOCIDOS = new Set([
  'alcohol', 'alcohol denat', 'alcohol denat.', 'alcohol desnaturalizado', 'alcohol bencilico', 'alcohol cinamilico', 'alcohol de anis',
  'aqua', 'agua', 'water', 'parfum', 'perfume', 'fragancia', 'fragrance', 'aroma',
  'linalool', 'linalol', 'limonene', 'limoneno', 'geraniol', 'eugenol', 'isoeugenol', 'citral', 'citronellol', 'citronelol', 'farnesol',
  'coumarin', 'cumarina', 'cinnamal', 'cinamal', 'hexyl cinnamal', 'hexil cinamal', 'amyl cinnamal', 'amil cinamal',
  'hydroxycitronellal', 'hidroxicitronelal', 'alpha-isomethyl ionone', 'alfa-isometil ionona', 'benzyl salicylate', 'salicilato de bencilo',
  'benzyl benzoate', 'benzoato de bencilo', 'benzyl cinnamate', 'cinamato de bencilo', 'benzyl alcohol', 'cinnamyl alcohol', 'anise alcohol',
  'butylphenyl methylpropional', 'butilfenil metilpropional', 'evernia prunastri extract', 'extracto de evernia prunastri',
  'ethylhexyl salicylate', 'salicilato de etilhexilo', 'butyl methoxydibenzoylmethane', 'butil metoxidibenzoilmetano',
  'ethylhexyl methoxycinnamate', 'metoxicinamato de etilhexilo', 'octocrylene', 'octocrileno', 'benzophenone-3', 'benzofenona-3',
  'bht', 'tocopherol', 'tocoferol', 'disodium edta', 'edta disodico', 'methyl anthranilate', 'antranilato de metilo',
]);

function separarSinComas(texto: string): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const norm = palabras.map(normalizar);
  // Largo (en palabras) del ingrediente conocido que empieza en i, prefiriendo el más largo ("alcohol cinamilico" antes que "alcohol")
  const coincidencia = (i: number) => {
    if (norm[i] === 'ci' && /^\d{5}/.test(norm[i + 1] || '')) return 2;
    for (let largo = 4; largo >= 1; largo--) if (CONOCIDOS.has(norm.slice(i, i + largo).join(' '))) return largo;
    return 0;
  };
  const items: string[] = [];
  let desconocido: string[] = [];
  let sinReconocer = 0;
  let i = 0;
  while (i < palabras.length) {
    const largo = coincidencia(i);
    if (!largo) { desconocido.push(palabras[i++]); sinReconocer++; continue; }
    if (desconocido.length) { items.push(desconocido.join(' ')); desconocido = []; }
    let nombre = palabras.slice(i, i + largo).join(' ');
    i += largo;
    // "Aqua / Agua", "Perfume / Fragancia": el nombre INCI y su traducción son un solo ingrediente
    while (palabras[i] === '/' && i + 1 < palabras.length) {
      const otro = coincidencia(i + 1) || 1;
      nombre += ' / ' + palabras.slice(i + 1, i + 1 + otro).join(' ');
      i += 1 + otro;
    }
    items.push(nombre);
  }
  if (desconocido.length) items.push(desconocido.join(' '));
  // Una descripción libre ("alcohol agua fragancia aceites esenciales bergamota...") deja muchas palabras sin reconocer
  return sinReconocer > palabras.length / 4 ? [] : items;
}

/**
 * Lista resumida por la tienda: solo alcohol, aroma y agua ("Alcohol - Parfum - Aqua"). El envase real casi siempre declara
 * alérgenos (Light Blue declara limonene, linalool y citral), así que no sirve para decir que un alérgeno no está.
 */
export function esListaResumida(lectura: { items: IngredienteLeido[] }): boolean {
  return lectura.items.every((i) => i.tipo === 'solvente' || i.tipo === 'fragancia' || i.tipo === 'agua');
}

/**
 * Separa la lista del envase y estima cuánto lleva de cada ingrediente.
 * null si el texto no es una lista de ingredientes (algunas tiendas ponen ahí una descripción).
 */
export function leerIngredientes(texto: string | null | undefined, concentracion?: string | null): { items: IngredienteLeido[]; concentracion: string | null } | null {
  // Algunas tiendas anteponen el nombre del producto entre asteriscos: "*** Bad Boy Eau De Toilette *** Alcohol Denat, ..."
  const limpio = (texto || '').replace(/\*{2,}[^*]*\*{2,}/g, ' ').trim();
  let partes = limpio
    .split(/\s*(?:[,•;·\n]|\s-\s)\s*/)
    .map((p) => p.replace(/[.'"]+$/, '').trim())
    .filter((p) => p.length > 1);
  if (partes.length < 3) partes = separarSinComas(limpio);
  // Base, aroma y agua van una sola vez al inicio; si se repiten más abajo es un error de la tienda y no se les da su rango
  const vistos = new Set<TipoIngrediente>();
  const tipos = partes.map((p) => {
    const t = clasificar(normalizar(p));
    if (t !== 'solvente' && t !== 'fragancia' && t !== 'agua') return t;
    if (vistos.has(t)) return 'otro';
    vistos.add(t);
    return t;
  });
  if (partes.length < 3 || !tipos.some((t) => t === 'solvente' || t === 'agua')) return null;

  const c = normalizar(concentracion || '');
  const rango = RANGO_FRAGANCIA.find(([re]) => re.test(c));
  const [fMin, fMax] = rango ? [rango[1], rango[2]] : [2, 30];
  const hayAgua = tipos.includes('agua');
  const [aMin, aMax] = hayAgua ? [1, 10] : [0, 0];

  const items = partes.map((nombre, i): IngredienteLeido => {
    const tipo = tipos[i];
    let min = 0, max = 1, cantidad = 'menos de 1 %';
    if (tipo === 'solvente') { min = 100 - fMax - aMax; max = 100 - fMin - aMin; cantidad = `≈ ${min}–${pct(max)}`; }
    else if (tipo === 'fragancia') { min = fMin; max = fMax; cantidad = `≈ ${min}–${pct(max)}`; }
    else if (tipo === 'agua') { min = aMin; max = aMax; cantidad = `≈ ${min}–${pct(max)}`; }
    else if (tipo === 'alergeno') cantidad = 'trazas (< 1 %)';
    return { nombre, tipo, funcion: FUNCION[tipo], cantidad, aprox: (min + max) / 2 };
  });
  return { items, concentracion: rango ? rango[3] : null };
}
