import { esMismoPerfume } from "../frontend/src/nombres.ts";
import { alergenosEnTexto, sinTildes } from "../frontend/src/alergenos.ts";
import { esListaResumida, leerIngredientes } from "../frontend/src/ingredientes.ts";

// Identidad de un producto según su URL: dos URLs del mismo producto pueden diferir en parámetros o en el slug.
// En Falabella el id está en /product/{id}/; en el resto basta la URL sin parámetros ni "/" final.
export function claveProducto(url: string | null | undefined): string {
  const u = (url || "").trim().toLowerCase().split(/[?#]/)[0].replace(/\/+$/, "");
  const falabella = u.match(/falabella\.com\/.*\/product\/(\d+)/);
  return falabella ? `falabella:${falabella[1]}` : u;
}

export function mismoProducto(urlA: string | null | undefined, urlB: string | null | undefined): boolean {
  const a = claveProducto(urlA);
  return a !== "" && a === claveProducto(urlB);
}

export interface RegistroPrecio {
  fecha: string;
  tienda: string;
  precio: number;
  ml?: number | null;
  nombre?: string;
  url?: string;
}

// El historial se guarda por búsqueda ("versace eros", "versace eros eau de parfum 50 ml"...), pero un producto es el
// mismo con cualquier búsqueda: se juntan sus registros de todas, para que el historial no dependa de cómo se buscó.
// Mismo producto = misma tienda y mismo nombre, o misma URL y tamaño (igual que el filtro de la ficha).
export function historialDeOfertas(
  mapa: Record<string, RegistroPrecio[]>,
  ofertas: { tienda: string; nombre: string; url?: string; ml: number | null }[],
): RegistroPrecio[] {
  const vistos = new Set<string>();
  const resultado: RegistroPrecio[] = [];
  for (const registros of Object.values(mapa)) {
    for (const r of registros) {
      const esDeOferta = ofertas.some(
        (o) => r.tienda === o.tienda && (r.nombre === o.nombre || (mismoProducto(r.url, o.url) && (r.ml ?? null) === o.ml)),
      );
      if (!esDeOferta) continue;
      // El mismo día puede estar anotado en varias búsquedas: se cuenta una vez
      const porNombre = `${r.fecha}|${r.tienda}|n:${r.nombre}`;
      const porUrl = `${r.fecha}|${r.tienda}|u:${claveProducto(r.url)}|${r.ml ?? ""}`;
      if (vistos.has(porNombre) || (r.url && vistos.has(porUrl))) continue;
      vistos.add(porNombre);
      if (r.url) vistos.add(porUrl);
      resultado.push(r);
    }
  }
  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Alguna tienda vende un producto que es lo buscado y no es el perfume de la ficha
// "Carolina Herrera Bad Boy Elixir" -> "Bad Boy Elixir"
export function sinPalabrasDeMarca(consulta: string, marca: string): string {
  const deMarca = new Set(marca.toLowerCase().split(/\s+/));
  return consulta.split(/\s+/).filter((p) => !deMarca.has(p.toLowerCase())).join(" ");
}

export function otraVersionQueLaBuscada(consulta: string, ficha: any, precios: any[]): boolean {
  const marca = ficha.marca || "";
  const buscado = sinPalabrasDeMarca(consulta, marca);
  if (!buscado) return false;
  return precios.some((p) => esMismoPerfume(buscado, p.nombre, marca) && !esMismoPerfume(ficha.nombre || "", p.nombre, marca));
}

// Ejecuta las tareas una tras otra: las lecturas-escrituras de los JSON (historial y catálogo) no deben
// intercalarse, porque una búsqueda y el refresco diario podrían sobrescribir los cambios del otro.
let cola: Promise<unknown> = Promise.resolve();
export function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => {});
  return resultado;
}

/**
 * Alérgenos (de los 26 de la norma europea) que el fabricante declara en la lista de ingredientes publicada por la tienda.
 * null si el texto no es una lista de ingredientes (algunas tiendas ponen ahí las notas olfativas).
 */
export function alergenosEnIngredientes(texto: string | null | undefined): string[] | null {
  // Misma regla que la ventana de ingredientes: una descripción o una lista de notas no cuenta como lista del envase,
  // y en ese caso conviene volver a estimar por las notas en vez de declarar "sin alérgenos"
  const lectura = leerIngredientes(texto);
  // Una lista resumida ("Alcohol - Parfum - Aqua") no prueba que falten alérgenos: no cuenta como declaración
  if (!lectura || esListaResumida(lectura)) return null;
  return alergenosEnTexto(texto || "");
}

// ─────────────────────────────────────────────
//  Identidad de la fórmula (para reusar la lista del envase entre tamaños y tiendas)
// ─────────────────────────────────────────────
export interface ClaveFormula {
  linea: string; // palabras del nombre sin marca, tamaño ni categoría, ordenadas
  marca: string[];
  concentracion: string;
  // Las tiendas a veces omiten "Pour Homme" y solo ponen la categoría: "Light Blue EDT Hombre" no es "Light Blue EDT Mujer"
  genero: "f" | "m" | null;
}

const NO_ES_EL_PERFUME = /\b(set|estuche|kit|tester|recarga|refill|desodorante|deo|body|locion|lotion|mist|gel|shower|miniatura|mini|travel|coffret|pack|muestra)\b/;
// Las palabras de género sueltas ("Woman", "Mujer") van en `genero`, no en la línea; "Pour Homme" y "For Her" sí son parte del nombre
const RELLENO = new Set([
  "perfume", "perfumes", "fragancia", "mujer", "hombre", "woman", "women", "man", "men", "donna", "uomo", "unisex",
  "spray", "vapo", "vaporizador", "original", "de", "del", "y", "eau", "ml",
]);

/**
 * El mismo perfume en la misma concentración tiene la misma fórmula en cualquier tamaño o tienda.
 * null si no se puede saber con seguridad (sin concentración, sets, recargas, desodorantes o sin nombre de línea).
 */
export function claveFormula(nombre: string | null | undefined, marcasConocidas: Set<string>): ClaveFormula | null {
  let t = sinTildes(nombre || "").replace(/&/g, " ");
  if (NO_ES_EL_PERFUME.test(t)) return null;
  const concentracion =
    /eau de parfum|\bedp\b/.test(t) ? "edp"
    : /eau de toilette|\bedt\b/.test(t) ? "edt"
    : /eau de cologne|\bedc\b|\bcolonia\b|\bcologne\b/.test(t) ? "edc"
    : /\bextrait\b|\bparfum\b/.test(t) ? "parfum"
    : null;
  if (!concentracion) return null;
  const femenino = /\b(mujer|femme|woman|women|donna|her)\b/.test(t);
  const masculino = /\b(hombre|homme|men|man|uomo|him)\b/.test(t);
  const genero = femenino === masculino ? null : femenino ? "f" : "m";
  t = t
    .replace(/eau de (parfum|toilette|cologne)|\b(edp|edt|edc|extrait|parfum|colonia|cologne)\b/g, " ")
    .replace(/\b\d+([.,]\d+)?\s*(ml|oz)\b/g, " ");
  const palabras = [...new Set(t.split(/[^a-z0-9]+/).filter((p) => p && !RELLENO.has(p)))];
  const linea = palabras.filter((p) => !marcasConocidas.has(p)).sort().join(" ");
  if (!linea) return null;
  return { linea, marca: palabras.filter((p) => marcasConocidas.has(p)).sort(), concentracion, genero };
}

// Misma línea y concentración. La marca y el género pueden faltar en un nombre ("Bad Boy EDT"), pero si ambos los traen
// deben coincidir
export function mismaFormula(a: ClaveFormula | null, b: ClaveFormula | null): boolean {
  if (!a || !b || a.linea !== b.linea || a.concentracion !== b.concentracion) return false;
  if (a.genero && b.genero && a.genero !== b.genero) return false;
  return a.marca.length === 0 || b.marca.length === 0 || a.marca.some((m) => b.marca.includes(m));
}

export function palabrasDeMarcas(marcas: (string | null | undefined)[]): Set<string> {
  return new Set(marcas.flatMap((m) => sinTildes(m || "").replace(/&/g, " ").split(/[^a-z0-9]+/).filter((p) => p.length > 1)));
}

// ── Reseñas ──
// La misma reseña se encuentra escriba como se escriba el nombre ("Acqua di Giò EDP" = "acqua di gio edp")
export function claveResena(perfume: string): string {
  return perfume.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 120);
}

