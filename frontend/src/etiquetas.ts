// Etiquetas del catálogo (las que usan los filtros). Una sola lista para el backend y el frontend: antes había
// tres copias que buscaban pedazos de palabra en la descripción y en el nombre del perfume, así que "rosa" salía
// de "poderosa", "menta" de "experimenta" y "coco" de "Coco Mademoiselle", y casi todo terminaba con las mismas etiquetas.
import { sinTildes } from './alergenos.ts';

// Cada etiqueta con las notas o acordes que la activan: palabras completas, sin tildes (\w* admite terminaciones)
const NOTAS_POR_ETIQUETA: [string, string][] = [
  ['Chocolate / Cacao', 'chocolate|cacao|pralin\\w*|avellanas?|gianduja'],
  ['Madera (Cedro / Sándalo / Oud)', 'maderas?|amaderad\\w*|cedro|sandalo|oud|vetiver|pachuli|patchouli|guayaco|abedul|cipres|cachemira|cashmeran|palorosa'],
  ['Café / Espresso', 'cafe|espresso|cappuccino|moca'],
  ['Vainilla / Haba Tonka', 'vainilla|avainillad\\w*|tonka|almendras?|benjui'],
  ['Tabaco / Cuero / Incienso', 'tabaco|cuero|gamuza|incienso|humo|ahumad\\w*|mirra|ron|whisky|conac'],
  ['Caramelo / Miel', 'caramelo|miel|datil(es)?|toffee|azucar|malvavisco'],
  ['Bergamota / Limón', 'bergamota|limon|lima|pomelo|toronja|mandarina|naranja|citric\\w*|yuzu|neroli|petitgrain'],
  ['Notas Marinas', 'marin\\w*|acuatic\\w*|ozonic\\w*|sal|salad\\w*|algas?|calone'],
  ['Pimienta / Especias', 'pimienta|canela|cardamomo|jengibre|nuez moscada|clavo|azafran|comino|especia\\w*'],
  ['Lavanda / Menta', 'lavanda|lavandin|menta|romero|salvia|albahaca|artemisa|enebro|aromatic\\w*'],
  ['Ámbar / Ambroxan', 'ambar\\w*|ambroxan|almizcl\\w*|musk|labdano'],
  ['Jazmín / Rosa / Iris', 'rosas?|jazmin|iris|azahar|nardos?|tuberosa|peonia|magnolia|violeta|lirio|gardenia|ylang|fresia|flor de naranjo|heliotropo|orquidea|floral\\w*'],
  ['Frutal / Coco / Manzana', 'coco|pina|mango|maracuya|manzana|pera|cereza|durazno|melocoton|frambuesa|grosella\\w*|ciruela|higo|melon|lichi|fresa|frutilla|frutos? rojos?|frutal\\w*|afrutad\\w*|casis'],
];
const ETIQUETAS = NOTAS_POR_ETIQUETA.map(([etiqueta, notas]) => [etiqueta, new RegExp(`\\b(${notas})\\b`)] as const);

// Etiquetas de un perfume a partir de sus notas y acordes (nunca de la descripción ni del nombre)
export function etiquetasDeNotas(notas: string | string[]): string[] {
  const texto = sinTildes((Array.isArray(notas) ? notas.join(' | ') : notas).toLowerCase())
    // la pimienta rosa es una especia y el palo de rosa una madera: ninguna de las dos es la flor
    .replace(/pimienta rosa(da)?/g, 'pimienta')
    .replace(/palo de rosa/g, 'palorosa');
  return ETIQUETAS.filter(([, patron]) => patron.test(texto)).map(([etiqueta]) => etiqueta);
}

// Etiquetas que definen a un perfume aunque sean una sola nota entre varias
const BASTA_UNA_NOTA = new Set(['Chocolate / Cacao', 'Café / Espresso', 'Tabaco / Cuero / Incienso', 'Caramelo / Miel', 'Notas Marinas']);

// Etiquetas de un perfume para los filtros: salen de sus acordes principales (a qué huele sobre todo). Casi todos los
// perfumes llevan algo de bergamota, jazmín, cedro y almizcle, así que etiquetar por cualquier nota dejaba "Madera"
// en 3 de cada 4 y el filtro no separaba nada. Las notas sueltas solo cuentan para las etiquetas de BASTA_UNA_NOTA.
// Sin acordes (ficha armada desde una tienda) se usan todas las notas.
export function etiquetasDePerfume(notas: string[], acordes: string[]): string[] {
  if (!acordes?.length) return etiquetasDeNotas(notas || []);
  const elegidas = new Set([...etiquetasDeNotas(acordes), ...etiquetasDeNotas(notas || []).filter((e) => BASTA_UNA_NOTA.has(e))]);
  return ETIQUETAS.map(([etiqueta]) => etiqueta).filter((e) => elegidas.has(e));
}

const FAMILIAS = [
  ['Cítrico / Acuático', /citric|acuat|marin/],
  ['Dulce / Gourmand', /gourmand|dulce|vainill|cacao|chocolate/],
  ['Fougère / Azul', /fouger|azul/],
  ['Ámbar / Especiado', /especiad|oriental|ambar/],
  ['Floral / Frutal', /floral|frutal|afrutad/],
  ['Amaderado / Aromático', /amader|madera|aromat|cuero|chipre/],
] as const;
export type FamiliaCatalogo = (typeof FAMILIAS)[number][0] | 'Sin clasificar';

// Familia del catálogo para una familia en texto libre ("Amaderado Especiado"): manda la que se nombra primero.
// Si ninguna calza queda "Sin clasificar" (antes todo lo desconocido pasaba a ser "Amaderado").
export function familiaCatalogoDesde(familiaTexto: string): FamiliaCatalogo {
  const f = sinTildes((familiaTexto || '').toLowerCase());
  let mejor: FamiliaCatalogo = 'Sin clasificar';
  let posicion = Infinity;
  for (const [familia, patron] of FAMILIAS) {
    const i = f.search(patron);
    if (i >= 0 && i < posicion) [mejor, posicion] = [familia, i];
  }
  return mejor;
}

const OCASIONES = [
  ['Oficina & Diario', /trabajo|oficina|diari|casual/],
  ['Noche & Fiesta', /noche|fiesta|club/],
  ['Citas Románticas', /cita|romant/],
  ['Deporte & Calor', /deporte|gimnasio|playa|calor|aire libre/],
  ['Eventos Formales', /formal|gala|evento|ceremonia|boda/],
] as const;
export type OcasionCatalogo = (typeof OCASIONES)[number][0];

// Ocasiones del catálogo para las que entrega la ficha ("Casual", "Citas", "Noche"...): pueden ser varias
export function ocasionesCatalogoDesde(ocasiones: string[]): OcasionCatalogo[] {
  const texto = sinTildes((ocasiones || []).join(' | ').toLowerCase());
  return OCASIONES.filter(([, patron]) => patron.test(texto)).map(([ocasion]) => ocasion);
}
