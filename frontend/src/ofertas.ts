// Funciones sobre ofertas y fichas: tamaño, precio por ml, concentración, si dos ofertas son el mismo producto,
// qué ficha le corresponde a una oferta, radar y distancia a un local.
import { type DatosRadar } from './components/RadarOlfativoChart';
import { type FraganciaCatalogoItem } from './components/CatalogoFiltrosSidebar';
import { esMismoPerfume, nombreSegunOferta } from './nombres';
import { t } from './i18n.ts';
import { type FichaFragancia, type PrecioMercado } from './tipos.ts';

// ─────────────────────────────────────────────
//  Helpers de Formato, ML, Radar y Clasificación
// ─────────────────────────────────────────────
export function normalizarImagen(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/perfumes/")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

export function extraerMl(nombre: string): number | null {
  if (!nombre) return null;
  const match = nombre.match(/\b(\d{1,3})\s*(?:ml|m\b)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 5 && val <= 500) return val;
  }
  return null;
}

// Veredicto de precio entre dos frascos: mismo tamaño compara el total; tamaños distintos comparan el precio
// por ml; si falta un tamaño no se declara ganador (comparar 50 ml contra 100 ml por total era engañoso)
export function compararPrecios(
  precioA: number | null,
  mlA: number | null,
  precioB: number | null,
  mlB: number | null
): { ganador: 'p1' | 'p2' | 'empate' | 'sin_datos'; criterio: 'total' | 'ml' | null; porcentaje: number; diferencia: number } {
  if (!precioA || !precioB) return { ganador: 'sin_datos', criterio: null, porcentaje: 0, diferencia: 0 };
  let a: number;
  let b: number;
  let criterio: 'total' | 'ml';
  if (mlA && mlB && mlA === mlB) {
    a = precioA; b = precioB; criterio = 'total';
  } else if (mlA && mlB) {
    a = precioA / mlA; b = precioB / mlB; criterio = 'ml';
  } else {
    return { ganador: 'sin_datos', criterio: null, porcentaje: 0, diferencia: 0 };
  }
  if (a === b) return { ganador: 'empate', criterio, porcentaje: 0, diferencia: 0 };
  const [menor, mayor] = a < b ? [a, b] : [b, a];
  return {
    ganador: a < b ? 'p1' : 'p2',
    criterio,
    porcentaje: Math.round(((mayor - menor) / mayor) * 100),
    diferencia: Math.round(mayor - menor),
  };
}

// Mismo producto según su URL (en Falabella, el id de /product/{id}); igual que mismoProducto() del backend
export function mismoProductoUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  const clave = (url: string | null | undefined) => {
    const u = (url || '').trim().toLowerCase().split(/[?#]/)[0].replace(/\/+$/, '');
    const falabella = u.match(/falabella\.com\/.*\/product\/(\d+)/);
    return falabella ? `falabella:${falabella[1]}` : u;
  };
  const ca = clave(a);
  return ca !== '' && ca === clave(b);
}

// La misma oferta: mismo producto de la tienda y mismo tamaño (en Falabella el 50 ml y el 100 ml comparten producto)
export function mismaOferta(a: PrecioMercado, b: PrecioMercado): boolean {
  const mlA = mlDeOferta(a);
  const mlB = mlDeOferta(b);
  return mismoProductoUrl(a.url, b.url) && (!mlA || !mlB || mlA === mlB);
}

// Oferta del catálogo para el comparador: solo si se sabe la página del producto (sin ella no hay a cuál volver)
export function ofertaDeCatalogo(item: FraganciaCatalogoItem): PrecioMercado | null {
  if (!item.urlMejorPrecio) return null;
  return {
    tienda: item.tiendaMejorPrecio || '',
    nombre: `${item.marca} ${item.nombre}${item.ml ? ` ${item.ml}ml` : ''}`,
    precio: item.precioReferencia,
    moneda: 'CLP',
    stock: 'Sin verificar',
    url: item.urlMejorPrecio,
    imagen: item.imagen ?? null,
  };
}

// Oferta conocida solo por su URL (la de un link compartido): sirve para elegirla, no para mostrarla
export function ofertaSoloUrl(url: string): PrecioMercado {
  return { tienda: '', nombre: '', precio: null, moneda: 'CLP', stock: 'Sin verificar', url, imagen: null };
}

export function haceCuanto(fechaIso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(fechaIso)) / 60000));
  if (min < 60) return min <= 1 ? t('hace un momento') : t('hace {n} minutos', { n: min });
  const horas = Math.round(min / 60);
  if (horas < 24) return horas === 1 ? t('hace una hora') : t('hace {n} horas', { n: horas });
  const dias = Math.round(horas / 24);
  return dias === 1 ? t('ayer') : t('hace {n} días', { n: dias });
}

// Concentración según el nombre que publica la tienda; null si no la indica
export function extraerConcentracion(nombre: string): string | null {
  const n = (nombre || '').toLowerCase();
  if (/\beau de toilette\b|\bedt\b/.test(n)) return 'Eau de Toilette';
  if (/\beau de parfum\b|\bedp\b/.test(n)) return 'Eau de Parfum';
  if (/\beau de cologne\b|\bedc\b|\bcologne\b|\bcolonia\b/.test(n)) return 'Eau de Cologne';
  if (/\bextrait\b|\bparfum\b/.test(n)) return 'Parfum';
  return null;
}