// La app agrega la concentración al nombre solo si la oferta a la vista la trae ("Acqua di Giò Pour Homme" en una tienda,
// "... Eau de Toilette" en otra): una reseña escrita con un nombre tiene que verse con el otro.
const CONCENTRACION_AL_FINAL = / (extrait de parfum|eau de (toilette|parfum|cologne)|edt|edp|edc|parfum)$/;
const CONCENTRACION_LARGA: Record<string, string> = { edt: "eau de toilette", edp: "eau de parfum", edc: "eau de cologne" };

function partesDeClave(clave: string): { base: string; concentracion: string | null } {
  const m = clave.match(CONCENTRACION_AL_FINAL);
  if (!m || m.index === 0) return { base: clave, concentracion: null };
  return { base: clave.slice(0, m.index), concentracion: CONCENTRACION_LARGA[m[1]] || m[1] };
}

// Claves guardadas que son el mismo perfume que `clave`: la misma, la que no dice concentración, o (si `clave` no la dice)
// cualquiera de sus concentraciones. Otra versión ("Sauvage Elixir") sigue siendo otro perfume.
export function clavesDelMismoPerfume(clave: string, guardadas: string[]): string[] {
  const buscada = partesDeClave(clave);
  return guardadas.filter((k) => {
    const otra = partesDeClave(k);
    if (otra.base !== buscada.base) return false;
    return !buscada.concentracion || !otra.concentracion || otra.concentracion === buscada.concentracion;
  });
}

