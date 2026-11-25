// Nombre del perfume para el título de la ficha. La ficha se genera para lo que buscó el usuario ("My Way"), pero la
// oferta abierta puede ser otra versión ("GIORGIO ARMANI MY WAY YLANG WOMAN EDP 30ML") u otro perfume de la búsqueda.

// Palabras que no son parte del nombre: categoría, concentración, género suelto, tamaño y extras de la tienda
const NO_ES_NOMBRE = new Set([
  'perfume', 'perfumes', 'mujer', 'hombre', 'unisex', 'woman', 'women', 'men', 'eau', 'edp', 'edt', 'edc', 'parfum',
  'extrait', 'toilette', 'cologne', 'colonia', 'spray', 'vapo', 'set', 'estuche', 'tester', 'refillable', 'recargable',
  'recarga', 'edicion', 'nuevo', 'envase', 'ml', 'de', 'vaporizador', 'natural', 'original', 'formato', 'unidad',
  'para', 'dama', 'damas', 'caballero', 'caballeros', 'varon', 'fragancia',
]);
const MINUSCULAS = new Set(['de', 'di', 'la', 'le', 'du', 'des', 'of', 'et', 'pour', 'for']);

function palabras(t: string): string[] {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' ').split(/[^a-z0-9']+/).filter(Boolean);
}

const UNIDADES = new Set(['ml', 'mlt', 'oz', 'gr', 'g', 'piezas', 'pieza', 'pzs', 'unidades']);
// Donde termina el nombre en el título de una tienda: lo que sigue es el contenido de un set o un regalo
const CORTE = new Set(['set', 'estuche', 'kit', 'pack', 'cofre', 'regalo', 'piezas', 'pieza']);

// Tamaño ("100ml", "100 ml", "3 piezas"), año de edición o código de la tienda ("v90"). Un número suelto es parte
// del nombre: "1 Million", "212 VIP".
function esTamano(ps: string[], i: number): boolean {
  const p = ps[i];
  return /^\d+([.,]\d+)?(ml|mlt|oz|gr)$/.test(p) || (/^\d+$/.test(p) && UNIDADES.has(ps[i + 1])) || /^(19|20)\d\d$/.test(p) ||
    /^[a-z]{1,2}\d+$/.test(p);
}

function esRelleno(ps: string[], i: number, marca: Set<string>): boolean {
  return NO_ES_NOMBRE.has(ps[i]) || CORTE.has(ps[i]) || marca.has(ps[i]) || esTamano(ps, i);
}

function enTitulo(ps: string[]): string {
  return ps.map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}

const FINAL_DE_GENERO = new Set(['pour', 'homme', 'femme', 'for', 'him', 'her', 'uomo', 'donna']);

// Palabras del nombre oficial que identifican al perfume. La IA suele agregarle la concentración o el género
// ("Sauvage Eau de Toilette", "Acqua di Giò Pour Homme") y las tiendas no los escriben igual: sin quitarlos, ninguna
// oferta calzaba con la ficha y sus notas quedaban ocultas. Si no queda nada ("Pour Homme" de D&G), vale el nombre completo.
function nucleoDelNombre(base: string[]): string[] {
  const sinRelleno = base.filter((p) => !NO_ES_NOMBRE.has(p));
  let fin = sinRelleno.length;
  while (fin > 0 && FINAL_DE_GENERO.has(sinRelleno[fin - 1])) fin--;
  return fin > 0 ? sinRelleno.slice(0, fin) : sinRelleno.length ? sinRelleno : base;
}

export function nombreSegunOferta(nombreFicha: string, nombreOferta: string | null | undefined, marca?: string | null): string {
  if (!nombreOferta) return nombreFicha;
  const marcaPs = new Set(palabras(marca || ''));
  // "de" se ignora al comparar: las tiendas lo agregan o lo quitan ("Bleu Chanel")
  const propias = palabras(nombreFicha);
  const ficha = nucleoDelNombre(propias.filter((p) => !marcaPs.has(p) && p !== 'de'));
  // Después de un "+" viene lo que acompaña al perfume en un set ("+ 150 ml Desodorante")
  // La concentración o el género pueden ir en medio del nombre ("Black Opium EDP Over Red"): no lo cortan. Se quedan
  // el tamaño y las palabras de set, que marcan dónde termina el nombre.
  const util = (p: string) => p !== 'de' && (!NO_ES_NOMBRE.has(p) || UNIDADES.has(p) || CORTE.has(p) || ficha.includes(p));
  const sinSet = nombreOferta.split('+')[0];
  const oferta = palabras(sinSet).filter(util);
  // Falabella escribe "Nombre - MARCA": lo que sigue al guion es la marca, no una palabra de versión
  const finVersion = sinSet.includes(' - ') ? palabras(sinSet.slice(0, sinSet.lastIndexOf(' - '))).filter(util).length : oferta.length;
  // Las tiendas escriben "One Million" y la marca "1 Million": el número en palabras cuenta como el número
  const num = (p: string) => (p === 'one' || p === 'uno' ? '1' : p);
  const inicio = oferta.findIndex((_, i) => ficha.every((p, k) => num(oferta[i + k]) === num(p)));
  if (ficha.length > 0 && inicio >= 0) {
    // Es el perfume de la ficha: se agregan las palabras de versión que vienen justo después ("Ylang", "Intense"),
    // sin contar las que ya son parte del nombre oficial ("Pour Homme")
    const version: string[] = [];
    for (let i = inicio + ficha.length; i < finVersion && !esRelleno(oferta, i, marcaPs); i++) {
      if (!propias.includes(oferta[i])) version.push(oferta[i]);
    }
    // La versión va después del nombre sin el género: "Acqua di Giò Profondo", no "Acqua di Giò Pour Homme Profondo"
    const sinGenero = nombreFicha.replace(/\s+(pour (homme|femme)|for (him|her|men|women))$/i, '');
    return version.length ? `${sinGenero} ${enTitulo(version)}` : nombreFicha;
  }
  // Otro perfume de la búsqueda: su nombre sin marca, categoría ni concentración, hasta el tamaño o el contenido del set
  const limpio: string[] = [];
  for (let i = 0; i < oferta.length; i++) {
    if (limpio.length && (esTamano(oferta, i) || CORTE.has(oferta[i]))) break;
    if (!esRelleno(oferta, i, marcaPs)) limpio.push(oferta[i]);
  }
  return limpio.length ? enTitulo(limpio) : nombreFicha;
}

// Texto de búsqueda para un perfume guardado: la lista guarda el nombre de la tienda
// ("Perfume Hombre Acqua Di Gio EDT 50ml - GIORGIO ARMANI") y la búsqueda funciona mejor con "Giorgio Armani Acqua Di Gio"
export function terminoDeBusqueda(perfume: string, marca?: string | null): string {
  // Solo se limpia un título de tienda (con tamaño, concentración o " - MARCA"): "Bleu de Chanel" ya es un buen término
  const esTituloTienda = /\d\s*ml\b|\b(edp|edt|edc|eau de|parfum)\b| - /i.test(perfume);
  const limpio = (esTituloTienda && nombreSegunOferta('', perfume, marca)) || perfume;
  return marca && !sinTilde(limpio).includes(sinTilde(marca)) ? `${marca} ${limpio}` : limpio;
}

const DE_MUJER =new Set(['mujer', 'woman', 'women', 'femme', 'donna']);
const DE_HOMBRE = new Set(['hombre', 'man', 'men', 'homme', 'uomo', 'varon']);

// La oferta es el perfume de la ficha, sin palabras de versión: "My Way Ylang" es otra fórmula con otras notas
export function esMismoPerfume(
  nombreFicha: string, nombreOferta: string | null | undefined, marca?: string | null, genero?: string | null,
): boolean {
  if (!nombreOferta) return true;
  if (nombreSegunOferta(nombreFicha, nombreOferta, marca) !== nombreFicha) return false;
  const oferta = palabras(nombreOferta);
  // "Bleu de Chanel": la marca es parte del nombre, sin ella "Iris Bleu" de Armani también calzaría
  const marcaEnNombre = palabras(nombreFicha).filter((p) => palabras(marca || '').includes(p));
  if (!marcaEnNombre.every((p) => oferta.includes(p))) return false;
  // Light Blue de mujer y de hombre son perfumes distintos con el mismo nombre
  const g = sinTilde(genero || '');
  const contrario = /femenin|mujer/.test(g) ? DE_HOMBRE : /masculin|hombre/.test(g) ? DE_MUJER : null;
  return !contrario || !oferta.some((p) => contrario.has(p));
}

function sinTilde(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