export const PATRON_CONCENTRACION = /\b(extrait de parfum|eau de (toilette|parfum|cologne)|edt|edp|edc|parfum)\b/gi;

// Nombre del perfume de la oferta cuando es otra versión u otro perfume de la búsqueda (sus notas no son las de la ficha)
export function otroPerfumeDeOferta(ficha: FichaFragancia | null | undefined, oferta: PrecioMercado | null | undefined): string | null {
  if (!ficha || esMismoPerfume(ficha.nombre, oferta?.nombre, ficha.marca, ficha.genero)) return null;
  return nombreSegunOferta(ficha.nombre, oferta?.nombre, ficha.marca);
}

// Con la lista de ingredientes de la oferta, los alérgenos son los declarados en el envase, no estimados por las notas.
// Si la oferta es otro perfume, las notas de la ficha no le aplican: solo vale su lista o queda "sin verificar".
export function fichaConAlergenosDeOferta(ficha: FichaFragancia | null | undefined, oferta: PrecioMercado | null | undefined) {
  if (!ficha) return null;
  const otro = otroPerfumeDeOferta(ficha, oferta);
  const base: FichaFragancia = otro
    ? { ...ficha, nombre: otro, notas_salida: [], notas_corazon: [], notas_fondo: [], acordes_principales: [],
        familia_olfativa: '', descripcion: '', alergenos_detectados: [], sin_notas: true }
    : ficha;
  if (!oferta?.alergenosDeclarados) return base;
  const origen = oferta.ingredientesOrigen ? `${oferta.ingredientesOrigen.nombre}, ${oferta.ingredientesOrigen.tienda}` : undefined;
  return { ...base, alergenos_detectados: oferta.alergenosDeclarados, alergenos_fuente: 'ingredientes' as const, alergenos_origen: origen };
}

// Nombre del perfume con la concentración de la oferta elegida (la ficha puede describir otra versión)
export function tituloConConcentracion(nombreBase: string, nombreOferta: string): string {
  const limpio = nombreBase
    .replace(PATRON_CONCENTRACION, '')
    .replace(/\b\d{2,3}\s*ml\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || nombreBase;
  const concentracion = extraerConcentracion(nombreOferta);
  return concentracion ? `${limpio} ${concentracion}` : limpio;
}

// Tamaño de una oferta: del nombre y, si no lo trae, de la URL (las tiendas suelen ponerlo en el slug)
export function mlDeOferta(oferta: { nombre?: string; url?: string } | null | undefined): number | null {
  return extraerMl(oferta?.nombre || '') ?? extraerMl((oferta?.url || '').replace(/[-_/]/g, ' '));
}

export function calcularPrecioPorMl(precio: number | null, ml: number | null): string | null {
  if (!precio || !ml || ml <= 0) return null;
  const porMl = Math.round(precio / ml);
  return `~$${porMl.toLocaleString('es-CL')}/ml`;
}

export function obtenerRadarDeFicha(ficha: FichaFragancia | null | undefined): DatosRadar {
  if (ficha?.radar_olfativo && typeof ficha.radar_olfativo.frescura === 'number') {
    return ficha.radar_olfativo;
  }
  const txt = [
    ficha?.familia_olfativa || '',
    ...(ficha?.acordes_principales || []),
    ...(ficha?.notas_salida || []),
    ...(ficha?.notas_corazon || []),
    ...(ficha?.notas_fondo || []),
  ].join(' ').toLowerCase();

  const count = (words: string[]) => words.reduce((a, w) => (txt.includes(w) ? a + 1 : a), 0);
  const sc = (base: number, n: number) => Math.min(96, Math.max(22, base + n * 18));

  return {
    frescura: sc(30, count(['acuático', 'marino', 'cítrico', 'bergamota', 'limón', 'menta', 'fresco', 'verde'])),
    dulzor: sc(22, count(['vainilla', 'tonka', 'caramelo', 'cacao', 'dulce', 'ámbar', 'almendra', 'miel'])),
    amaderado: sc(28, count(['cedro', 'sándalo', 'vetiver', 'pachulí', 'madera', 'amaderado', 'incienso', 'roble'])),
    especiado: sc(24, count(['pimienta', 'canela', 'cardamomo', 'jengibre', 'especiado', 'tabaco', 'cuero'])),
    floral: sc(25, count(['rosa', 'jazmín', 'lavanda', 'iris', 'neroli', 'floral', 'azahar', 'geranio'])),
    intensidad: ficha?.duracion_horas ? Math.min(96, ficha.duracion_horas * 10) : 72,
  };
}

export function detectarGeneroProducto(nombre: string, generoFicha?: string): 'hombre' | 'mujer' | 'unisex' {
  const n = nombre.toLowerCase();
  if (n.includes('hombre') || n.includes('homme') || n.includes('men') || n.includes('masculin')) return 'hombre';
  if (n.includes('mujer') || n.includes('femme') || n.includes('woman') || n.includes('women') || n.includes('dama') || n.includes('lady')) return 'mujer';
  if (n.includes('unisex')) return 'unisex';
  
  if (generoFicha) {
    const g = generoFicha.toLowerCase();
    if (g.includes('masculin') || g.includes('hombre')) return 'hombre';
    if (g.includes('femenin') || g.includes('mujer')) return 'mujer';
    if (g.includes('unisex')) return 'unisex';
  }
  return 'unisex';
}

export function calcularDistanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