export interface DatosResena {
  perfume: string;
  usuario: string;
  rating: number;
  duracion_horas: number;
  comentario: string;
}

// Lo que llega del navegador se revisa entero: tipos, rangos y largos (es texto que verán otras personas)
export function validarResena(body: any): DatosResena | string {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
  const perfume = texto(body?.perfume);
  const usuario = texto(body?.usuario);
  const comentario = typeof body?.comentario === "string" ? body.comentario.trim() : "";
  const rating = Number(body?.rating);
  const duracion = Number(body?.duracion_horas);
  if (!claveResena(perfume) || perfume.length > 160) return "Falta el perfume.";
  if (usuario.length < 2 || usuario.length > 40) return "El apodo debe tener entre 2 y 40 caracteres.";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "La calificación va de 1 a 5.";
  if (!Number.isFinite(duracion) || duracion < 1 || duracion > 24) return "La duración va de 1 a 24 horas.";
  if (comentario.length < 10) return "Escribe al menos 10 caracteres.";
  if (comentario.length > 800) return "La reseña puede tener hasta 800 caracteres.";
  return { perfume, usuario, rating, duracion_horas: Math.round(duracion), comentario };
}

// Ficha en inglés (`ficha.en`): campos de texto que se traducen y validación de lo que devuelve la IA
export const CAMPOS_EN = [
  "familia_olfativa", "acordes_principales", "notas_salida", "notas_corazon", "notas_fondo", "estaciones", "ocasiones",
  "mejor_momento_dia", "sillage", "publico_objetivo", "descripcion", "guia_aplicacion",
] as const;

// Solo lo que calza con el español: listas con la misma cantidad (una nota de más o de menos ya no es la misma
// pirámide) y la guía con sus cuatro partes. Lo que no calza se descarta y se muestra en español.
export function traduccionValida(en: any, ficha: any): any {
  if (!en || typeof en !== "object") return undefined;
  const ok: any = {};
  for (const campo of CAMPOS_EN) {
    const es = ficha[campo];
    const v = en[campo];
    if (v == null || es == null) continue;
    if (Array.isArray(es)) {
      if (Array.isArray(v) && v.length === es.length && v.every((x: any) => typeof x === "string" && x.trim())) ok[campo] = v;
    } else if (campo === "guia_aplicacion") {
      const partes = ["atomizaciones", "consejo_experto", "clima_ideal"];
      if (typeof v === "object" && partes.every((c) => typeof v[c] === "string" && v[c].trim()) &&
        Array.isArray(v.puntos_pulso) && v.puntos_pulso.length === (es.puntos_pulso || []).length) {
        ok[campo] = { atomizaciones: v.atomizaciones, puntos_pulso: v.puntos_pulso, consejo_experto: v.consejo_experto, clima_ideal: v.clima_ideal };
      }
    } else if (typeof es === "string" && es.trim() && typeof v === "string" && v.trim()) {
      ok[campo] = v;
    }
  }
  return Object.keys(ok).length ? ok : undefined;
}
