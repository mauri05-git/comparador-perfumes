import { Hono } from "https://deno.land/x/hono/mod.ts";
import { cors } from "https://deno.land/x/hono/middleware.ts";
import { BlobServiceClient } from "npm:@azure/storage-blob";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { ALERGENOS_UE, sinTildes } from "../frontend/src/alergenos.ts";
import { etiquetasDePerfume, familiaCatalogoDesde, ocasionesCatalogoDesde } from "../frontend/src/etiquetas.ts";
import { coincideFlexible, corregirBusqueda, nombresDistintos } from "../frontend/src/busquedaFlexible.ts";
import { esMismoPerfume } from "../frontend/src/nombres.ts";
import { leerIngredientes } from "../frontend/src/ingredientes.ts";
import { alergenosEnIngredientes, CAMPOS_EN, traduccionValida, claveFormula, claveResena, clavesDelMismoPerfume, enCola, historialDeOfertas, mismaFormula, mismoProducto, otraVersionQueLaBuscada, palabrasDeMarcas, sinPalabrasDeMarca, validarResena } from "./utilidades.ts";
import { montarRutasCuenta } from "./cuentas.ts";

const app = new Hono();

// Solo la propia aplicación puede usar la API desde un navegador con cookies. Con "*" el navegador descarta la
// cookie de sesión, y además cualquier página podría llamar a la API en nombre del usuario.
const ORIGENES_PERMITIDOS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5180", // copia de pruebas
  ...(Deno.env.get("ORIGENES_PERMITIDOS") || "").split(",").map((o) => o.trim()).filter(Boolean),
]);
// Con PERMITIR_RED_LOCAL=1 también la app abierta desde otro equipo de la misma red (un celular en el Wi-Fi de la
// casa): direcciones privadas 192.168.x.x, 10.x.x.x y 172.16–31.x.x en los puertos de la app. Apagado por defecto.
const RED_LOCAL = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):(5173|5174)$/;
const permitirRedLocal = Deno.env.get("PERMITIR_RED_LOCAL") === "1";
const origenPermitido = (origen: string) => ORIGENES_PERMITIDOS.has(origen) || (permitirRedLocal && RED_LOCAL.test(origen));
app.use("/*", cors({ origin: (origen) => (origenPermitido(origen) ? origen : null), credentials: true }));

const cuentas = await montarRutasCuenta(app, {
  archivoUsuarios: "./usuarios.json",
  archivoDatos: "./datos_usuarios.json",
  archivoClave: "./clave_datos.key",
  origenPermitido,
  alBorrarUsuario: (id) => borrarReviewsDe(id),
});

// ─────────────────────────────────────────────
//  SISTEMA DE LOGS ESTRUCTURADOS Y TELEMETRÍA (Semana 5)
// ─────────────────────────────────────────────
const ARCHIVO_LOGS = "./logs_sistema.json";
const MAX_LOGS = 120;

export interface RegistroLog {
  id: string;
  timestamp: string;
  nivel: "INFO" | "SUCCESS" | "WARN" | "ERROR" | "CACHE";
  modulo: "API" | "SCRAPER" | "IA_GEMINI" | "IA_AZURE" | "CACHE" | "ALERGIAS" | "HISTORIAL";
  mensaje: string;
  duracion_ms?: number;
  detalles?: Record<string, any>;
}

let memoriaLogs: RegistroLog[] = [];
let estadisticasSistema = {
  inicio_servidor: new Date().toISOString(),
  total_busquedas: 0,
  total_comparaciones: 0,
  total_escaneos_foto: 0,
  cache_hits: 0,
  cache_misses: 0,
  llamadas_ia_exitosas: 0,
  errores_ia: 0,
  ultimo_modelo_ia: "N/A",
};

async function inicializarLogs() {
  try {
    const texto = await Deno.readTextFile(ARCHIVO_LOGS);
    const data = JSON.parse(texto);
    if (Array.isArray(data)) {
      memoriaLogs = data.slice(0, MAX_LOGS);
    }
  } catch {
    memoriaLogs = [];
  }
}
await inicializarLogs();

async function registrarLog(
  nivel: RegistroLog["nivel"],
  modulo: RegistroLog["modulo"],
  mensaje: string,
  duracion_ms?: number,
  detalles?: Record<string, any>
) {
  const nuevo: RegistroLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    nivel,
    modulo,
    mensaje,
    duracion_ms,
    detalles,
  };

  memoriaLogs.unshift(nuevo);
  if (memoriaLogs.length > MAX_LOGS) {
    memoriaLogs = memoriaLogs.slice(0, MAX_LOGS);
  }

  const icono =
    nivel === "SUCCESS" ? "✅" :
    nivel === "WARN" ? "⚠️" :
    nivel === "ERROR" ? "❌" :
    nivel === "CACHE" ? "⚡" : "ℹ️";
  const tiempoStr = duracion_ms !== undefined ? ` (${duracion_ms}ms)` : "";
  console.log(`${icono} [${modulo}] ${mensaje}${tiempoStr}`);

  try {
    await Deno.writeTextFile(ARCHIVO_LOGS, JSON.stringify(memoriaLogs, null, 2));
  } catch {
    // Ignorar error de escritura en disco si ocurre concurrencia
  }
}

// ─────────────────────────────────────────────
//  CACHÉ INTELIGENTE EN MEMORIA (TTL 15 Minutos)
// ─────────────────────────────────────────────
interface EntradaCache<T> {
  expira: number;
  datos: T;
}

const TTL_CACHE_MS = 15 * 60 * 1000; // 15 minutos
const cacheBusquedas = new Map<string, EntradaCache<any>>();

function obtenerDeCache(clave: string): any | null {
  const item = cacheBusquedas.get(clave);
  if (!item) return null;
  if (Date.now() > item.expira) {
    cacheBusquedas.delete(clave);
    return null;
  }
  return item.datos;
}

function guardarEnCache(clave: string, datos: any) {
  cacheBusquedas.set(clave, {
    expira: Date.now() + TTL_CACHE_MS,
    datos,
  });
}

// ─────────────────────────────────────────────
//  ÚLTIMO RESULTADO CONOCIDO POR BÚSQUEDA (en disco)
//  Una búsqueda en vivo tarda lo que tardan las tiendas. Con el último resultado guardado, la app muestra al
//  instante lo que se sabía y lo reemplaza a medida que responden las tiendas, avisando qué precios cambiaron.
// ─────────────────────────────────────────────
const ARCHIVO_ULTIMAS = "./ultimas_busquedas.json";
const MAX_EDAD_CONOCIDA_MS = 30 * 24 * 60 * 60 * 1000; // más viejo que un mes ya no sirve de anticipo
interface ResultadoConocido {
  fecha: string;
  precios: any[];
  ficha: any;
  historial: any[];
}
let ultimasBusquedas: Record<string, ResultadoConocido> = {};
try { ultimasBusquedas = JSON.parse(await Deno.readTextFile(ARCHIVO_ULTIMAS)); } catch { /* todavía no hay */ }

function resultadoConocido(consulta: string): ResultadoConocido | null {
  const r = ultimasBusquedas[consulta.toLowerCase().trim()];
  return r && Date.now() - Date.parse(r.fecha) < MAX_EDAD_CONOCIDA_MS ? r : null;
}

function guardarResultadoConocido(consultas: string[], r: Omit<ResultadoConocido, "fecha">) {
  const conocido = { fecha: new Date().toISOString(), ...r };
  for (const c of new Set(consultas.map((x) => x.toLowerCase().trim()))) ultimasBusquedas[c] = conocido;
  return enCola(() => Deno.writeTextFile(ARCHIVO_ULTIMAS, JSON.stringify(ultimasBusquedas)));
}

// ─────────────────────────────────────────────
//  HISTORIAL DE PRECIOS (Persistencia JSON local deduplicada)
// ─────────────────────────────────────────────
const ARCHIVO_HISTORIAL = "./historial_precios.json";

// ─────────────────────────────────────────────
//  IMÁGENES LOCALES (descarga y caché de CDN externas)
// ─────────────────────────────────────────────
const DIRECTORIO_IMAGENES = "./imagenes";
try { await Deno.mkdir(DIRECTORIO_IMAGENES, { recursive: true }); } catch { /* ya existe */ }

async function descargarImagenLocal(url: string, id: string): Promise<string | null> {
  try {
    const urlSinParams = url.split("?")[0];
    const ext = (urlSinParams.split(".").pop() || "jpg").toLowerCase();
    const extValida = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
    const filename = `${id}.${extValida}`;
    const localPath = `${DIRECTORIO_IMAGENES}/${filename}`;
    try {
      await Deno.stat(localPath);
      return `http://localhost:8000/imagenes/${filename}`;
    } catch { /* no cacheada aún */ }
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    await Deno.writeFile(localPath, new Uint8Array(buffer));
    return `http://localhost:8000/imagenes/${filename}`;
  } catch {
    return null;
  }
}

interface RegistroHistorial {
  fecha: string;
  tienda: string;
  precio: number;
  ml?: number | null;
  nombre?: string;
  url?: string;
}

// Misma heurística que extraerMl() del frontend
function extraerMl(nombre: string): number | null {
  const match = (nombre || "").match(/\b(\d{1,3})\s*(?:ml|m\b)/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  return val >= 5 && val <= 500 ? val : null;
}

interface MapaHistorial {
  [perfumeKey: string]: RegistroHistorial[];
}

async function cargarHistorial(): Promise<MapaHistorial> {
  try {
    const texto = await Deno.readTextFile(ARCHIVO_HISTORIAL);
    return JSON.parse(texto);
  } catch {
    return {};
  }
}

function guardarEnHistorial(nombrePerfume: string, precios: any[]): Promise<RegistroHistorial[]> {
  return enCola(() => guardarEnHistorialSinCola(nombrePerfume, precios));
}

async function guardarEnHistorialSinCola(nombrePerfume: string, precios: any[]): Promise<RegistroHistorial[]> {
  try {
    const mapa = await cargarHistorial();
    const key = nombrePerfume.toLowerCase().trim();
    const fechaHoy = new Date().toISOString().split("T")[0];

    const ofertasValidas = (precios || []).filter(
      (p) => typeof p.precio === "number" && p.precio > 0
    );

    if (!mapa[key]) {
      if (ofertasValidas.length === 0) return [];
      mapa[key] = [];
    }

    // Un registro por producto exacto (tienda + nombre) y día: solo así una baja de precio es real
    const mejorHoy = new Map<string, RegistroHistorial>();
    for (const p of ofertasValidas) {
      const clave = `${p.tienda}|${p.nombre}`;
      const actual = mejorHoy.get(clave);
      if (!actual || p.precio < actual.precio) {
        mejorHoy.set(clave, { fecha: fechaHoy, tienda: p.tienda, nombre: p.nombre, precio: p.precio, ml: extraerMl(p.nombre), url: p.url });
      }
    }

    for (const registro of mejorHoy.values()) {
      // La página del producto y la búsqueda nombran distinto al mismo producto: también se reconoce por URL
      const yaExisteHoy = mapa[key].some(
        (r) =>
          r.fecha === fechaHoy &&
          r.tienda === registro.tienda &&
          (r.nombre === registro.nombre || (mismoProducto(r.url, registro.url) && r.ml === registro.ml))
      );
      if (!yaExisteHoy) {
        mapa[key].push(registro);
      }
    }

    await Deno.writeTextFile(ARCHIVO_HISTORIAL, JSON.stringify(mapa, null, 2));
    // Se devuelve el historial de estos productos guardado con cualquier búsqueda, no solo con esta
    if (ofertasValidas.length === 0) return mapa[key];
    return historialDeOfertas(mapa, ofertasValidas.map((p) => ({ tienda: p.tienda, nombre: p.nombre, url: p.url, ml: extraerMl(p.nombre) })));
  } catch (err) {
    console.error("[Historial] Error al guardar:", err);
    return [];
  }
}

// ─────────────────────────────────────────────
//  RESEÑAS DE LA COMUNIDAD (JSON local, escritas por usuarios con cuenta)
// ─────────────────────────────────────────────
const ARCHIVO_REVIEWS = "./reviews_comunidad.json";

interface Review {
  id: string;
  perfume: string;
  usuario: string; // apodo que eligió quien la escribió
  autorId?: string; // id de la cuenta; nunca sale del servidor
  rating: number; // 1-5
  duracion_horas: number;
  comentario: string;
  fecha: string;
}

async function cargarReviewsConAutor(): Promise<Record<string, Review[]>> {
  try {
    return JSON.parse(await Deno.readTextFile(ARCHIVO_REVIEWS));
  } catch {
    return {}; // sin archivo no hay reseñas: nunca se muestran reseñas de ejemplo como si fueran reales
  }
}

// Lo que ve cualquiera: sin el id de la cuenta que la escribió
async function cargarReviews(): Promise<Record<string, Review[]>> {
  const mapa = await cargarReviewsConAutor();
  return Object.fromEntries(Object.entries(mapa).map(([k, lista]) => [k, lista.map(({ autorId: _, ...r }) => r)]));
}

// ─────────────────────────────────────────────
//  MOTOR DE ALÉRGENOS IFRA Y RADAR OLFATIVO (Semana 5)
// ─────────────────────────────────────────────
export interface AlergenoDetectado {
  id: string;
  compuesto_quimico: string;
  nombre_comun: string;
  presente_en: string;
  nivel_riesgo: "Alto" | "Moderado" | "Bajo";
  descripcion: string;
}

export interface RadarOlfativo {
  frescura: number;   // 0 - 100
  dulzor: number;     // 0 - 100
  amaderado: number;  // 0 - 100
  especiado: number;  // 0 - 100
  floral: number;     // 0 - 100
  intensidad: number; // 0 - 100
}

// Los 26 alérgenos de la norma europea, desde la lista única compartida con el frontend
const CATALOGO_REGLAS_ALERGENOS = ALERGENOS_UE.map((a) => ({
  id: a.id,
  compuesto_quimico: a.compuesto,
  nombre_comun: a.nombre,
  keywords: a.keywords,
  nivel_riesgo: a.riesgo,
  descripcion: a.explicacion,
}));

// ─────────────────────────────────────────────
//  LISTAS DEL ENVASE CONOCIDAS
//  Pocas tiendas publican los ingredientes. Cada lista real que aparece se guarda, y se reusa para el mismo
//  perfume en la misma concentración (misma fórmula) cuando otra tienda u otro tamaño no la publica.
// ─────────────────────────────────────────────
const ARCHIVO_INGREDIENTES = "./ingredientes_conocidos.json";
interface ListaConocida { url: string; nombre: string; tienda: string; ingredientes: string; fecha: string }
let listasConocidas: ListaConocida[] = [];
try { listasConocidas = JSON.parse(await Deno.readTextFile(ARCHIVO_INGREDIENTES)); } catch { /* todavía no hay listas */ }
// shortcut: las marcas salen del catálogo al iniciar; una marca nueva queda en la "línea" del nombre hasta reiniciar,
// lo que solo impide reusar su lista (falla hacia "sin lista", nunca hacia una lista equivocada)
let marcasConocidas = new Set<string>();
try {
  marcasConocidas = palabrasDeMarcas(JSON.parse(await Deno.readTextFile("./catalogo_descubiertos.json")).map((p: any) => p.marca));
} catch { /* sin catálogo */ }
let listasPorGuardar = false;

function recordarLista(oferta: any) {
  const registro: ListaConocida = {
    url: oferta.url, nombre: oferta.nombre, tienda: oferta.tienda, ingredientes: oferta.ingredientes,
    fecha: new Date().toISOString().split("T")[0],
  };
  const i = listasConocidas.findIndex((l) => mismoProducto(l.url, oferta.url));
  if (i >= 0 && listasConocidas[i].ingredientes === registro.ingredientes) return;
  if (i >= 0) listasConocidas[i] = registro;
  else listasConocidas.push(registro);
  listasPorGuardar = true;
}

// Entre las listas de la misma fórmula se prefiere la más completa (más alérgenos declarados y luego más texto)
function listaDeMismaFormula(nombre: string): ListaConocida | undefined {
  const clave = claveFormula(nombre, marcasConocidas);
  if (!clave) return undefined;
  const candidatas = listasConocidas
    .map((l) => ({ l, ids: alergenosEnIngredientes(l.ingredientes) }))
    .filter(({ l, ids }) => ids && mismaFormula(clave, claveFormula(l.nombre, marcasConocidas)));
  candidatas.sort((a, b) => b.ids!.length - a.ids!.length || b.l.ingredientes.length - a.l.ingredientes.length);
  return candidatas[0]?.l;
}

async function guardarListasConocidas() {
  if (!listasPorGuardar) return;
  listasPorGuardar = false;
  await enCola(() => Deno.writeTextFile(ARCHIVO_INGREDIENTES, JSON.stringify(listasConocidas, null, 2)));
}

// ─────────────────────────────────────────────
//  FICHAS CONOCIDAS
//  La ficha de un perfume no cambia: se guarda la respuesta de la IA en disco y se consulta una sola vez por
//  perfume. Antes cada búsqueda nueva (y cada reinicio del servidor) esperaba ~6 s a la IA.
// ─────────────────────────────────────────────
const ARCHIVO_FICHAS = "./fichas_conocidas.json";
// fichas: por nombre oficial ("dior sauvage"); alias: lo que se escribió para llegar a ella ("sauvage", "savage dior")
let fichasConocidas: { fichas: Record<string, any>; alias: Record<string, string> } = { fichas: {}, alias: {} };
try { fichasConocidas = JSON.parse(await Deno.readTextFile(ARCHIVO_FICHAS)); } catch { /* todavía no hay fichas */ }
const claveFicha = (texto: string) => sinTildes(texto.toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();

function fichaConocida(consulta: string): any | undefined {
  const clave = claveFicha(consulta);
  return fichasConocidas.fichas[fichasConocidas.alias[clave] ?? clave];
}

function recordarFicha(consulta: string, ficha: any) {
  const oficial = claveFicha(`${ficha.marca || ""} ${ficha.nombre}`);
  fichasConocidas.fichas[oficial] = ficha;
  if (claveFicha(consulta) !== oficial) fichasConocidas.alias[claveFicha(consulta)] = oficial;
  return enCola(() => Deno.writeTextFile(ARCHIVO_FICHAS, JSON.stringify(fichasConocidas)));
}

// La consulta deja de apuntar a una ficha que resultó ser de otro perfume (la ficha misma sigue siendo válida)
function olvidarAlias(consulta: string) {
  delete fichasConocidas.alias[claveFicha(consulta)];
  return enCola(() => Deno.writeTextFile(ARCHIVO_FICHAS, JSON.stringify(fichasConocidas)));
}

// Alérgenos declarados por el fabricante en la lista de ingredientes de la oferta (dato del envase, no estimado).
// Si la oferta no trae lista, se usa la de otra presentación del mismo perfume y concentración, indicando su origen.
function conAlergenosDeclarados(oferta: any): any {
  if (!oferta) return oferta;
  if (alergenosEnIngredientes(oferta.ingredientes)) {
    recordarLista(oferta);
  } else {
    const conocida = listaDeMismaFormula(oferta.nombre);
    if (conocida) {
      oferta.ingredientes = conocida.ingredientes;
      if (!mismoProducto(conocida.url, oferta.url)) {
        oferta.ingredientesOrigen = { nombre: conocida.nombre, tienda: conocida.tienda, url: conocida.url };
      }
    }
  }
  const ids = alergenosEnIngredientes(oferta.ingredientes);
  if (!ids) return oferta;
  oferta.alergenosDeclarados = CATALOGO_REGLAS_ALERGENOS.filter((r) => ids.includes(r.id)).map((r) => ({
    id: r.id,
    compuesto_quimico: r.compuesto_quimico,
    nombre_comun: r.nombre_comun,
    presente_en: "Lista de ingredientes del envase",
    nivel_riesgo: r.nivel_riesgo,
    descripcion: r.descripcion,
  }));
  return oferta;
}

function enriquecerFichaConRadarYAlergenos(ficha: any): any {
  if (!ficha) return ficha;

  const textoCompleto = [
    ficha.familia_olfativa || "",
    ...(ficha.acordes_principales || []),
    ...(ficha.notas_salida || []),
    ...(ficha.notas_corazon || []),
    ...(ficha.notas_fondo || []),
    ficha.descripcion || "",
  ]
    .join(" ")
    .toLowerCase();

  // 1. Detectar alérgenos automáticamente cruzando notas con catálogo IFRA
  const detectadosMap = new Map<string, AlergenoDetectado>();

  // Si la IA ya devolvió alergenos válidos, incorporarlos
  if (Array.isArray(ficha.alergenos_detectados)) {
    for (const a of ficha.alergenos_detectados) {
      // Solo se aceptan alérgenos de la lista IFRA conocida; la IA podría inventar otros
      if (a && a.id && a.compuesto_quimico && CATALOGO_REGLAS_ALERGENOS.some((r) => r.id === a.id)) {
        detectadosMap.set(a.id, a);
      }
    }
  }

  for (const regla of CATALOGO_REGLAS_ALERGENOS) {
    const coincidencias = regla.keywords.filter((kw) => textoCompleto.includes(kw));
    if (coincidencias.length > 0 && !detectadosMap.has(regla.id)) {
      detectadosMap.set(regla.id, {
        id: regla.id,
        compuesto_quimico: regla.compuesto_quimico,
        nombre_comun: regla.nombre_comun,
        presente_en: coincidencias.slice(0, 3).map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", "),
        nivel_riesgo: regla.nivel_riesgo,
        descripcion: regla.descripcion,
      });
    }
  }

  ficha.alergenos_detectados = Array.from(detectadosMap.values());

  // 2. Calcular o normalizar Radar Olfativo (6 dimensiones 0-100)
  const contarMatches = (palabras: string[]) =>
    palabras.reduce((acc, p) => (textoCompleto.includes(p) ? acc + 1 : acc), 0);

  const calcScore = (base: number, matches: number) =>
    Math.min(98, Math.max(18, base + matches * 18));

  const mFrescura = contarMatches(["acuático", "acuatico", "marino", "cítrico", "citrico", "bergamota", "limón", "menta", "fresco", "verde", "manzana", "ozónico"]);
  const mDulzor = contarMatches(["vainilla", "tonka", "caramelo", "cacao", "praliné", "miel", "dulce", "ámbar", "ambar", "frutal", "almendra", "coco"]);
  const mAmaderado = contarMatches(["cedro", "sándalo", "sandalo", "vetiver", "pachulí", "pachuli", "madera", "amaderado", "roble", "oud", "incienso", "pino"]);
  const mEspeciado = contarMatches(["pimienta", "canela", "cardamomo", "jengibre", "nuez moscada", "clavo", "especiado", "especias", "tabaco", "cuero"]);
  const mFloral = contarMatches(["rosa", "jazmín", "jazmin", "lavanda", "iris", "neroli", "azahar", "peonía", "floral", "flores", "violeta", "geranio", "tuberosa"]);

  const proyMap: Record<string, number> = {
    "Muy Baja": 30,
    "Baja": 45,
    "Media": 68,
    "Alta": 86,
    "Bestia": 98,
  };
  const scoreIntensidad = proyMap[ficha.proyeccion] || (ficha.duracion_horas ? Math.min(95, ficha.duracion_horas * 10) : 70);

  if (!ficha.radar_olfativo || typeof ficha.radar_olfativo.frescura !== "number") {
    ficha.radar_olfativo = {
      frescura: calcScore(25, mFrescura),
      dulzor: calcScore(20, mDulzor),
      amaderado: calcScore(25, mAmaderado),
      especiado: calcScore(20, mEspeciado),
      floral: calcScore(22, mFloral),
      intensidad: scoreIntensidad,
    };
  }

  return ficha;
}

// ─────────────────────────────────────────────
//  AZURE OPENAI (Opcional - IA de alta cuota)
// ─────────────────────────────────────────────
async function llamarAzureOpenAI(
  systemPrompt: string,
  userPrompt: string,
  imageBase64?: string,
  mimeType?: string
): Promise<any> {
  const endpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT")?.replace(/\/$/, "");
  const apiKey = Deno.env.get("AZURE_OPENAI_API_KEY");
  const deployment = Deno.env.get("AZURE_OPENAI_DEPLOYMENT_NAME") || "gpt-4o";

  if (!endpoint || !apiKey) {
    throw new Error("Azure OpenAI no configurado");
  }

  const inicio = Date.now();
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

  const userContent: any[] = [{ type: "text", text: userPrompt }];
  if (imageBase64 && mimeType) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    });
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Azure OpenAI HTTP ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const rawJson = data.choices?.[0]?.message?.content;
  const duracion = Date.now() - inicio;
  estadisticasSistema.llamadas_ia_exitosas++;
  estadisticasSistema.ultimo_modelo_ia = `Azure OpenAI (${deployment})`;
  await registrarLog("SUCCESS", "IA_AZURE", `Respuesta generada con Azure OpenAI (${deployment})`, duracion);
  return JSON.parse(rawJson);
}

// ─────────────────────────────────────────────
//  GEMINI: Modelos con Fallback Automático
// ─────────────────────────────────────────────
const MODELOS_FALLBACK = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

async function llamarGeminiConFallback(
  genAI: GoogleGenerativeAI,
  contents: any[],
  config: any = { responseMimeType: "application/json" }
): Promise<any> {
  let ultimoError: any = null;
  for (const nombreModelo of MODELOS_FALLBACK) {
    const inicio = Date.now();
    try {
      const model = genAI.getGenerativeModel({
        model: nombreModelo,
        generationConfig: config,
      });
      const result = await model.generateContent(contents);
      const texto = result.response.text();
      const duracion = Date.now() - inicio;
      estadisticasSistema.llamadas_ia_exitosas++;
      estadisticasSistema.ultimo_modelo_ia = nombreModelo;
      await registrarLog("SUCCESS", "IA_GEMINI", `Ficha generada dinámicamente con modelo ${nombreModelo}`, duracion, {
        modelo: nombreModelo,
      });
      return JSON.parse(texto);
    } catch (err: any) {
      ultimoError = err;
      const duracion = Date.now() - inicio;
      const esCuota =
        err.message?.includes("429") ||
        err.message?.includes("Quota exceeded") ||
        err.message?.includes("503") ||
        err.message?.includes("high demand");

      if (esCuota) {
        await registrarLog("WARN", "IA_GEMINI", `Modelo ${nombreModelo} sin cuota/saturado, rotando al siguiente...`, duracion);
        continue;
      }
      estadisticasSistema.errores_ia++;
      await registrarLog("ERROR", "IA_GEMINI", `Error en modelo ${nombreModelo}: ${err.message}`, duracion);
      throw err;
    }
  }
  estadisticasSistema.errores_ia++;
  throw ultimoError || new Error("Todos los modelos de Gemini agotados");
}

// ─────────────────────────────────────────────
//  Filtro de Relevancia: Detección de Términos No-Fragancia
// ─────────────────────────────────────────────
const PALABRAS_NO_PERFUME = [
  "zapatilla", "zapatillas", "zapato", "zapatos", "bota", "botas", "sandalia", "sandalias",
  "cama", "camas", "colchon", "colchones", "almohada", "almohadas", "respaldo",
  "sabana", "sabanas", "cubrecama", "manta", "funda", "fundas", "cortina", "cortinas",
  "polera", "poleras", "pantalon", "pantalones", "camisa", "camisas", "poleron", "polerones",
  "chaqueta", "chaquetas", "abrigo", "ropa", "vestido", "vestidos", "falda", "faldas",
  "celular", "celulares", "carcasa", "audifonos", "computador", "notebook", "reloj", "relojes",
  "mueble", "muebles", "mesa", "silla", "lampara", "auto", "bicicleta", "juguete", "juguetes",
  "vinilo", "vinilos", "mural", "murales", "decomural", "cuadro", "cuadros", "poster", "posters"
];

function esTerminoNoFragancia(texto: string): boolean {
  if (!texto) return true;
  const t = texto.toLowerCase();
  const terminosFragancia = ["perfume", "fragancia", "eau de", "edt", "edp", "cologne", "colonia", "parfum"];
  if (terminosFragancia.some(term => t.includes(term))) {
    return false;
  }
  return PALABRAS_NO_PERFUME.some(palabra => {
    const regex = new RegExp(`\\b${palabra}\\b`, "i");
    return regex.test(t);
  });
}

// ─────────────────────────────────────────────
//  IA: Genera ficha de fragancia completa (con Radar y Alérgenos IFRA)
// ─────────────────────────────────────────────
// Lo que publican las tiendas sobre un perfume (título, notas y descripción), para que la IA arme la ficha de un
// lanzamiento que todavía no conoce. Solo ofertas de ese mismo perfume: una búsqueda trae también otras versiones.
// Algunas tiendas ponen notas en el campo de ingredientes ("cereza, vainilla de Madagascar"): si no es una lista del
// envase, también son notas que publica la tienda
const notasEnIngredientes = (p: any) => (p.ingredientes && !leerIngredientes(p.ingredientes) ? p.ingredientes : "");

function evidenciaDeTiendas(consulta: string, precios: any[], marca = ""): string {
  const conTexto = precios.filter(
    (p) => (p.descripcionTienda || p.notasTienda || p.familiaTienda || notasEnIngredientes(p)) && coincideFlexible(p.nombre, consulta),
  );
  // Con la marca conocida, solo ese perfume exacto: "Bad Boy Elixir" también calza con los textos de "Bad Boy Cobalt
  // Elixir", y con ellos la IA volvía a describir el Cobalt
  const exactas = marca ? conTexto.filter((p) => esMismoPerfume(sinPalabrasDeMarca(consulta, marca), p.nombre, marca)) : conTexto;
  return (marca ? exactas : conTexto)
    .slice(0, 3)
    .map((p) => {
      const otras = notasEnIngredientes(p);
      return `- ${p.tienda}: "${p.nombre}". ${p.notasTienda ? `Notas: ${p.notasTienda}. ` : ""}${otras ? `Otras notas (publicadas en el campo de ingredientes): ${otras}. ` : ""}${p.familiaTienda ? `Familia según la tienda: ${p.familiaTienda}. ` : ""}${p.descripcionTienda || ""}`;
    })
    .join("\n");
}

// Con `evidencia` (ver evidenciaDeTiendas) la ficha se arma con lo que publican las tiendas y queda con origen "tiendas"
async function generarFichaFragancia(nombrePerfume: string, apiKey: string, evidencia = "") {
  if (esTerminoNoFragancia(nombrePerfume)) {
    await registrarLog("WARN", "API", `Búsqueda rechazada por filtro de categoría no-fragancia: "${nombrePerfume}"`);
    return null;
  }
  const conocida = fichaConocida(nombrePerfume);
  if (conocida) return normalizarFicha(structuredClone(conocida));

  const prompt = `Eres un evaluador y maestro perfumista internacional con más de 20 años de experiencia y especialista en seguridad dermatológica IFRA.
Evalúa el siguiente término ingresado: "${nombrePerfume}".

PASO 1: VERIFICACIÓN RIGUROSA
Determina si "${nombrePerfume}" corresponde a un perfume, colonia, fragancia, marca de perfumería o aroma real.
El término puede venir mal escrito o ser el título de un producto en una tienda (con tamaño, "set de regalo", un desodorante o una loción que acompañan al perfume, etc.): en ese caso identifica el perfume principal y responde con su nombre oficial.
${evidencia ? "" : `Corregir un error de tipeo no es cambiar de perfume: si el nombre corresponde a un perfume que no conoces con certeza (por ejemplo, un lanzamiento reciente o una versión nueva de una línea conocida), NO lo sustituyas por otro perfume parecido de la misma marca ni por la versión original de la línea. En ese caso devuelve exactamente {"es_perfume": true, "desconocido": true}.
`}${evidencia ? `
INFORMACIÓN DE LAS TIENDAS: este producto se vende hoy como perfume en tiendas chilenas, así que "es_perfume" es true. Si no lo conoces es porque es un lanzamiento posterior a tu conocimiento. Esto es lo que publican las tiendas:
${evidencia}
Arma la ficha SOLO con esta información: las notas, la familia y la descripción deben salir de lo que dicen las tiendas. Lo que no digan déjalo vacío ([] en las listas de notas); no lo completes con los datos de otro perfume de la misma línea. Agrega "origen": "tiendas" al JSON.
` : ""}Si el término NO es un perfume (por ejemplo: si es calzado, ropa, zapatillas, muebles, camas, electrodomésticos, tecnología, comida, etc.), NO DEBES INVENTAR NOTAS OLFATIVAS NI PIRÁMIDE. Devuelve exactamente este JSON:
{
  "es_perfume": false,
  "mensaje": "El término '${nombrePerfume}' no corresponde a una fragancia o perfume reconocido."
}

PASO 2: SI SÍ ES UN PERFUME O FRAGANCIA
Usa la pirámide olfativa oficial de la marca y no repitas una misma nota en dos niveles (salida, corazón y fondo).
Devuelve ESTRICTAMENTE este JSON (sin texto extra ni backticks, solo el JSON puro):
{
  "es_perfume": true,
  "nombre": "Nombre oficial exacto del perfume (ej: Acqua di Giò Profumo)",
  "marca": "Marca del fabricante (ej: Giorgio Armani)",
  "concentracion": "Una de: EDP / EDT / EDC / Parfum / Perfume Oil",
  "familia_olfativa": "Familia principal y subfamilia (ej: Acuático Aromático)",
  "acordes_principales": ["Acuático", "Marino", "Cítrico"],
  "genero": "Masculino / Femenino / Unisex",
  "notas_salida": ["nota1", "nota2", "nota3"],
  "notas_corazon": ["nota1", "nota2", "nota3"],
  "notas_fondo": ["nota1", "nota2", "nota3"],
  "duracion_horas": 8,
  "proyeccion": "Una de: Muy Baja / Baja / Media / Alta / Bestia",
  "sillage": "Descripción del rastro que deja (ej: Estela media, se percibe a 1 metro)",
  "estaciones": ["Primavera", "Verano"],
  "ocasiones": ["Casual", "Trabajo", "Citas", "Noche", "Deporte"],
  "mejor_momento_dia": "Mañana / Tarde / Noche / Cualquier momento",
  "publico_objetivo": "Descripción del usuario ideal",
  "intensidad": "Una de: Ligero / Moderado / Intenso / Muy Intenso",
  "presentaciones_habituales": ["50 ml", "100 ml", "200 ml"],
  "radar_olfativo": {
    "frescura": 85,
    "dulzor": 20,
    "amaderado": 55,
    "especiado": 40,
    "floral": 30,
    "intensidad": 75
  },
  "guia_aplicacion": {
    "atomizaciones": "Cuántas atomizaciones y dónde, según la concentración y la proyección de ESTE perfume",
    "puntos_pulso": ["punto1", "punto2", "punto3"],
    "consejo_experto": "Un consejo propio de ESTE perfume (cómo evoluciona, cuándo rinde mejor); no un consejo genérico que sirva para cualquiera",
    "clima_ideal": "El clima en que rinde mejor ESTE perfume y por qué"
  },
  "descripcion": "Descripción experta de 3-4 frases describiendo la evolución, el carácter y la experiencia olfativa única de este perfume.",
  "en": {
    "familia_olfativa": "La misma familia, en inglés (ej: Aquatic Aromatic)",
    "acordes_principales": ["Los mismos acordes en inglés, en el mismo orden"],
    "notas_salida": ["Las mismas notas de salida en inglés, en el mismo orden y la misma cantidad"],
    "notas_corazon": ["Las mismas notas de corazón en inglés, en el mismo orden y la misma cantidad"],
    "notas_fondo": ["Las mismas notas de fondo en inglés, en el mismo orden y la misma cantidad"],
    "estaciones": ["Las mismas estaciones en inglés"],
    "ocasiones": ["Las mismas ocasiones en inglés"],
    "mejor_momento_dia": "El mismo momento del día en inglés",
    "sillage": "La misma descripción de la estela, en inglés",
    "publico_objetivo": "El mismo público objetivo, en inglés",
    "descripcion": "La misma descripción, en inglés",
    "guia_aplicacion": { "atomizaciones": "en inglés", "puntos_pulso": ["los mismos puntos en inglés"], "consejo_experto": "en inglés", "clima_ideal": "en inglés" }
  },
  "similares_olfativos": [
    {
      "nombre": "Nombre completo reconocible del perfume 1",
      "marca": "Marca del fabricante",
      "motivo": "Por qué huele similar (notas o sensación que comparten)",
      "precio_estimado": "$65.000 CLP"
    },
    {
      "nombre": "Nombre completo reconocible del perfume 2",
      "marca": "Marca",
      "motivo": "Por qué huele similar (alternativa o clon conocido)",
      "precio_estimado": "$55.000 CLP"
    },
    {
      "nombre": "Nombre completo reconocible del perfume 3",
      "marca": "Marca",
      "motivo": "Por qué comparte la misma vibra",
      "precio_estimado": "$79.000 CLP"
    }
  ],
  "similares_precio": [
    {
      "nombre": "Nombre completo del perfume en rango similar 1",
      "marca": "Marca",
      "motivo": "Excelente opción dentro del mismo presupuesto",
      "precio_estimado": "$45.000 CLP"
    },
    {
      "nombre": "Nombre completo del perfume en rango similar 2",
      "marca": "Marca",
      "motivo": "Alternativa de gran relación calidad/precio",
      "precio_estimado": "$38.000 CLP"
    },
    {
      "nombre": "Nombre completo del perfume en rango similar 3",
      "marca": "Marca",
      "motivo": "Opción accesible con rendimiento similar",
      "precio_estimado": "$35.000 CLP"
    }
  ]
}`;

  function normalizarFicha(ficha: any) {
    if (!ficha) return ficha;
    const normalizarItem = (item: any) => {
      if (!item) return item;
      const marca = (item.marca || "").trim();
      let nombre = (item.nombre || "").trim();
      if (marca && !nombre.toLowerCase().includes(marca.toLowerCase())) {
        nombre = `${marca} ${nombre}`;
      }
      return { ...item, nombre, marca };
    };
    if (Array.isArray(ficha.similares_olfativos)) {
      ficha.similares_olfativos = ficha.similares_olfativos.map(normalizarItem);
    }
    if (Array.isArray(ficha.similares_precio)) {
      ficha.similares_precio = ficha.similares_precio.map(normalizarItem);
    }
    return enriquecerFichaConRadarYAlergenos(ficha);
  }

  // 1. Probar con Azure OpenAI si está configurado en .env
  if (Deno.env.get("AZURE_OPENAI_API_KEY")) {
    try {
      const fichaAzure = await llamarAzureOpenAI(
        "Eres un experto perfumista. Devuelve únicamente JSON válido.",
        prompt
      );
      if (fichaAzure) {
        if (fichaAzure.es_perfume === false || fichaAzure.desconocido) {
          await registrarLog("WARN", "IA_AZURE", `La IA no reconoció "${nombrePerfume}" (${fichaAzure.desconocido ? "perfume que no conoce" : "no es un perfume"}).`);
          return null;
        }
        if (fichaAzure.nombre) {
          if (evidencia) fichaAzure.origen = "tiendas";
          fichaAzure.en = traduccionValida(fichaAzure.en, fichaAzure);
          await recordarFicha(nombrePerfume, structuredClone(fichaAzure));
          return normalizarFicha(fichaAzure);
        }
      }
    } catch (azureErr: any) {
      await registrarLog("WARN", "IA_AZURE", `Fallback a Gemini activado: ${azureErr.message}`);
    }
  }

  // 2. Probar con Gemini
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await llamarGeminiConFallback(genAI, [prompt]);
    if (result) {
      if (result.es_perfume === false || result.desconocido) {
        await registrarLog("WARN", "IA_GEMINI", `Gemini no reconoció "${nombrePerfume}" (${result.desconocido ? "perfume que no conoce" : "no es un perfume"}).`);
        return null;
      }
      if (evidencia) result.origen = "tiendas";
      result.en = traduccionValida(result.en, result);
      if (result.nombre) await recordarFicha(nombrePerfume, structuredClone(result));
      return normalizarFicha(result);
    }
  } catch (err) {
    if (esTerminoNoFragancia(nombrePerfume)) {
      return null;
    }
    await registrarLog("WARN", "IA_GEMINI", `Usando ficha olfativa curada de respaldo para "${nombrePerfume}" por límite de cuota.`);
    return normalizarFicha(construirFichaRespaldoDiferenciada(nombrePerfume));
  }
}

// ─────────────────────────────────────────────
//  Ficha en inglés: la interfaz tiene español e inglés, y la ficha la escribe la IA en español. La versión en inglés
//  va en `ficha.en` (solo los textos; los números, el radar y los alérgenos son los mismos). La app la muestra si se
//  eligió inglés y, si falta, muestra el español.
// ─────────────────────────────────────────────
// Traduce una ficha ya guardada (las de antes de pedir el inglés en el prompt)
async function traducirFicha(ficha: any): Promise<any> {
  const original: any = {};
  for (const campo of CAMPOS_EN) {
    const v = ficha[campo];
    if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) original[campo] = v;
  }
  if (!Object.keys(original).length) return undefined;
  const prompt = `Traduce al inglés los valores de este JSON, que describe el perfume "${ficha.marca || ""} ${ficha.nombre || ""}".
Devuelve el mismo JSON con las mismas claves y la misma estructura: cada lista con la misma cantidad de elementos y en el mismo orden.
Usa los nombres habituales en inglés de las notas de perfumería (Bergamota → Bergamot, Haba Tonka → Tonka Bean, Azahar → Orange Blossom). Las materias primas que en inglés se llaman igual (Ambroxan, Oud, Akigalawood) quedan igual. Traduce el sentido, no palabra por palabra. Devuelve solo el JSON.
${JSON.stringify(original)}`;
  let respuesta: any = null;
  if (Deno.env.get("AZURE_OPENAI_API_KEY")) {
    try {
      respuesta = await llamarAzureOpenAI("Eres un traductor de fichas de perfumería del español al inglés. Devuelve únicamente JSON válido.", prompt);
    } catch { /* se prueba con Gemini */ }
  }
  const claveGemini = Deno.env.get("GEMINI_API_KEY");
  if (!respuesta && claveGemini) {
    try {
      respuesta = await llamarGeminiConFallback(new GoogleGenerativeAI(claveGemini), [prompt]);
    } catch { /* queda sin traducir */ }
  }
  return traduccionValida(respuesta, ficha);
}

// Se ejecuta a mano, con el servidor apagado: deno run -A --env server.ts --traducir [cuántas]
// Traduce las fichas guardadas que no tienen inglés. Se puede interrumpir y repetir: no vuelve a pagar las hechas.
async function traducirFichasGuardadas(limite = Infinity) {
  const resumen = { traducidas: 0, sinTraducir: 0, yaEstaban: 0 };
  for (const ficha of Object.values(fichasConocidas.fichas)) {
    if (ficha.en) {
      resumen.yaEstaban++;
      continue;
    }
    if (resumen.traducidas + resumen.sinTraducir >= limite) break;
    const en = await traducirFicha(ficha);
    if (en) {
      ficha.en = en;
      resumen.traducidas++;
      await enCola(() => Deno.writeTextFile(ARCHIVO_FICHAS, JSON.stringify(fichasConocidas)));
    } else {
      resumen.sinTraducir++;
    }
    console.log(`${en ? "✓" : "✗"} ${ficha.marca || ""} ${ficha.nombre || ""}`);
  }
  return resumen;
}

// ─────────────────────────────────────────────
//  BASE OLFATIVA CURADA + DIFERENCIACIÓN DETERMINÍSTICA
//  Evita que dos perfumes tengan la misma ficha o radar cuando la cuota IA se agota
// ─────────────────────────────────────────────
function construirFichaRespaldoDiferenciada(nombrePerfume: string): any {
  const n = nombrePerfume.toLowerCase();

  const CATALOGO_CURADO: Array<{
    keywords: string[];
    ficha: any;
  }> = [
    {
      keywords: ["acqua di gio", "acqua di giò", "armani acqua"],
      ficha: {
        nombre: "Acqua di Giò",
        marca: "Giorgio Armani",
        concentracion: "Eau de Toilette",
        familia_olfativa: "Cítrica Acuática Marina",
        acordes_principales: ["Marino", "Cítrico", "Aromático", "Fresco"],
        genero: "Masculino",
        notas_salida: ["Bergamota de Calabria", "Limón", "Lima", "Mandarina verde", "Neroli"],
        notas_corazon: ["Notas marinas", "Jazmín", "Romero", "Calone", "Cilantro"],
        notas_fondo: ["Cedro Blanco", "Almizcle", "Pachulí", "Musgo de roble", "Ámbar"],
        duracion_horas: 7,
        proyeccion: "Media",
        sillage: "Estela limpia y refrescante de brisa mediterránea a 1 metro",
        estaciones: ["Primavera", "Verano"],
        ocasiones: ["Uso diario", "Oficina", "Días de calor", "Casual"],
        mejor_momento_dia: "Mañana / Tarde",
        intensidad: "Moderado",
        radar_olfativo: { frescura: 96, dulzor: 18, amaderado: 45, especiado: 28, floral: 38, intensidad: 68 },
      },
    },
    {
      keywords: ["sauvage", "dior sauvage"],
      ficha: {
        nombre: "Sauvage",
        marca: "Dior",
        concentracion: "Eau de Parfum",
        familia_olfativa: "Aromática Fougère Especiada",
        acordes_principales: ["Fresco Especiado", "Ámbar", "Cítrico", "Amaderado"],
        genero: "Masculino",
        notas_salida: ["Bergamota de Reggio", "Pimienta de Sichuan", "Mandarina"],
        notas_corazon: ["Lavanda", "Pimienta Rosa", "Geranio", "Vetiver", "Elemí"],
        notas_fondo: ["Ambroxan", "Cedro", "Vainilla de Papúa", "Ládano"],
        duracion_horas: 10,
        proyeccion: "Alta",
        sillage: "Estela magnética y potente que domina habitaciones cerradas",
        estaciones: ["Otoño", "Invierno", "Primavera", "Verano"],
        ocasiones: ["Salidas nocturnas", "Citas", "Eventos", "Oficina"],
        mejor_momento_dia: "Cualquier momento",
        intensidad: "Intenso",
        radar_olfativo: { frescura: 78, dulzor: 35, amaderado: 72, especiado: 88, floral: 32, intensidad: 92 },
      },
    },
    {
      keywords: ["bleu de chanel", "bleu chanel"],
      ficha: {
        nombre: "Bleu de Chanel",
        marca: "Chanel",
        concentracion: "Eau de Parfum",
        familia_olfativa: "Amaderada Aromática",
        acordes_principales: ["Cítrico", "Amaderado", "Ámbar", "Ahumado"],
        genero: "Masculino",
        notas_salida: ["Pomelo", "Limón", "Menta", "Pimienta Rosa", "Bergamota"],
        notas_corazon: ["Jengibre", "Nuez Moscada", "Jazmín", "Melón"],
        notas_fondo: ["Incienso", "Ámbar", "Cedro", "Sándalo de Nueva Caledonia", "Pachulí"],
        duracion_horas: 9,
        proyeccion: "Alta",
        sillage: "Estela sofisticada, ejecutiva y elegante a 1.5 metros",
        estaciones: ["Primavera", "Otoño", "Invierno", "Verano"],
        ocasiones: ["Oficina Ejecutiva", "Reuniones", "Eventos Formales", "Citas"],
        mejor_momento_dia: "Cualquier momento",
        intensidad: "Intenso",
        radar_olfativo: { frescura: 76, dulzor: 28, amaderado: 88, especiado: 68, floral: 26, intensidad: 85 },
      },
    },
    {
      keywords: ["eros", "versace eros"],
      ficha: {
        nombre: "Versace Eros",
        marca: "Versace",
        concentracion: "Eau de Toilette",
        familia_olfativa: "Aromática Fougère Dulce",
        acordes_principales: ["Vainilla", "Aromático", "Verde", "Fresco Especiado"],
        genero: "Masculino",
        notas_salida: ["Menta", "Manzana Verde", "Limón Italiano"],
        notas_corazon: ["Haba Tonka", "Ambroxan", "Geranio"],
        notas_fondo: ["Vainilla de Madagascar", "Cedro del Atlas", "Vetiver", "Musgo de roble"],
        duracion_horas: 9,
        proyeccion: "Bestia",
        sillage: "Proyección expansiva ideal para fiestas y ambientes nocturnos",
        estaciones: ["Otoño", "Invierno", "Primavera"],
        ocasiones: ["Fiesta", "Noche", "Citas", "Salidas Sociales"],
        mejor_momento_dia: "Noche",
        intensidad: "Muy Intenso",
        radar_olfativo: { frescura: 68, dulzor: 84, amaderado: 58, especiado: 52, floral: 24, intensidad: 94 },
      },
    },
    {
      keywords: ["million", "one million", "1 million", "paco rabanne"],
      ficha: {
        nombre: "1 Million",
        marca: "Rabanne",
        concentracion: "Eau de Toilette",
        familia_olfativa: "Amaderada Especiada Cálida",
        acordes_principales: ["Cálido Especiado", "Canela", "Cuero", "Ámbar", "Cítrico"],
        genero: "Masculino",
        notas_salida: ["Mandarina Roja", "Pomelo", "Menta"],
        notas_corazon: ["Canela", "Notas Especiadas", "Rosa"],
        notas_fondo: ["Ámbar", "Cuero", "Maderas Blancas", "Pachulí Hindú"],
        duracion_horas: 10,
        proyeccion: "Bestia",
        sillage: "Estela opulenta, dulce y especiada de alto impacto nocturno",
        estaciones: ["Otoño", "Invierno"],
        ocasiones: ["Fiesta", "Eventos Nocturnos", "Citas"],
        mejor_momento_dia: "Noche",
        intensidad: "Muy Intenso",
        radar_olfativo: { frescura: 36, dulzor: 88, amaderado: 70, especiado: 92, floral: 34, intensidad: 95 },
      },
    },
    {
      keywords: ["dylan blue", "versace dylan"],
      ficha: {
        nombre: "Pour Homme Dylan Blue",
        marca: "Versace",
        concentracion: "Eau de Toilette",
        familia_olfativa: "Aromática Fougère Azul",
        acordes_principales: ["Ámbar", "Cítrico", "Acuático", "Fresco Especiado", "Almizclado"],
        genero: "Masculino",
        notas_salida: ["Bergamota de Calabria", "Notas Acuáticas", "Pomelo", "Hojas de Higuera"],
        notas_corazon: ["Ambroxan", "Pimienta Negra", "Pachulí", "Hojas de Violeta", "Papiro"],
        notas_fondo: ["Incienso", "Almizcle", "Haba Tonka", "Azafrán"],
        duracion_horas: 8,
        proyeccion: "Alta",
        sillage: "Estela versátil, juvenil y moderna con fondo de incienso limpio",
        estaciones: ["Primavera", "Verano", "Otoño"],
        ocasiones: ["Uso diario", "Universidad", "Oficina", "Salidas"],
        mejor_momento_dia: "Cualquier momento",
        intensidad: "Moderado",
        radar_olfativo: { frescura: 82, dulzor: 44, amaderado: 64, especiado: 70, floral: 28, intensidad: 80 },
      },
    },
    {
      keywords: ["good girl", "carolina herrera good"],
      ficha: {
        nombre: "Good Girl",
        marca: "Carolina Herrera",
        concentracion: "Eau de Parfum",
        familia_olfativa: "Ámbar Floral Gourmand",
        acordes_principales: ["Dulce", "Floral Blanco", "Cálido Especiado", "Vainilla", "Cacao"],
        genero: "Femenino",
        notas_salida: ["Almendra", "Café", "Bergamota", "Limón"],
        notas_corazon: ["Nardos", "Jazmín Sambac", "Flor de Azahar", "Rosa de Bulgaria"],
        notas_fondo: ["Haba Tonka", "Cacao", "Vainilla", "Praliné", "Sándalo", "Canela"],
        duracion_horas: 10,
        proyeccion: "Alta",
        sillage: "Estela sensual, cremosa y envolvente que deja huella",
        estaciones: ["Otoño", "Invierno", "Primavera"],
        ocasiones: ["Citas Románticas", "Noche", "Eventos", "Galas"],
        mejor_momento_dia: "Noche",
        intensidad: "Intenso",
        radar_olfativo: { frescura: 28, dulzor: 92, amaderado: 54, especiado: 66, floral: 84, intensidad: 90 },
      },
    },
    {
      keywords: ["light blue", "dolce", "gabbana light"],
      ficha: {
        nombre: "Light Blue",
        marca: "Dolce & Gabbana",
        concentracion: "Eau de Toilette",
        familia_olfativa: "Floral Frutal Cítrica",
        acordes_principales: ["Cítrico", "Amaderado", "Frutal", "Fresco", "Verde"],
        genero: "Unisex",
        notas_salida: ["Limón Siciliano", "Manzana Granny Smith", "Cedro", "Campanilla"],
        notas_corazon: ["Bambú", "Jazmín", "Rosa Blanca"],
        notas_fondo: ["Cedro", "Almizcle", "Ámbar"],
        duracion_horas: 6,
        proyeccion: "Media",
        sillage: "Brisa luminosa y veraniega de limón siciliano recién cortado",
        estaciones: ["Verano", "Primavera"],
        ocasiones: ["Días de sol", "Playa", "Casual", "Oficina de verano"],
        mejor_momento_dia: "Mañana / Tarde",
        intensidad: "Moderado",
        radar_olfativo: { frescura: 95, dulzor: 26, amaderado: 48, especiado: 16, floral: 56, intensidad: 62 },
      },
    },
    {
      keywords: ["ck one", "calvin klein ck"],
      ficha: {
        nombre: "CK One",
        marca: "Calvin Klein",
        concentracion: "Eau de Toilette",
        familia_olfativa: "Cítrica Aromática",
        acordes_principales: ["Cítrico", "Verde", "Amaderado", "Atalcado", "Fresco"],
        genero: "Unisex",
        notas_salida: ["Limón", "Notas Verdes", "Bergamota", "Mandarina", "Piña", "Cardamomo"],
        notas_corazon: ["Lirio de los Valles", "Jazmín", "Violeta", "Nuez Moscada", "Rosa"],
        notas_fondo: ["Té Verde", "Almizcle", "Cedro", "Sándalo", "Musgo de roble"],
        duracion_horas: 5,
        proyeccion: "Baja",
        sillage: "Aroma limpio a piel recién duchada, íntimo y relajado",
        estaciones: ["Verano", "Primavera"],
        ocasiones: ["Uso diario", "Gimnasio", "Casual", "Post-ducha"],
        mejor_momento_dia: "Mañana",
        intensidad: "Ligero",
        radar_olfativo: { frescura: 92, dulzor: 16, amaderado: 40, especiado: 28, floral: 48, intensidad: 48 },
      },
    },
    {
      keywords: ["nautica", "voyage"],
      ficha: {
        nombre: "Nautica Voyage",
        marca: "Nautica",
        concentracion: "Eau de Toilette",
        familia_olfativa: "Amaderada Acuática",
        acordes_principales: ["Acuático", "Frutal", "Verde", "Floral", "Fresco"],
        genero: "Masculino",
        notas_salida: ["Manzana Verde", "Hojas Verdes"],
        notas_corazon: ["Flor de Loto", "Mimosa", "Acorde Acuático"],
        notas_fondo: ["Almizcle", "Cedro", "Musgo de roble", "Ámbar"],
        duracion_horas: 6,
        proyeccion: "Media",
        sillage: "Estela limpia y juvenil con excelente relación calidad-precio",
        estaciones: ["Primavera", "Verano"],
        ocasiones: ["Deporte", "Uso diario", "Universidad", "Días calurosos"],
        mejor_momento_dia: "Mañana / Tarde",
        intensidad: "Moderado",
        radar_olfativo: { frescura: 90, dulzor: 24, amaderado: 46, especiado: 14, floral: 42, intensidad: 64 },
      },
    },
    {
      keywords: ["le male", "gaultier", "jean paul"],
      ficha: {
        nombre: "Le Male",
        marca: "Jean Paul Gaultier",
        concentracion: "Eau de Toilette",
        familia_olfativa: "Ámbar Fougère",
        acordes_principales: ["Aromático", "Vainilla", "Lavanda", "Fresco Especiado", "Atalcado"],
        genero: "Masculino",
        notas_salida: ["Lavanda", "Menta", "Cardamomo", "Bergamota", "Abrótano"],
        notas_corazon: ["Canela", "Flor de Azahar", "Alcaravea"],
        notas_fondo: ["Vainilla", "Haba Tonka", "Ámbar", "Sándalo", "Cedro"],
        duracion_horas: 9,
        proyeccion: "Alta",
        sillage: "Estela icónica de barbería clásica fusionada con vainilla seductora",
        estaciones: ["Otoño", "Invierno", "Primavera"],
        ocasiones: ["Citas", "Noche", "Salidas"],
        mejor_momento_dia: "Tarde / Noche",
        intensidad: "Intenso",
        radar_olfativo: { frescura: 56, dulzor: 82, amaderado: 58, especiado: 76, floral: 46, intensidad: 86 },
      },
    },
    {
      keywords: ["la vie est belle", "lancome", "lancôme"],
      ficha: {
        nombre: "La Vie Est Belle",
        marca: "Lancôme",
        concentracion: "Eau de Parfum",
        familia_olfativa: "Floral Frutal Gourmand",
        acordes_principales: ["Dulce", "Vainilla", "Frutal", "Pachulí", "Iris"],
        genero: "Femenino",
        notas_salida: ["Grosellas Negras", "Pera"],
        notas_corazon: ["Iris", "Jazmín", "Flor de Azahar"],
        notas_fondo: ["Praliné", "Vainilla", "Pachulí", "Haba Tonka"],
        duracion_horas: 10,
        proyeccion: "Bestia",
        sillage: "Estela luminosa y gourmand de altísima fijación",
        estaciones: ["Otoño", "Invierno", "Primavera"],
        ocasiones: ["Eventos Especiales", "Citas", "Uso diario elegante"],
        mejor_momento_dia: "Tarde / Noche",
        intensidad: "Muy Intenso",
        radar_olfativo: { frescura: 30, dulzor: 94, amaderado: 48, especiado: 34, floral: 88, intensidad: 94 },
      },
    },
  ];

  const encontrado = CATALOGO_CURADO.find((c) => c.keywords.some((k) => n.includes(k)));
  if (encontrado) {
    return {
      ...encontrado.ficha,
      publico_objetivo: `Amantes de las fragancias ${encontrado.ficha.familia_olfativa.toLowerCase()} con sello distintivo.`,
      // Los tamaños salen de las ofertas reales de las tiendas, no de una lista fija
      presentaciones_habituales: [],
      guia_aplicacion: {
        atomizaciones: encontrado.ficha.intensidad.includes("Intenso")
          ? "2 a 4 atomizaciones (cuello y muñecas)"
          : "4 a 6 atomizaciones (cuello, muñecas y pecho)",
        puntos_pulso: ["Lados del cuello", "Interior de muñecas", "Detrás de orejas"],
        consejo_experto: "Aplica tras la ducha sobre piel hidratada. Evita frotar las muñecas para conservar las notas de salida.",
        clima_ideal: `Ideal para ${encontrado.ficha.estaciones.join(" y ")}`,
      },
      descripcion: `${encontrado.ficha.nombre} de ${encontrado.ficha.marca} destaca dentro de la familia ${encontrado.ficha.familia_olfativa}. Abre con notas vibrantes de ${encontrado.ficha.notas_salida.slice(0, 3).join(", ")}, evolucionando hacia un corazón de ${encontrado.ficha.notas_corazon.slice(0, 2).join(" y ")} sobre un fondo duradero de ${encontrado.ficha.notas_fondo.slice(0, 3).join(", ")}.`,
      // Los similares se calculan en el frontend con el catálogo real (precios de tienda)
      similares_olfativos: [],
      similares_precio: [],
      // La pantalla dice que es una ficha escrita a mano, no la de la IA
      origen: "curada",
    };
  }

  // Perfume fuera de la lista curada y sin IA disponible: no se inventa una ficha genérica
  return null;
}


// ─────────────────────────────────────────────
//  PUENTE DENO → PYTHON (scraper multi-tienda con telemetría)
// ─────────────────────────────────────────────
// Con `alLlegarTienda` se entregan las ofertas de cada tienda apenas responde, sin esperar a la más lenta
// (DBS suele tardar 4 a 8 s; Falabella y Alisha, 1 a 2 s)
async function buscarPreciosConPython(nombrePerfume: string, alLlegarTienda?: (ofertas: any[]) => void) {
  const inicio = Date.now();
  try {
    const palabras = nombrePerfume.trim().split(/\s+/);
    const hijo = new Deno.Command("python", {
      args: ["scraper_stock.py", "--por-tienda", ...palabras],
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const stderr = new Response(hijo.stderr).text();

    // El scraper escribe una línea JSON por tienda y, al final, la lista completa ordenada
    let lista: any = null;
    // Lo que el scraper no pudo leer (Falabella respondiendo 403, por ejemplo): sin esto un bloqueo se registraba como
    // una búsqueda que salió bien
    let avisos: string[] = [];
    const leerLinea = (linea: string) => {
      if (!linea.trim()) return;
      const dato = JSON.parse(linea);
      if (Array.isArray(dato.avisos)) avisos = dato.avisos;
      if (Array.isArray(dato.todas)) lista = dato.todas;
      else if (Array.isArray(dato.ofertas) && alLlegarTienda) {
        dato.ofertas.forEach(conAlergenosDeclarados);
        alLlegarTienda(dato.ofertas);
      }
    };
    let pendiente = "";
    for await (const trozo of hijo.stdout.pipeThrough(new TextDecoderStream())) {
      const lineas = (pendiente + trozo).split("\n");
      pendiente = lineas.pop()!;
      lineas.forEach(leerLinea);
    }
    leerLinea(pendiente);
    const proceso = { code: (await hijo.status).code, stderr: await stderr };
    const duracion = Date.now() - inicio;

    if (proceso.code === 0) {
      if (Array.isArray(lista)) {
        lista.forEach(conAlergenosDeclarados);
        await guardarListasConocidas();
      }
      const conteoPorTienda: Record<string, number> = {};
      if (Array.isArray(lista)) {
        for (const item of lista) {
          conteoPorTienda[item.tienda] = (conteoPorTienda[item.tienda] || 0) + 1;
        }
      }
      await registrarLog(
        "SUCCESS",
        "SCRAPER",
        `Scraping multitienda para "${nombrePerfume}" completado: ${Array.isArray(lista) ? lista.length : 0} ofertas válidas`,
        duracion,
        { query: nombrePerfume, total_ofertas: Array.isArray(lista) ? lista.length : 0, desglose_tiendas: conteoPorTienda }
      );
      for (const aviso of avisos) await registrarLog("WARN", "SCRAPER", `${aviso} (búsqueda "${nombrePerfume}")`);
      return lista;
    } else {
      await registrarLog("ERROR", "SCRAPER", `Fallo en subproceso Python para "${nombrePerfume}"`, duracion, { stderr: proceso.stderr });
      return null;
    }
  } catch (error: any) {
    const duracion = Date.now() - inicio;
    await registrarLog("ERROR", "SCRAPER", `Excepción al invocar Python: ${error.message}`, duracion);
    return null;
  }
}

// Precio y stock actuales de un producto ya conocido, leyendo su propia página (Falabella, DBS o Alisha)
async function cotizarUrlConPython(url: string): Promise<any | null> {
  if (!/^https:\/\/(www\.falabella\.com|dbs\.cl|alishaperfumes\.cl)\//.test(url || "")) return null;
  const inicio = Date.now();
  try {
    const proceso = await new Deno.Command("python", {
      args: ["scraper_stock.py", "--url", url],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const oferta = proceso.code === 0 ? conAlergenosDeclarados(JSON.parse(new TextDecoder().decode(proceso.stdout))) : null;
    await guardarListasConocidas();
    await registrarLog(
      oferta ? "SUCCESS" : "WARN",
      "SCRAPER",
      oferta ? `Re-cotización directa en ${oferta.tienda}: $${oferta.precio}` : `Re-cotización directa sin resultado: ${url}`,
      Date.now() - inicio
    );
    return oferta;
  } catch (error: any) {
    await registrarLog("ERROR", "SCRAPER", `Re-cotización directa falló: ${error.message}`, Date.now() - inicio);
    return null;
  }
}

// ─────────────────────────────────────────────
//  SUCURSALES Y HORARIOS (Disponibilidad Geográfica)
// ─────────────────────────────────────────────
// Respaldo escrito a mano, solo para cuando no se pueden leer las páginas de las tiendas. Falabella no publica su
// lista de tiendas sin JavaScript, así que sus locales quedan siempre aquí. Coordenadas verificadas en
// OpenStreetMap; los horarios son referenciales. Sin teléfono: los que había no estaban verificados.
const SUCURSALES_CHILE = [
  ["Falabella", "Falabella Parque Arauco", "Av. Presidente Kennedy 5413", "Las Condes", -33.4023, -70.5773],
  ["Falabella", "Falabella Costanera Center", "Av. Andrés Bello 2425", "Providencia", -33.418, -70.6064],
  ["Falabella", "Falabella Alto Las Condes", "Av. Presidente Kennedy 9001", "Las Condes", -33.3909, -70.5461],
  ["Falabella", "Falabella Mall Plaza Egaña", "Av. Larraín 5862", "La Reina", -33.4532, -70.5696],
  ["DBS Beauty Store", "DBS Cenco Costanera Center", "Av. Andrés Bello 2447, local 1158", "Providencia", -33.418, -70.6064],
  ["DBS Beauty Store", "DBS Parque Arauco", "Av. Presidente Kennedy 5413, local 107", "Las Condes", -33.4023, -70.5773],
  ["Alisha Perfumes", "Alisha Mall Cenco Costanera", "Mall Cenco Costanera, Nivel 1 Local 1517", "Providencia", -33.418, -70.6064],
  ["Farmacias Ahumada", "Ahumada Providencia", "Av. Providencia 2185", "Providencia", -33.4262, -70.6103],
].map(([tienda, nombre, direccion, comuna, lat, lng]) => ({
  tienda, nombre, direccion, comuna, lat, lng,
  horario: "Lunes a Domingo: 10:00 - 20:00",
  region: "Metropolitana",
  telefono: "",
  fuente: "referencial",
})) as any[];

// Locales de Farmacias Ahumada, DBS y Alisha leídos de sus páginas (scraper_sucursales.py); Falabella queda manual
const TTL_SUCURSALES_MS = 24 * 60 * 60 * 1000;
const REINTENTO_SUCURSALES_MS = 10 * 60 * 1000;
let cacheSucursales: { expira: number; datos: Promise<any[]> } | null = null;

async function scrapearSucursales(): Promise<any[]> {
  const inicio = Date.now();
  try {
    const proceso = await new Deno.Command("python", {
      args: ["scraper_sucursales.py"],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const duracion = Date.now() - inicio;
    if (proceso.code !== 0) {
      await registrarLog("ERROR", "SCRAPER", "Fallo al obtener las sucursales de las tiendas", duracion, {
        stderr: new TextDecoder().decode(proceso.stderr),
      });
      return [];
    }
    const locales = JSON.parse(new TextDecoder().decode(proceso.stdout));
    const porTienda = (locales as any[]).reduce((c: Record<string, number>, l) => ({ ...c, [l.tienda]: (c[l.tienda] || 0) + 1 }), {});
    await registrarLog("SUCCESS", "SCRAPER", `Horarios de ${locales.length} locales actualizados`, duracion, porTienda);
    return Array.isArray(locales) ? locales : [];
  } catch (error: any) {
    await registrarLog("ERROR", "SCRAPER", `Excepción al obtener sucursales: ${error.message}`, Date.now() - inicio);
    return [];
  }
}

function obtenerSucursales(): Promise<any[]> {
  if (cacheSucursales && Date.now() < cacheSucursales.expira) return cacheSucursales.datos;
  const entrada = { expira: Date.now() + TTL_SUCURSALES_MS, datos: Promise.resolve(SUCURSALES_CHILE) };
  entrada.datos = scrapearSucursales().then((leidas) => {
    if (leidas.length === 0) {
      entrada.expira = Date.now() + REINTENTO_SUCURSALES_MS;
      return SUCURSALES_CHILE;
    }
    // De cada cadena que se pudo leer valen sus locales publicados; el respaldo solo queda para las demás
    const leidasDe = new Set(leidas.map((s) => s.tienda));
    return [...SUCURSALES_CHILE.filter((s) => !leidasDe.has(s.tienda)), ...leidas];
  });
  cacheSucursales = entrada;
  return entrada.datos;
}

// ─────────────────────────────────────────────
//  GET /api/logs & DELETE /api/logs (Observabilidad Semana 5)
// ─────────────────────────────────────────────
app.get("/api/logs", (c) => {
  return c.json({
    success: true,
    estadisticas: {
      ...estadisticasSistema,
      entradas_en_cache: cacheBusquedas.size,
    },
    logs: memoriaLogs,
  });
});

// Borrar el registro es de quien administra la app: desde el mismo equipo donde corre el backend, o con una cuenta
// cuyo correo esté en CORREOS_ADMIN (separados por coma). Leerlo no expone datos personales y sigue abierto.
const CORREOS_ADMIN = new Set((Deno.env.get("CORREOS_ADMIN") || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
const esEsteEquipo = (c: any) => {
  // Detrás de un proxy (Railway) la dirección que se ve es la del proxy: nunca cuenta como este equipo
  if (Deno.env.get("DETRAS_DE_PROXY") === "1") return false;
  const ip = String(c.env?.remoteAddr?.hostname || "");
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

app.delete("/api/logs", async (c) => {
  if (!origenPermitido(c.req.header("origin") || "")) return c.json({ success: false, error: "Origen no permitido." }, 403);
  const usuario = esEsteEquipo(c) ? null : await cuentas.usuarioDe(c);
  if (!esEsteEquipo(c) && !(usuario && CORREOS_ADMIN.has(usuario.email))) {
    await registrarLog("WARN", "API", "Se intentó borrar el registro desde otro equipo sin permiso.");
    return c.json({ success: false, error: "Solo quien administra la app puede borrar el registro." }, 403);
  }
  memoriaLogs = [];
  await registrarLog("INFO", "API", "Historial de logs reiniciado manualmente por el usuario.");
  return c.json({ success: true, logs: memoriaLogs });
});

// ─────────────────────────────────────────────
//  GET /api/buscar?q=nombre
// ─────────────────────────────────────────────
// La ficha que corresponde a lo buscado, sabiendo ya qué venden las tiendas
async function fichaConfiable(consulta: string, ficha: any, precios: any[], apiKey: string) {
  if (ficha && precios.length && nombresDistintos(consulta, ficha.nombre || "", ficha.marca || "")) {
    // Las tiendas venden lo buscado y la IA describió un perfume con otro nombre: no lo conoce y puso uno parecido
    // de la marca ("Power Of You" → "Stronger With You"). Esa ficha es de otro perfume y no se usa.
    await registrarLog("WARN", "API", `Ficha descartada: se buscó "${consulta}" y la IA describió "${ficha.nombre}"`);
    await olvidarAlias(consulta);
    ficha = null;
  }
  if (ficha && otraVersionQueLaBuscada(consulta, ficha, precios)) {
    // La IA agregó una palabra que no se buscó ("Bad Boy Elixir" → "Bad Boy Cobalt Elixir") y las tiendas venden
    // justo lo buscado: esa ficha es de otra versión y la app abría esa en vez del perfume pedido.
    await registrarLog("WARN", "API", `Ficha descartada: se buscó "${consulta}" y la IA describió otra versión, "${ficha.nombre}"`);
    await olvidarAlias(consulta);
    const marca = ficha.marca || "";
    // Si ya se armó antes la ficha del nombre exacto (buscándolo con la marca), esa es la que corresponde
    const exacta = fichaConocida(`${marca} ${sinPalabrasDeMarca(consulta, marca)}`);
    if (exacta && !otraVersionQueLaBuscada(consulta, exacta, precios)) {
      await recordarFicha(consulta, exacta);
      return await generarFichaFragancia(consulta, apiKey); // sale de las fichas guardadas, ya normalizada
    }
    const nueva = await fichaDesdeTiendas(consulta, precios, apiKey, marca);
    // La segunda respuesta también se revisa: sin esto quedaba guardada la misma versión equivocada
    if (nueva && !otraVersionQueLaBuscada(consulta, nueva, precios)) return nueva;
    if (nueva) await olvidarAlias(consulta);
    return null;
  }
  // La IA no lo conoce pero las tiendas sí lo venden: suele ser un lanzamiento posterior a lo que la IA sabe.
  // Se le pide la ficha de nuevo con lo que publican las tiendas; si no publican notas ni descripción, queda sin ficha.
  return ficha || (await fichaDesdeTiendas(consulta, precios, apiKey));
}

async function fichaDesdeTiendas(consulta: string, precios: any[], apiKey: string, marca = "") {
  const evidencia = evidenciaDeTiendas(consulta, precios, marca);
  if (!evidencia || !(apiKey || Deno.env.get("AZURE_OPENAI_API_KEY"))) return null;
  return await generarFichaFragancia(consulta, apiKey, evidencia).catch(() => null);
}

// Perfumes que la app ya conoce ("marca nombre"), para corregir errores de tipeo en las búsquedas
async function nombresConocidos(): Promise<string[]> {
  let indexados: any[] = [];
  try {
    indexados = JSON.parse(await Deno.readTextFile(ARCHIVO_CATALOGO_KNASTA));
  } catch {
    // Sin el catálogo indexado se usan los descubiertos y el diccionario de marcas
  }
  return [
    ...[...indexados, ...(await cargarCatalogoDescubiertos())].map((p) => `${p.marca} ${p.nombre}`),
    ...DICCIONARIO_MARCAS_CANONICAS.flatMap((m) => m.keywords.map((k) => `${m.marca} ${k}`)),
  ];
}

// Búsqueda completa de un perfume. `avisar` recibe cada avance (corrección, ofertas de una tienda, ficha) para
// que /api/buscar-vivo los envíe al navegador apenas existen; /api/buscar solo usa el resultado final.
async function buscarCompleto(
  escrita: string,
  { sinCache = false, literal = false } = {},
  avisar: (evento: any) => void = () => {},
) {
  const inicioTotal = Date.now();
  estadisticasSistema.total_busquedas++;

  // Filtro preventivo: descartar búsquedas explícitas de categorías no-perfume
  if (esTerminoNoFragancia(escrita)) {
    await registrarLog("WARN", "API", `Búsqueda bloqueada por filtro no-fragancia: "${escrita}"`, Date.now() - inicioTotal);
    return {
      success: true,
      query: escrita,
      es_perfume: false,
      mensaje: `⚠️ "${escrita}" no corresponde a un perfume o fragancia. PerfumeScan está optimizado exclusivamente para perfumes de diseñador y fragancias originales.`,
      precios: [],
      ficha: null,
      historial: [],
      reviews: [],
      sucursales: await obtenerSucursales(),
    };
  }

  // Lo que se sabía de lo escrito sale antes de todo (corregir el tipeo contra el catálogo ya toma tiempo)
  let conocidoEnviado = false;
  const anticipar = (consulta: string) => {
    const conocido = conocidoEnviado ? null : resultadoConocido(consulta);
    if (conocido) {
      avisar({ tipo: "conocidas", ...conocido });
      conocidoEnviado = true;
    }
  };
  anticipar(escrita);

  // Errores de tipeo: "savage dior" se busca como "sauvage dior" (con literal=1 se busca tal cual)
  let query = (!literal && corregirBusqueda(escrita, await nombresConocidos())) || escrita;
  if (query !== escrita) avisar({ tipo: "corregida", consulta: query });
  const cacheKey = `buscar:${query.toLowerCase()}`;

  // Verificar Caché Inteligente
  if (!sinCache) {
    const cacheado = obtenerDeCache(cacheKey);
    if (cacheado) {
      estadisticasSistema.cache_hits++;
      const duracionCache = Date.now() - inicioTotal;
      await registrarLog("CACHE", "CACHE", `Respuesta instantánea desde caché para "${query}"`, duracionCache, {
        query,
        ofertas: cacheado.precios?.length || 0,
      });
      await guardarPerfumeDescubiertoEnCatalogo(query, cacheado.precios || [], cacheado.ficha);
      const mapaReviews = await cargarReviews();
      const reviewsActualizadas = mapaReviews[query.toLowerCase().trim()] || cacheado.reviews || [];
      return {
        ...cacheado,
        corregida: query !== escrita ? query : cacheado.corregida ?? null,
        reviews: reviewsActualizadas,
        desde_cache: true,
        latencia_ms: duracionCache,
      };
    }
  }

  estadisticasSistema.cache_misses++;
  await registrarLog("INFO", "API", `Iniciando búsqueda en vivo para "${query}"...`);

  // Si lo escrito no se conocía, quizás sí lo corregido; lo de las tiendas lo va reemplazando
  anticipar(query);

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
  const hayIA = GEMINI_API_KEY || Deno.env.get("AZURE_OPENAI_API_KEY") || fichaConocida(query);
  const alLlegarTienda = (ofertas: any[]) => avisar({ tipo: "ofertas", ofertas });

  const otroNombre = (f: any) => nombresDistintos(query, f.nombre || "", f.marca || "");
  const fichaPendiente = (hayIA ? generarFichaFragancia(query, GEMINI_API_KEY) : Promise.resolve(null)).catch(() => null);
  // La ficha se envía apenas está, salvo que su nombre no calce con lo buscado: eso se resuelve con las tiendas
  fichaPendiente.then((f) => f && !otroNombre(f) && avisar({ tipo: "ficha", ficha: f }));
  const preciosPendientes = buscarPreciosConPython(query, alLlegarTienda);
  preciosPendientes.then(() => avisar({ tipo: "tiendas" }));
  let [precios, ficha] = await Promise.all([preciosPendientes, fichaPendiente]);

  const deLaIA = ficha;
  ficha = await fichaConfiable(query, ficha, precios || [], GEMINI_API_KEY);
  // Falta enviarla si salió de las tiendas, o si es la de la IA con otro nombre y se aceptó (ninguna tienda lo tiene)
  if (ficha && (ficha !== deLaIA || otroNombre(ficha))) avisar({ tipo: "ficha", ficha });

  // Ninguna tienda lo encontró, pero la IA lo reconoció con otro nombre (mal escrito de una forma que la
  // corrección no conoce): se busca de nuevo por su nombre oficial
  if (!literal && !precios?.length && ficha?.nombre) {
    const marca = (ficha.marca || "").trim();
    const oficial = ficha.nombre.toLowerCase().includes(marca.toLowerCase()) ? ficha.nombre : `${marca} ${ficha.nombre}`;
    if (claveFicha(oficial) !== claveFicha(query)) {
      avisar({ tipo: "corregida", consulta: oficial });
      precios = await buscarPreciosConPython(oficial, alLlegarTienda);
      if (precios?.length) query = oficial;
    }
  }

  const listaPrecios = precios || [];
  const historial = await guardarEnHistorial(query, listaPrecios);

  const mapaReviews = await cargarReviews();
  const key = query.toLowerCase().trim();
  const reviews = mapaReviews[key] || [];
  const duracionTotal = Date.now() - inicioTotal;
  const corregida = query !== escrita ? query : null;

  const respuesta = {
    success: true,
    query,
    // Lo que se buscó en vez de lo escrito, para avisarle al usuario y dejarlo buscar tal cual
    corregida,
    desde_cache: false,
    latencia_ms: duracionTotal,
    mensaje: `${listaPrecios.length} resultado(s) encontrado(s) en múltiples tiendas (${(duracionTotal / 1000).toFixed(1)}s).`,
    precios: listaPrecios,
    ficha,
    historial,
    reviews,
    sucursales: await obtenerSucursales(),
  };

  if (listaPrecios.length > 0 || ficha) {
    guardarEnCache(cacheKey, respuesta);
    guardarEnCache(`buscar:${query.toLowerCase()}`, respuesta);
    await guardarPerfumeDescubiertoEnCatalogo(query, listaPrecios, ficha);
  }
  // Solo si las tiendas respondieron: un resultado vacío por una caída no debe borrar lo que se sabía
  if (listaPrecios.length > 0) {
    await guardarResultadoConocido([escrita, cacheKey.slice("buscar:".length), query], { precios: listaPrecios, ficha, historial });
  }

  await registrarLog(
    "SUCCESS",
    "API",
    `Búsqueda "${query}" finalizada (${listaPrecios.length} precios, ficha: ${ficha ? "Sí" : "No"}, alérgenos: ${ficha?.alergenos_detectados?.length || 0})`,
    duracionTotal
  );

  return respuesta;
}

const opcionesDeBusqueda = (c: any) => ({ sinCache: c.req.query("nocache") === "1", literal: c.req.query("literal") === "1" });

app.get("/api/buscar", async (c) => {
  const query = c.req.query("q")?.trim();
  if (!query || query.length < 2) {
    return c.json({ success: false, mensaje: "Parámetro 'q' requerido (mínimo 2 caracteres)." }, 400);
  }
  return c.json(await buscarCompleto(query, opcionesDeBusqueda(c)));
});

// La misma búsqueda, entregada por partes (una línea JSON por evento): las ofertas de cada tienda apenas responde,
// la ficha cuando está y, al final, la respuesta completa de /api/buscar con tipo "fin"
app.get("/api/buscar-vivo", (c) => {
  const query = c.req.query("q")?.trim();
  if (!query || query.length < 2) {
    return c.json({ success: false, mensaje: "Parámetro 'q' requerido (mínimo 2 caracteres)." }, 400);
  }
  const codificador = new TextEncoder();
  const cuerpo = new ReadableStream({
    async start(control) {
      const enviar = (evento: any) => {
        try {
          control.enqueue(codificador.encode(JSON.stringify(evento) + "\n"));
        } catch {
          // El navegador cerró la conexión: la búsqueda termina igual para dejar el resultado en caché
        }
      };
      try {
        enviar({ tipo: "fin", ...(await buscarCompleto(query, opcionesDeBusqueda(c), enviar)) });
      } catch (err: any) {
        enviar({ tipo: "fin", success: false, mensaje: `La búsqueda falló: ${err.message}` });
      }
      try { control.close(); } catch { /* ya cerrada */ }
    },
  });
  // no-transform: sin él Deno comprime la respuesta y junta las líneas en vez de enviarlas una a una
  return new Response(cuerpo, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
});

// ─────────────────────────────────────────────
//  GET /api/comparar?p1=nombre1&p2=nombre2
//  Comparador Lado a Lado entre 2 perfumes (reutiliza caché individual y ordena ofertas)
// ─────────────────────────────────────────────
async function obtenerDatosPerfumeParaDuelo(nombre: string, apiKey?: string, delayIaMs = 0) {
  nombre = corregirBusqueda(nombre, await nombresConocidos()) || nombre;
  const keyIndividual = `buscar:${nombre.toLowerCase().trim()}`;
  const cacheIndividual = obtenerDeCache(keyIndividual);

  let preciosRaw: any[] = [];
  let ficha: any = null;

  if (cacheIndividual && Array.isArray(cacheIndividual.precios)) {
    preciosRaw = cacheIndividual.precios;
    ficha = cacheIndividual.ficha || (apiKey ? await generarFichaFragancia(nombre, apiKey) : null);
  } else {
    const [preciosObtenidos, fichaObtenida] = await Promise.all([
      buscarPreciosConPython(nombre),
      (async () => {
        if (!apiKey) return construirFichaRespaldoDiferenciada(nombre);
        // La espera evita dos llamadas simultáneas a la IA; con la ficha ya guardada no hay llamada
        if (delayIaMs > 0 && !fichaConocida(nombre)) await new Promise((r) => setTimeout(r, delayIaMs));
        return generarFichaFragancia(nombre, apiKey);
      })(),
    ]);
    preciosRaw = preciosObtenidos || [];
    ficha = await fichaConfiable(nombre, fichaObtenida, preciosRaw, apiKey || "");

    const historial = await guardarEnHistorial(nombre, preciosRaw);
    if (preciosRaw.length > 0 || ficha) {
      guardarEnCache(keyIndividual, {
        success: true,
        query: nombre,
        desde_cache: false,
        precios: preciosRaw,
        ficha,
        historial,
        reviews: [],
        sucursales: await obtenerSucursales(),
      });
    }
  }

  // Filtrar y ordenar precios de menor a mayor para que índice 0 sea siempre el Mejor Precio
  const preciosOrdenados = [...preciosRaw].sort((a, b) => {
    const pa = typeof a.precio === "number" && a.precio > 0 ? a.precio : Infinity;
    const pb = typeof b.precio === "number" && b.precio > 0 ? b.precio : Infinity;
    return pa - pb;
  });

  const conPrecioValido = preciosOrdenados.filter(
    (x) => typeof x.precio === "number" && x.precio > 0 && x.stock !== "Agotado"
  );
  const mejorPrecio = conPrecioValido.length > 0 ? conPrecioValido[0].precio : null;

  await guardarPerfumeDescubiertoEnCatalogo(nombre, preciosOrdenados, ficha);

  return {
    precios: preciosOrdenados,
    mejorPrecio,
    ficha,
  };
}

app.get("/api/comparar", async (c) => {
  const inicioTotal = Date.now();
  const p1 = c.req.query("p1")?.trim();
  const p2 = c.req.query("p2")?.trim();

  if (!p1 || !p2) {
    return c.json(
      { success: false, mensaje: "Se requieren los parámetros 'p1' y 'p2' para comparar." },
      400
    );
  }

  estadisticasSistema.total_comparaciones++;
  const cacheKey = `comparar:${p1.toLowerCase()}::${p2.toLowerCase()}`;
  const cacheado = obtenerDeCache(cacheKey);
  if (cacheado) {
    estadisticasSistema.cache_hits++;
    const dur = Date.now() - inicioTotal;
    await registrarLog("CACHE", "CACHE", `Comparación desde caché: "${p1}" vs "${p2}"`, dur);
    return c.json({ ...cacheado, desde_cache: true, latencia_ms: dur });
  }

  estadisticasSistema.cache_misses++;
  await registrarLog("INFO", "API", `Comparando frente a frente: "${p1}" vs "${p2}"`);
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  const [datosP1, datosP2, mapaReviews] = await Promise.all([
    obtenerDatosPerfumeParaDuelo(p1, GEMINI_API_KEY, 0),
    obtenerDatosPerfumeParaDuelo(p2, GEMINI_API_KEY, 280),
    cargarReviews(),
  ]);

  const revP1 = mapaReviews[p1.toLowerCase().trim()] || [];
  const revP2 = mapaReviews[p2.toLowerCase().trim()] || [];
  const duracionTotal = Date.now() - inicioTotal;

  const respuesta = {
    success: true,
    latencia_ms: duracionTotal,
    p1: {
      nombre: datosP1.ficha?.nombre || p1,
      precios: datosP1.precios,
      mejorPrecio: datosP1.mejorPrecio,
      ficha: datosP1.ficha,
      reviews: revP1,
    },
    p2: {
      nombre: datosP2.ficha?.nombre || p2,
      precios: datosP2.precios,
      mejorPrecio: datosP2.mejorPrecio,
      ficha: datosP2.ficha,
      reviews: revP2,
    },
  };

  guardarEnCache(cacheKey, respuesta);
  await registrarLog("SUCCESS", "API", `Comparación "${p1}" vs "${p2}" completada`, duracionTotal);

  return c.json(respuesta);
});

// Ficha olfativa de un perfume, aunque nunca se haya buscado. El comparador la pide cuando la oferta elegida es otro
// perfume que el buscado ("Angel Nova Fruitee" al comparar "A*Men") o el perfume quedó sin ficha. Sale de las fichas
// guardadas o se le pide a la IA (y queda guardada); `ofertas` son las de ese perfume, por si la IA no lo conoce y
// hay que armarla con lo que publican las tiendas.
app.post("/api/ficha", async (c) => {
  const cuerpo = await c.req.json().catch(() => ({}));
  const nombre = String(cuerpo?.nombre || "").trim().slice(0, 150);
  if (nombre.length < 2) return c.json({ success: false, mensaje: "Falta el nombre del perfume." }, 400);
  // Solo los textos que usa la evidencia de tiendas, con largo acotado: vienen del navegador
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const ofertas = (Array.isArray(cuerpo?.ofertas) ? cuerpo.ofertas : []).slice(0, 5).map((o: any) => ({
    nombre: texto(o?.nombre, 200) || "",
    tienda: texto(o?.tienda, 60) || "",
    notasTienda: texto(o?.notasTienda, 600),
    familiaTienda: texto(o?.familiaTienda, 120),
    ingredientes: texto(o?.ingredientes, 3000),
    descripcionTienda: texto(o?.descripcionTienda, 1500),
  }));

  const inicio = Date.now();
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
  const hayIA = GEMINI_API_KEY || Deno.env.get("AZURE_OPENAI_API_KEY");
  let ficha = hayIA || fichaConocida(nombre) ? await generarFichaFragancia(nombre, GEMINI_API_KEY).catch(() => null) : null;
  ficha = await fichaConfiable(nombre, ficha, ofertas, GEMINI_API_KEY);
  await registrarLog("INFO", "API", `Ficha para el comparador: "${nombre}" (${ficha ? ficha.nombre : "sin ficha"})`, Date.now() - inicio);
  return c.json({ success: true, ficha });
});

// ─────────────────────────────────────────────
//  /api/reviews: leer (cualquiera), publicar y borrar (solo con cuenta, cada uno las suyas)
// ─────────────────────────────────────────────
const guardarReviews = (mapa: Record<string, Review[]>) =>
  Deno.writeTextFile(ARCHIVO_REVIEWS, JSON.stringify(mapa, null, 2));

app.get("/api/reviews", async (c) => {
  const clave = claveResena(c.req.query("perfume") || "");
  if (!clave) return c.json({ reviews: [], mias: [] });
  const usuario = await cuentas.usuarioDe(c);
  const mapa = await cargarReviewsConAutor();
  // También las escritas con el nombre con o sin concentración (depende de la oferta que se veía al escribirla)
  const lista = clavesDelMismoPerfume(clave, Object.keys(mapa))
    .flatMap((k) => mapa[k])
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return c.json({
    reviews: lista.map(({ autorId: _, ...r }) => r),
    mias: usuario ? lista.filter((r) => r.autorId === usuario.id).map((r) => r.id) : [],
  });
});

app.post("/api/reviews", async (c) => {
  if (!origenPermitido(c.req.header("origin") || "")) return c.json({ success: false, mensaje: "Origen no permitido." }, 403);
  const usuario = await cuentas.usuarioDe(c);
  if (!usuario) return c.json({ success: false, mensaje: "Entra a tu cuenta para publicar una reseña." }, 401);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, mensaje: "Datos inválidos." }, 400);
  }
  const datos = validarResena(body);
  if (typeof datos === "string") return c.json({ success: false, mensaje: datos }, 400);
  const nuevaReview: Review = {
    id: crypto.randomUUID(),
    ...datos,
    autorId: usuario.id,
    fecha: new Date().toISOString().split("T")[0],
  };
  const clave = claveResena(datos.perfume);
  // Una reseña por cuenta y perfume: publicar otra vez reemplaza la anterior
  await enCola(async () => {
    const mapa = await cargarReviewsConAutor();
    for (const k of clavesDelMismoPerfume(clave, Object.keys(mapa))) {
      mapa[k] = mapa[k].filter((r) => r.autorId !== usuario.id);
      if (!mapa[k].length) delete mapa[k];
    }
    mapa[clave] = [nuevaReview, ...(mapa[clave] || [])];
    await guardarReviews(mapa);
  });
  await registrarLog("SUCCESS", "API", `Nueva reseña para "${datos.perfume}" (${datos.rating}★)`);
  const { autorId: _, ...publica } = nuevaReview;
  return c.json({ success: true, review: publica });
});

app.delete("/api/reviews/:id", async (c) => {
  if (!origenPermitido(c.req.header("origin") || "")) return c.json({ success: false, mensaje: "Origen no permitido." }, 403);
  const usuario = await cuentas.usuarioDe(c);
  if (!usuario) return c.json({ success: false, mensaje: "Inicia sesión." }, 401);
  const id = c.req.param("id");
  const borrada = await enCola(async () => {
    const mapa = await cargarReviewsConAutor();
    let encontrada = false;
    for (const clave of Object.keys(mapa)) {
      const antes = mapa[clave].length;
      mapa[clave] = mapa[clave].filter((r) => !(r.id === id && r.autorId === usuario.id));
      if (mapa[clave].length !== antes) encontrada = true;
      if (!mapa[clave].length) delete mapa[clave];
    }
    if (encontrada) await guardarReviews(mapa);
    return encontrada;
  });
  return borrada ? c.json({ success: true }) : c.json({ success: false, mensaje: "Esa reseña no es tuya o ya no existe." }, 404);
});

// Al borrar una cuenta se borran también sus reseñas
async function borrarReviewsDe(usuarioId: string) {
  await enCola(async () => {
    const mapa = await cargarReviewsConAutor();
    for (const clave of Object.keys(mapa)) {
      mapa[clave] = mapa[clave].filter((r) => r.autorId !== usuarioId);
      if (!mapa[clave].length) delete mapa[clave];
    }
    await guardarReviews(mapa);
  });
}

// ─────────────────────────────────────────────
//  CATÁLOGO AUTO-APRENDIDO PERSISTENTE + BUSCADOR POR NOTAS Y FILTROS
//  Permite buscar perfumes que tengan p.ej. "Chocolate", "Madera" o AMBOS sin saber el nombre
// ─────────────────────────────────────────────
const ARCHIVO_CATALOGO_DESCUBIERTOS = "./catalogo_descubiertos.json";

async function cargarCatalogoDescubiertos(): Promise<any[]> {
  try {
    const raw = await Deno.readTextFile(ARCHIVO_CATALOGO_DESCUBIERTOS);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Etiquetas del catálogo que salen de la ficha de un perfume (las que usan los filtros). Se calculan igual al
// aprender un perfume, al volver a buscarlo y al re-etiquetar el catálogo completo.
function etiquetasDeFicha(ficha: any) {
  const notas = [...(ficha.notas_salida || []), ...(ficha.notas_corazon || []), ...(ficha.notas_fondo || [])];
  const ocasiones = ocasionesCatalogoDesde(ficha.ocasiones || []);
  return {
    familia: familiaCatalogoDesde(ficha.familia_olfativa || ""),
    notas: etiquetasDePerfume(notas, ficha.acordes_principales || []),
    // Todas las notas, en orden de salida a fondo (antes solo las 6 primeras: las de fondo nunca se guardaban)
    notasDetalle: notas,
    estaciones: ficha.estaciones || [],
    ocasiones,
    ocasion: ocasiones[0] || "Oficina & Diario",
    duracionHoras: ficha.duracion_horas || 8,
    proyeccion: ficha.proyeccion === "Bestia" ? "Bestia" : ficha.proyeccion === "Alta" ? "Alta" : "Moderada",
    alergenosIds: (ficha.alergenos_detectados || []).map((a: any) => a.id),
  };
}

// ─────────────────────────────────────────────
//  MOTOR AUTO-APRENDIZAJE DE MARCAS Y PERFUMES
//  Detecta, normaliza y aprende automáticamente cualquier marca nueva que se busque o registre
// ─────────────────────────────────────────────
const DICCIONARIO_MARCAS_CANONICAS: Array<{ marca: string; keywords: string[] }> = [
  { marca: "Carolina Herrera", keywords: ["carolina herrera", "good girl", "bad boy", "212 vip", "212 men", "212 heroes", "212 sexy", "ch men", "ch pasion"] },
  { marca: "Giorgio Armani", keywords: ["giorgio armani", "armani", "acqua di gio", "acqua di giò", "stronger with you", "my way", "armani code", "si passioni"] },
  { marca: "Jean Paul Gaultier", keywords: ["jean paul gaultier", "gaultier", "le male", "le beau", "scandal", "la belle", "gaultier divine"] },
  { marca: "Dolce & Gabbana", keywords: ["dolce & gabbana", "dolce gabbana", "d&g", "light blue", "the one", "devotion", "pour homme intenso", "k by dolce"] },
  { marca: "Yves Saint Laurent", keywords: ["yves saint laurent", "saint laurent", "ysl", "black opium", "libre", "myslf", "kouros", "la nuit de l'homme"] },
  { marca: "Rabanne", keywords: ["paco rabanne", "rabanne", "1 million", "one million", "invictus", "phantom", "fame", "olympea", "black xs"] },
  { marca: "Dior", keywords: ["christian dior", "dior", "sauvage", "dior homme", "miss dior", "j'adore", "jadore", "fahrenheit", "poison"] },
  { marca: "Chanel", keywords: ["chanel", "bleu de chanel", "coco mademoiselle", "allure homme", "chance chanel"] },
  { marca: "Versace", keywords: ["versace", "eros", "dylan blue", "bright crystal", "crystal noir"] },
  { marca: "Tom Ford", keywords: ["tom ford", "black orchid", "ombre leather", "tobacco vanille", "oud wood", "lost cherry"] },
  { marca: "Valentino", keywords: ["valentino", "born in roma", "valentino uomo", "voce viva"] },
  { marca: "Lattafa", keywords: ["lattafa", "khamrah", "asad", "yara", "badee al oud", "fakhar", "qaed", "ramz"] },
  { marca: "Armaf", keywords: ["armaf", "club de nuit", "odyssey"] },
  { marca: "Afnan", keywords: ["afnan", "9pm", "supremacy", "turathi"] },
  { marca: "Rasasi", keywords: ["rasasi", "hawas", "la yuqawam"] },
  { marca: "Al Haramain", keywords: ["al haramain", "amber oud", "detour noir"] },
  { marca: "Mugler", keywords: ["thierry mugler", "mugler", "a*men", "angel men", "alien"] },
  { marca: "Lancôme", keywords: ["lancôme", "lancome", "la vie est belle", "idole", "tresor"] },
  { marca: "Calvin Klein", keywords: ["calvin klein", "ck one", "ck be", "eternity", "euphoria"] },
  { marca: "Nautica", keywords: ["nautica", "voyage"] },
  { marca: "Hermès", keywords: ["hermès", "hermes", "terre d'hermes", "terre d'hermès", "h24", "twilly"] },
  { marca: "Viktor&Rolf", keywords: ["viktor&rolf", "viktor & rolf", "spicebomb", "flowerbomb"] },
  { marca: "Lacoste", keywords: ["lacoste", "l.12.12"] },
  { marca: "Trussardi", keywords: ["trussardi", "my name"] },
  { marca: "Billie Eilish", keywords: ["billie eilish", "eilish"] },
  { marca: "Hugo Boss", keywords: ["hugo boss", "boss bottled", "boss the scent", "hugo man", "hugo just different"] },
  { marca: "Montblanc", keywords: ["montblanc", "mont blanc", "explorer", "legend", "individuel"] },
  { marca: "Givenchy", keywords: ["givenchy", "gentleman", "irresistible", "l'interdit"] },
  { marca: "Prada", keywords: ["prada", "paradoxe", "luna rossa", "l'homme prada"] },
  { marca: "Burberry", keywords: ["burberry", "burberry hero", "burberry her", "goddess"] },
  { marca: "Gucci", keywords: ["gucci", "gucci guilty", "gucci bloom", "gucci flora"] },
  { marca: "Azzaro", keywords: ["azzaro", "the most wanted", "wanted by night", "azzaro chrome"] },
  { marca: "Ralph Lauren", keywords: ["ralph lauren", "polo blue", "polo black", "polo red", "polo green"] },
  { marca: "Creed", keywords: ["creed", "aventus", "silver mountain water", "green irish tweed"] },
  { marca: "Parfums de Marly", keywords: ["parfums de marly", "layton", "althair", "delina", "pegasus"] },
  { marca: "Loewe", keywords: ["loewe", "solo loewe", "7 loewe", "loewe esencia"] },
  { marca: "Kenzo", keywords: ["kenzo", "flower by kenzo", "kenzo homme"] },
  { marca: "Moschino", keywords: ["moschino", "toy boy", "toy 2"] },
  { marca: "Bvlgari", keywords: ["bvlgari", "bulgari", "man in black", "omnia", "aqva"] },
  { marca: "Guerlain", keywords: ["guerlain", "l'homme ideal", "shalimar", "mon guerlain"] },
  { marca: "Issey Miyake", keywords: ["issey miyake", "l'eau d'issey"] },
  { marca: "Narciso Rodriguez", keywords: ["narciso rodriguez", "for her"] },
  { marca: "Antonio Banderas", keywords: ["antonio banderas", "the icon", "blue seduction", "king of seduction"] },
  { marca: "Halloween", keywords: ["halloween"] },
  { marca: "Tous", keywords: ["tous"] },
  { marca: "Natura", keywords: ["natura", "kaiak", "essencial", "homem"] },
  { marca: "Benetton", keywords: ["benetton", "united dreams"] },
  { marca: "Tommy Hilfiger", keywords: ["tommy hilfiger", "tommy girl", "impact"] },
  { marca: "Coach", keywords: ["coach"] },
  { marca: "Jimmy Choo", keywords: ["jimmy choo"] },
  { marca: "Ferragamo", keywords: ["salvatore ferragamo", "ferragamo"] },
];

const PALABRAS_GENERICAS_RETAIL = new Set([
  "perfume", "fragancia", "colonia", "hombre", "mujer", "unisex", "para", "de", "del", "la", "el",
  "los", "las", "eau", "parfum", "toilette", "edp", "edt", "edc", "parfums", "maison", "diseñador",
  "set", "estuche", "vaporisateur", "spray", "natural", "original", "tester", "ml", "100ml", "50ml",
  "200ml", "125ml", "90ml", "80ml", "75ml", "60ml", "30ml", "150ml", "105ml",
]);

function capitalizarPalabras(texto: string): string {
  return texto
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function detectarYNormalizarMarca(nombreQuery: string, precios: any[], fichaMarca?: string): string {
  const titulosTienda = (precios || []).slice(0, 3).map((p) => p?.nombre || "").join(" ");
  const textoCombinado = `${fichaMarca || ""} ${nombreQuery || ""} ${titulosTienda}`.toLowerCase();

  // 1. Verificar diccionario canónico (detecta marcas multi-palabra y fragancias famosas aunque el usuario no escriba la marca)
  for (const entrada of DICCIONARIO_MARCAS_CANONICAS) {
    if (entrada.keywords.some((kw) => textoCombinado.includes(kw))) {
      return entrada.marca;
    }
  }

  // 2. Si la ficha IA trajo una marca explícita válida y no genérica, normalizarla en Title Case
  if (fichaMarca && fichaMarca.trim().length >= 2) {
    const fmLower = fichaMarca.trim().toLowerCase();
    if (!PALABRAS_GENERICAS_RETAIL.has(fmLower) && fmLower !== "maison parfums") {
      return capitalizarPalabras(fichaMarca);
    }
  }

  // 3. Extraer dinámicamente la marca desde el título de la tienda o desde la búsqueda del usuario
  const fuente = `${nombreQuery} ${precios?.[0]?.nombre || ""}`;
  const tokensLimpios = fuente
    .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ&\s]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !PALABRAS_GENERICAS_RETAIL.has(tok.toLowerCase()));

  if (tokensLimpios.length > 0) {
    return capitalizarPalabras(tokensLimpios[0]);
  }

  return "Diseñador";
}

function limpiarNombrePerfume(nombreRaw: string, marcaOficial: string): string {
  let limpio = (nombreRaw || "")
    .replace(/\b(perfume|para|hombre|mujer|unisex|eau de parfum|eau de toilette|edp|edt|vaporisateur|spray|\d+\s*ml)\b/gi, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Si el nombre empieza repetido con la marca (ej: "Dior Dior Homme Intense" o "Carolina Herrera Good Girl"), dejar solo el nombre de la fragancia
  const marcaRegex = new RegExp(`^${marcaOficial.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  limpio = limpio.replace(marcaRegex, "").trim();
  limpio = limpio.replace(marcaRegex, "").trim();

  return limpio.length >= 2 ? capitalizarPalabras(limpio) : capitalizarPalabras(nombreRaw);
}

async function guardarPerfumeDescubiertoEnCatalogo(nombreQuery: string, precios: any[], ficha: any) {
  try {
    if (esTerminoNoFragancia(nombreQuery)) return null;
    const validos = (precios || []).filter((p) => typeof p.precio === "number" && p.precio > 0);
    // Sin precio de una tienda real no se agrega al catálogo (evita perfumes inexistentes o con precio inventado)
    if (validos.length === 0) return null;

    validos.sort((a, b) => a.precio - b.precio);
    // Con ficha, la oferta del catálogo tiene que ser de ese perfume. La más barata de la búsqueda puede ser otra
    // versión o un body spray: "Eros" quedó enlazado a Eros Flame y "Black Orchid" a su body spray.
    const delPerfume = ficha?.nombre
      ? validos.filter((p) => esMismoPerfume(ficha.nombre, p.nombre, ficha.marca, ficha.genero))
      : validos;
    if (delPerfume.length === 0) return null;
    // Una recarga, un set o un mini suele ser lo más barato, pero no es el precio del perfume ("Sauvage" quedó a
    // $103.300 por una recarga de 300 ml)
    const formatoNormal = delPerfume.filter((p) => !/\b(recarga|refill|set|estuche|kit|cofre|minis?|miniatura|tester|travel|body|gel|desodorante)\b/i.test(`${p.nombre} ${p.url || ""}`));
    const candidatas = formatoNormal.length ? formatoNormal : delPerfume;
    const mejorOferta = candidatas.find((p) => p.stock !== "Agotado") || candidatas[0];
    const marcaOficial = detectarYNormalizarMarca(nombreQuery, validos, ficha?.marca);
    const nombreBase = ficha?.nombre && !ficha.nombre.toLowerCase().includes("perfume ")
      ? ficha.nombre
      : mejorOferta?.nombre || nombreQuery;
    const nombreOficial = limpiarNombrePerfume(nombreBase, marcaOficial);

    const idSlug = `${marcaOficial}-${nombreOficial}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const todasNotasRaw = [
      ...(ficha?.notas_salida || []),
      ...(ficha?.notas_corazon || []),
      ...(ficha?.notas_fondo || []),
    ];

    const concRaw = (ficha?.concentracion || mejorOferta?.nombre || nombreQuery || "").toLowerCase();
    const concentracion = concRaw.includes("elixir") || (concRaw.includes("parfum") && !concRaw.includes("eau de parfum"))
      ? "Parfum / Elixir"
      : concRaw.includes("toilette") || concRaw.includes("edt")
      ? "Eau de Toilette (EDT)"
      : "Eau de Parfum (EDP)";

    const genRaw = (ficha?.genero || mejorOferta?.nombre || nombreQuery || "").toLowerCase();
    const genero = genRaw.includes("femenin") || genRaw.includes("mujer") || genRaw.includes("woman") || genRaw.includes("femme")
      ? "Femenino"
      : genRaw.includes("masculin") || genRaw.includes("hombre") || genRaw.includes("homme") || genRaw.includes("men")
      ? "Masculino"
      : "Unisex";

    const paletaColores = [
      { primario: "#312e81", secundario: "#1e1b4b", acento: "#f59e0b", forma: "clasico" },
      { primario: "#065f46", secundario: "#064e3b", acento: "#34d399", forma: "cilindro" },
      { primario: "#831843", secundario: "#500724", acento: "#f472b6", forma: "esfera" },
      { primario: "#78350f", secundario: "#451a03", acento: "#fbbf24", forma: "estilizado" },
    ];
    const hashColor = idSlug.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % paletaColores.length;

    const nuevoItem = {
      id: `dyn-${idSlug}`,
      nombre: nombreOficial,
      subtitulo: `${concentracion.split(" ")[0]} · ${todasNotasRaw.slice(0, 3).join(", ") || ficha?.familia_olfativa || "Registrado en Tiendas"}`,
      marca: marcaOficial,
      precioReferencia: mejorOferta.precio,
      // Tamaño desde el nombre o la URL del producto (ej: "...-75-ml-..."); null si la tienda no lo indica
      ml: extraerMl(mejorOferta.nombre) ?? extraerMl((mejorOferta.url || "").replace(/[-_]/g, " ")),
      concentracion,
      genero,
      // Sin ficha no se inventan etiquetas (antes salían del nombre del perfume): queda "Sin clasificar"
      ...etiquetasDeFicha(ficha || {}),
      imagen: await (async () => {
        const imgUrl = mejorOferta?.imagen || null;
        if (!imgUrl?.startsWith("http")) return imgUrl;
        return await descargarImagenLocal(imgUrl, `dyn-${idSlug}`) || imgUrl;
      })(),
      tiendaMejorPrecio: mejorOferta?.tienda || null,
      urlMejorPrecio: mejorOferta?.url || null,
      descubiertoEnVivo: true,
      colorFrasco: paletaColores[hashColor],
    };

    const hoy = new Date().toISOString().split("T")[0];
    return await enCola(async () => {
      const actuales = await cargarCatalogoDescubiertos();
      const idx = actuales.findIndex(
        // El mismo producto de la tienda es la misma entrada aunque el nombre haya salido distinto ("One Million" / "1 Million")
        // y también el mismo nombre con la marca delante ("Versace Eros" / "Eros")
        (x) => x.id === nuevoItem.id ||
          limpiarNombrePerfume(x.nombre, marcaOficial).toLowerCase() === nuevoItem.nombre.toLowerCase() ||
          mismoProducto(x.urlMejorPrecio, nuevoItem.urlMejorPrecio)
      );

      if (idx < 0) {
        const nuevo = { ...nuevoItem, fechaPrecio: hoy };
        await Deno.writeTextFile(ARCHIVO_CATALOGO_DESCUBIERTOS, JSON.stringify([nuevo, ...actuales].slice(0, 150), null, 2));
        return nuevo;
      }

      // Perfume ya en el catálogo: solo se re-cotiza su mismo producto (misma URL). Nunca se reemplaza por la
      // oferta más barata de la búsqueda, que puede ser otro tamaño, un set o una versión distinta.
      const existente = actuales[idx];
      const actualizado = { ...existente };
      const mismo = validos.find((p) => mismoProducto(p.url, existente.urlMejorPrecio));
      if (mismo) {
        actualizado.precioReferencia = mismo.precio;
        actualizado.stock = mismo.stock;
        actualizado.fechaPrecio = hoy;
      }
      // Con una ficha se re-etiqueta siempre: el catálogo guardado puede traer etiquetas del método antiguo
      if (ficha && nuevoItem.notasDetalle.length > 0) {
        Object.assign(actualizado, { subtitulo: nuevoItem.subtitulo }, etiquetasDeFicha(ficha));
      }
      actuales[idx] = actualizado;
      await Deno.writeTextFile(ARCHIVO_CATALOGO_DESCUBIERTOS, JSON.stringify(actuales, null, 2));
      return actualizado;
    });
  } catch {
    return null;
  }
}

// Enciclopedia de respaldo por Notas Olfativas (incluyendo Chocolate, Madera, Café, Tabaco, etc.)
const ENCICLOPEDIA_POR_NOTAS: Array<{
  nombre: string;
  marca: string;
  notasClave: string[];
  notasDetalle: string[];
  familia: string;
  concentracion: string;
  genero: string;
  duracion_horas: number;
  proyeccion: string;
}> = [
  {
    nombre: "Bad Boy",
    marca: "Carolina Herrera",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Vainilla / Haba Tonka", "Pimienta / Especias", "Bergamota / Limón"],
    notasDetalle: ["Cacao", "Madera de Cedro", "Haba Tonka", "Pimienta Negra", "Salvia", "Madera de Ámbar"],
    familia: "Ámbar / Especiado",
    concentracion: "Eau de Toilette (EDT)",
    genero: "Masculino",
    duracion_horas: 9,
    proyeccion: "Alta",
  },
  {
    nombre: "Dior Homme Intense",
    marca: "Dior",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Jazmín / Rosa / Iris", "Ámbar / Ambroxan"],
    notasDetalle: ["Cacao Atalcado", "Cedro de Virginia", "Vetiver Amaderado", "Iris de Toscana", "Semilla de Ambreta"],
    familia: "Amaderado / Aromático",
    concentracion: "Eau de Parfum (EDP)",
    genero: "Masculino",
    duracion_horas: 10,
    proyeccion: "Alta",
  },
  {
    nombre: "Good Girl",
    marca: "Carolina Herrera",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Café / Espresso", "Vainilla / Haba Tonka", "Jazmín / Rosa / Iris"],
    notasDetalle: ["Cacao Rico", "Sándalo", "Madera de Cachemira", "Café", "Haba Tonka", "Almendra"],
    familia: "Dulce / Gourmand",
    concentracion: "Eau de Parfum (EDP)",
    genero: "Femenino",
    duracion_horas: 10,
    proyeccion: "Alta",
  },
  {
    nombre: "A*Men (Angel Men)",
    marca: "Mugler",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Café / Espresso", "Caramelo / Miel", "Vainilla / Haba Tonka"],
    notasDetalle: ["Chocolate Amargo", "Pachulí Amaderado", "Café Tostado", "Caramelo", "Vainilla", "Maderas Cálidas"],
    familia: "Dulce / Gourmand",
    concentracion: "Eau de Toilette (EDT)",
    genero: "Masculino",
    duracion_horas: 11,
    proyeccion: "Bestia",
  },
  {
    nombre: "Black XS",
    marca: "Rabanne",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Caramelo / Miel", "Pimienta / Especias", "Bergamota / Limón"],
    notasDetalle: ["Praliné Achocolatado", "Palo de Rosa", " Pachulí Amaderado", "Canela", "Cardamomo Negro", "Limón"],
    familia: "Amaderado / Aromático",
    concentracion: "Eau de Toilette (EDT)",
    genero: "Masculino",
    duracion_horas: 8,
    proyeccion: "Alta",
  },
  {
    nombre: "Khamrah Qahwa",
    marca: "Lattafa",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Café / Espresso", "Vainilla / Haba Tonka", "Caramelo / Miel", "Pimienta / Especias"],
    notasDetalle: ["Praliné de Cacao", "Café Arábica", "Maderas Ambaradas", "Canela", "Dátiles", "Vainilla"],
    familia: "Dulce / Gourmand",
    concentracion: "Eau de Parfum (EDP)",
    genero: "Unisex",
    duracion_horas: 12,
    proyeccion: "Bestia",
  },
  {
    nombre: "1 Million Lucky",
    marca: "Rabanne",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Caramelo / Miel", "Frutal / Coco / Manzana"],
    notasDetalle: ["Avellana Tostada y Cacao", "Madera de Cedro", "Madera de Cachemira", "Miel", "Ciruela", "Pachulí"],
    familia: "Amaderado / Aromático",
    concentracion: "Eau de Toilette (EDT)",
    genero: "Masculino",
    duracion_horas: 9,
    proyeccion: "Alta",
  },
  {
    nombre: "Valentino Uomo",
    marca: "Valentino",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Café / Espresso", "Tabaco / Cuero / Incienso"],
    notasDetalle: ["Chocolate y Crema de Gianduja", "Madera de Cedro", "Granos de Café Tostado", "Cuero Suave", "Bergamota"],
    familia: "Amaderado / Aromático",
    concentracion: "Eau de Toilette (EDT)",
    genero: "Masculino",
    duracion_horas: 8,
    proyeccion: "Alta",
  },
  {
    nombre: "Black Orchid",
    marca: "Tom Ford",
    notasClave: ["Chocolate / Cacao", "Madera (Cedro / Sándalo / Oud)", "Pimienta / Especias", "Vainilla / Haba Tonka", "Tabaco / Cuero / Incienso"],
    notasDetalle: ["Chocolate Mexicano Oscuro", "Sándalo", "Pachulí", "Vetiver", "Incienso", "Trufa Negra", "Vainilla"],
    familia: "Ámbar / Especiado",
    concentracion: "Eau de Parfum (EDP)",
    genero: "Unisex",
    duracion_horas: 12,
    proyeccion: "Bestia",
  },
  {
    nombre: "Le Beau Le Parfum",
    marca: "Jean Paul Gaultier",
    notasClave: ["Madera (Cedro / Sándalo / Oud)", "Frutal / Coco / Manzana", "Vainilla / Haba Tonka", "Ámbar / Ambroxan"],
    notasDetalle: ["Madera de Sándalo", "Madera de Coco", "Haba Tonka", "Piña", "Ciprés", "Ámbar Gris"],
    familia: "Amaderado / Aromático",
    concentracion: "Eau de Parfum (EDP)",
    genero: "Masculino",
    duracion_horas: 10,
    proyeccion: "Alta",
  },
  {
    nombre: "Terre d'Hermès",
    marca: "Hermès",
    notasClave: ["Madera (Cedro / Sándalo / Oud)", "Bergamota / Limón", "Pimienta / Especias"],
    notasDetalle: ["Cedro del Atlas", "Vetiver Amaderado", "Naranja Amarga", "Pomelo", "Pimienta", "Benjuí"],
    familia: "Amaderado / Aromático",
    concentracion: "Eau de Toilette (EDT)",
    genero: "Masculino",
    duracion_horas: 9,
    proyeccion: "Alta",
  },
  {
    nombre: "Spicebomb Extreme",
    marca: "Viktor&Rolf",
    notasClave: ["Tabaco / Cuero / Incienso", "Vainilla / Haba Tonka", "Pimienta / Especias", "Madera (Cedro / Sándalo / Oud)"],
    notasDetalle: ["Tabaco Aromático", "Vainilla Negra", "Pimienta Negra", "Canela", "Comino", "Maderas Ámbar"],
    familia: "Ámbar / Especiado",
    concentracion: "Eau de Parfum (EDP)",
    genero: "Masculino",
    duracion_horas: 11,
    proyeccion: "Bestia",
  },
];

app.get("/api/catalogo", async (c) => {
  const descubiertos = await cargarCatalogoDescubiertos();
  const marcasAprendidas = Array.from(new Set(descubiertos.map((d) => d.marca).filter(Boolean)));
  return c.json({
    success: true,
    total: descubiertos.length,
    marcasAprendidas,
    items: descubiertos,
  });
});

// ─────────────────────────────────────────────
//  POST /api/indexar-knasta
//  Ejecuta el Spider/Crawler masivo de categorías (Estilo Knasta) en las 4 tiendas chilenas
// ─────────────────────────────────────────────
// Antes ejecutaba crawler_knasta.py, que sobrescribía catalogo_descubiertos.json y borraba los perfumes
// aprendidos de las búsquedas. Ahora lanza el refresco de precios en segundo plano y responde de inmediato.
app.post("/api/indexar-knasta", async (c) => {
  const items = await cargarCatalogoDescubiertos();
  const yaEnCurso = refrescoEnCurso;
  if (!yaEnCurso) refrescarCatalogo();
  return c.json({
    success: true,
    total: items.length,
    items,
    mensaje: yaEnCurso
      ? "Ya hay una actualización de precios en curso."
      : `Actualizando en segundo plano los precios de ${items.length} perfumes en las 4 tiendas. Los cambios aparecen al recargar.`,
  });
});

// ─────────────────────────────────────────────
//  REFRESCO DIARIO DEL CATÁLOGO (precios + historial)
//  Re-cotiza cada perfume con la misma búsqueda que usa la ficha en vivo, para que el historial
//  acumule un registro por producto y día aunque nadie lo busque.
// ─────────────────────────────────────────────
const ARCHIVO_ESTADO_REFRESCO = "./estado_refresco.json";
const ARCHIVO_CATALOGO_KNASTA = "../frontend/public/catalogo_knasta.json";
const INTERVALO_REFRESCO_MS = 24 * 60 * 60 * 1000;
let refrescoEnCurso = false;
const progresoRefresco = { total: 0, procesados: 0 };

async function refrescarCatalogo(limite?: number) {
  if (refrescoEnCurso) return null;
  refrescoEnCurso = true;
  const inicio = Date.now();
  const hoy = new Date().toISOString().split("T")[0];
  const clave = (x: any) => `${x.marca}|${x.nombre}`.toLowerCase();
  let reCotizados = 0;
  let sinMismoProducto = 0;
  let porUrl = 0;
  try {
    let indexados: any[] = [];
    try {
      indexados = JSON.parse(await Deno.readTextFile(ARCHIVO_CATALOGO_KNASTA));
    } catch {
      // Sin el catálogo indexado se refrescan solo los descubiertos
    }
    const unicos = new Map<string, any>();
    for (const x of [...indexados, ...(await cargarCatalogoDescubiertos())]) unicos.set(clave(x), x);
    // Con cientos de perfumes, re-cotizarlos todos cada día tomaría horas: se re-cotiza una tanda diaria, primero los
    // de precio más antiguo, así que el catálogo completo se recorre en pocos días
    const porDia = limite ?? Number(Deno.env.get("REFRESCO_POR_DIA") || 80);
    const entradas = Array.from(unicos.values())
      .sort((a, b) => String(a.fechaPrecio || "").localeCompare(String(b.fechaPrecio || "")))
      .slice(0, porDia);
    progresoRefresco.total = entradas.length;
    progresoRefresco.procesados = 0;
    await registrarLog("INFO", "SCRAPER", `Refresco de catálogo iniciado: ${entradas.length} perfumes`);

    // De a 2 a la vez para no saturar a las tiendas ni competir con las búsquedas de los usuarios, con una pausa entre
    // tandas: muchas consultas seguidas hacen que Falabella responda 403 por unos minutos
    const pausaMs = Number(Deno.env.get("REFRESCO_PAUSA_MS") || 4000);
    for (let i = 0; i < entradas.length; i += 2) {
      if (i > 0) await new Promise((r) => setTimeout(r, pausaMs));
      await Promise.all(entradas.slice(i, i + 2).map(async (entrada) => {
        try {
          const consulta = `${entrada.marca} ${entrada.nombre}`;
          const precios = (await buscarPreciosConPython(consulta)) || [];
          await guardarEnHistorial(consulta, precios);
          // Mismo producto y mismo tamaño: en Falabella los tamaños de un producto comparten número y ahora llegan
          // como ofertas separadas; sin mirar el tamaño, un perfume de 90 ml tomaba el precio del de 30 ml
          const mlEntrada = entrada.ml || null;
          let mismo = precios.find((p: any) => {
            const mlOferta = extraerMl(p.nombre || "");
            return typeof p.precio === "number" && p.precio > 0 && mismoProducto(p.url, entrada.urlMejorPrecio) &&
              (!mlEntrada || !mlOferta || mlOferta === mlEntrada);
          });
          if (!mismo) {
            // La búsqueda no lo mostró entre los primeros resultados: se lee la página del producto
            const directa = await cotizarUrlConPython(entrada.urlMejorPrecio);
            if (directa?.precio > 0) {
              mismo = directa;
              porUrl++;
              await guardarEnHistorial(consulta, [directa]);
            }
          }
          if (!mismo) {
            sinMismoProducto++;
            return;
          }
          reCotizados++;
          await enCola(async () => {
            const actuales = await cargarCatalogoDescubiertos();
            const idx = actuales.findIndex((x) => clave(x) === clave(entrada));
            const base = idx >= 0 ? actuales[idx] : entrada;
            const actualizado = { ...base, precioReferencia: mismo.precio, stock: mismo.stock, fechaPrecio: hoy };
            if (idx >= 0) actuales[idx] = actualizado;
            else actuales.push(actualizado);
            await Deno.writeTextFile(ARCHIVO_CATALOGO_DESCUBIERTOS, JSON.stringify(actuales, null, 2));
          });
        } finally {
          progresoRefresco.procesados++;
        }
      }));
    }

    const resumen = { ultimo: new Date().toISOString(), perfumes: entradas.length, reCotizados, porUrl, sinMismoProducto };
    await Deno.writeTextFile(ARCHIVO_ESTADO_REFRESCO, JSON.stringify(resumen, null, 2));
    await registrarLog(
      "SUCCESS",
      "SCRAPER",
      `Refresco de catálogo: ${reCotizados} precios actualizados (${porUrl} desde la página del producto), ${sinMismoProducto} sin el mismo producto`,
      Date.now() - inicio
    );
    return resumen;
  } catch (err: any) {
    await registrarLog("ERROR", "SCRAPER", `Refresco de catálogo falló: ${err.message}`, Date.now() - inicio);
    return null;
  } finally {
    refrescoEnCurso = false;
  }
}

// Re-etiqueta los dos catálogos con la ficha de cada perfume. Pide a la IA las fichas que falten (una sola vez por
// perfume: quedan en fichas_conocidas.json), así que se puede interrumpir y repetir sin volver a pagar las ya hechas.
// Se ejecuta a mano: deno run -A --env server.ts --etiquetar [cuántos]
async function etiquetarCatalogo(limite = Infinity) {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  const resumen = { etiquetados: 0, sinFicha: 0 };
  for (const archivo of [ARCHIVO_CATALOGO_DESCUBIERTOS, ARCHIVO_CATALOGO_KNASTA]) {
    let items: any[] = [];
    try {
      items = JSON.parse(await Deno.readTextFile(archivo));
    } catch {
      continue;
    }
    items = items.slice(0, limite);
    // De a 2 a la vez, como el refresco de precios, para no pasar el límite por minuto de la IA
    for (let i = 0; i < items.length; i += 2) {
      await Promise.all(items.slice(i, i + 2).map(async (item) => {
        const consulta = `${item.marca} ${item.nombre}`;
        const deLaIA = await generarFichaFragancia(consulta, apiKey).catch(() => null);
        // La IA puso un perfume con otro nombre (no conoce este): esa ficha no se usa
        if (deLaIA && nombresDistintos(consulta, deLaIA.nombre || "", deLaIA.marca || "")) await olvidarAlias(consulta);
        // Lanzamiento que la IA no conoce: se arma con lo que publican las tiendas
        if (!fichaConocida(consulta)) await fichaDesdeTiendas(consulta, (await buscarPreciosConPython(consulta)) || [], apiKey);
        // Solo valen las fichas de la IA (las que quedaron guardadas), no la de respaldo por falta de cuota
        const guardada = fichaConocida(consulta);
        if (!guardada) {
          resumen.sinFicha++;
          return;
        }
        const etiquetas = etiquetasDeFicha(enriquecerFichaConRadarYAlergenos(structuredClone(guardada)));
        await enCola(async () => {
          const actuales = JSON.parse(await Deno.readTextFile(archivo));
          const actual = actuales.find((x: any) => x.id === item.id);
          if (!actual) return;
          Object.assign(actual, etiquetas);
          await Deno.writeTextFile(archivo, JSON.stringify(actuales, null, 2));
        });
        resumen.etiquetados++;
      }));
      console.log(`${archivo}: ${Math.min(i + 2, items.length)}/${items.length}`);
    }
  }
  return resumen;
}

// Precio actual de un producto conocido (lo usa la ficha cuando la búsqueda no lo trajo)
app.get("/api/cotizar", async (c) => {
  const url = c.req.query("url") || "";
  const nombre = c.req.query("q")?.trim();
  const oferta = await cotizarUrlConPython(url);
  if (!oferta) return c.json({ success: false, oferta: null });
  if (nombre) await guardarEnHistorial(nombre, [oferta]);
  return c.json({ success: true, oferta: { ...oferta, moneda: "CLP" } });
});

// En cuántos perfumes con lista del envase conocida aparece cada alérgeno (cada fórmula cuenta una vez,
// aunque se vea en varios tamaños o tiendas). Da contexto a las estimaciones cuando un perfume no declara su lista.
app.get("/api/ingredientes/frecuencias", (c) => {
  const porFormula = new Map<string, string[]>();
  for (const l of listasConocidas) {
    const ids = alergenosEnIngredientes(l.ingredientes);
    const clave = claveFormula(l.nombre, marcasConocidas);
    // Sets, body sprays o nombres sin concentración no se cuentan: no se sabe a qué fórmula corresponden
    if (ids && clave) porFormula.set(`${clave.linea}|${clave.concentracion}|${clave.genero}`, ids);
  }
  const conteo: Record<string, number> = {};
  for (const ids of porFormula.values()) for (const id of ids) conteo[id] = (conteo[id] || 0) + 1;
  return c.json({ total: porFormula.size, conteo });
});

// Estado para el indicador de la barra superior: avance del refresco en curso y resumen del último
app.get("/api/refresco", async (c) => {
  let ultimo = null;
  try {
    ultimo = JSON.parse(await Deno.readTextFile(ARCHIVO_ESTADO_REFRESCO));
  } catch {
    // Todavía no se ha completado ningún refresco
  }
  return c.json({ enCurso: refrescoEnCurso, ...progresoRefresco, ultimo });
});

async function revisarRefrescoDiario() {
  if (Deno.env.get("REFRESCO_DIARIO") === "0" || refrescoEnCurso) return;
  try {
    const estado = JSON.parse(await Deno.readTextFile(ARCHIVO_ESTADO_REFRESCO));
    if (Date.now() - Date.parse(estado.ultimo) < INTERVALO_REFRESCO_MS) return;
  } catch {
    // Sin registro previo: nunca se ha refrescado
  }
  const limite = Number(Deno.env.get("REFRESCO_LIMITE")) || undefined;
  await refrescarCatalogo(limite);
}

app.post("/api/descubrir-por-filtros", async (c) => {
  const inicioTotal = Date.now();
  try {
    const body = await c.req.json();
    const notas: string[] = Array.isArray(body.notas) ? body.notas : [];
    const modoNotas: "AND" | "OR" = body.modoNotas === "OR" ? "OR" : "AND";
    const notaPersonalizada: string = (body.notaPersonalizada || "").trim();
    const familias: string[] = Array.isArray(body.familias) ? body.familias : [];
    const marcas: string[] = Array.isArray(body.marcas) ? body.marcas : [];
    const generos: string[] = Array.isArray(body.generos) ? body.generos : [];

    const todasNotasBuscadas = notaPersonalizada ? [...notas, notaPersonalizada] : [...notas];

    await registrarLog(
      "INFO",
      "API",
      `Descubrimiento por filtros/notas iniciado: Notas=[${todasNotasBuscadas.join(modoNotas === "AND" ? " + " : " | ")}] Familias=[${familias.join(", ")}] Marcas=[${marcas.join(", ")}]`
    );

    // 1. Buscar primero en nuestra Enciclopedia Curada por Notas (Garantiza respuesta inmediata para Chocolate, Madera, Café, Tabaco, etc.)
    const candidatosCurados = ENCICLOPEDIA_POR_NOTAS.filter((item) => {
      if (marcas.length > 0 && !marcas.some((m) => item.marca.toLowerCase().includes(m.toLowerCase()))) {
        return false;
      }
      if (familias.length > 0 && !familias.includes(item.familia)) {
        return false;
      }
      if (generos.length > 0 && !generos.includes(item.genero)) {
        return false;
      }
      if (todasNotasBuscadas.length > 0) {
        const textoItem = `${item.notasClave.join(" ")} ${item.notasDetalle.join(" ")}`.toLowerCase();
        const cumpleNota = (n: string) => {
          const nl = n.toLowerCase();
          if (nl.includes("chocolate") || nl.includes("cacao")) {
            return textoItem.includes("chocolate") || textoItem.includes("cacao") || textoItem.includes("pralin") || textoItem.includes("gianduja");
          }
          if (nl.includes("madera") || nl.includes("cedro") || nl.includes("sándalo")) {
            return textoItem.includes("madera") || textoItem.includes("cedro") || textoItem.includes("sándalo") || textoItem.includes("vetiver") || textoItem.includes("pachul");
          }
          return item.notasClave.includes(n) || textoItem.includes(nl);
        };
        if (modoNotas === "AND") {
          return todasNotasBuscadas.every(cumpleNota);
        } else {
          return todasNotasBuscadas.some(cumpleNota);
        }
      }
      return true;
    });

    // 2. Consultar también a la IA (Gemini / Azure) para descubrir aún más fragancias del mercado chileno con esas notas exactas
    let sugerenciasIA: any[] = [];
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (GEMINI_API_KEY && (todasNotasBuscadas.length > 0 || marcas.length > 0 || familias.length > 0)) {
      const promptDescubrir = `Eres un maestro perfumista y comprador experto del mercado chileno (Falabella, DBS Beauty Store, Alisha Perfumes, Farmacias Ahumada).
El usuario busca perfumes sin saber el nombre, aplicando estos filtros:
- Notas / Aromas requeridos (${modoNotas === "AND" ? "DEBE TENER TODAS ESTAS NOTAS COMBINADAS" : "Al menos una de estas notas"}): ${todasNotasBuscadas.join(", ") || "Cualquiera"}
- Familia olfativa: ${familias.join(", ") || "Cualquiera"}
- Marca: ${marcas.join(", ") || "Cualquiera"}
- Género: ${generos.join(", ") || "Cualquiera"}

Devuelve ESTRICTAMENTE un objeto JSON con un arreglo "perfumes" de 4 fragancias reales muy conocidas que cumplan exactamente con esas notas:
{
  "perfumes": [
    {
      "nombre": "Nombre del perfume (ej: Bad Boy)",
      "marca": "Marca (ej: Carolina Herrera)",
      "concentracion": "Eau de Parfum (EDP) o Eau de Toilette (EDT)",
      "genero": "Masculino / Femenino / Unisex",
      "familia": "Dulce / Gourmand | Amaderado / Aromático | Ámbar / Especiado | Cítrico / Acuático | Fougère / Azul | Floral / Frutal",
      "notasDetalle": ["Cacao", "Madera de Cedro", "Haba Tonka", "Pimienta"],
      "duracion_horas": 9,
      "proyeccion": "Alta"
    }
  ]
}`;
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const resIA = await llamarGeminiConFallback(genAI, [promptDescubrir]);
        if (resIA && Array.isArray(resIA.perfumes)) {
          sugerenciasIA = resIA.perfumes;
        }
      } catch {
        // Si la cuota gratuita de Gemini está ocupada, candidatosCurados cubre la respuesta sin fallar
      }
    }

    // Combinar candidatos de IA + Enciclopedia sin duplicar
    const mapaUnicos = new Map<string, any>();
    for (const c of [...candidatosCurados, ...sugerenciasIA]) {
      if (!c || !c.nombre) continue;
      const clave = `${(c.marca || "").toLowerCase()}-${c.nombre.toLowerCase()}`;
      if (!mapaUnicos.has(clave)) {
        mapaUnicos.set(clave, c);
      }
    }

    const listaFinalCandidatos = Array.from(mapaUnicos.values()).slice(0, 4);

    // 3. Cotizar todos los candidatos en vivo; solo los que alguna tienda chilena vende entran al catálogo
    const nuevosItemsCatalogo: any[] = [];

    await Promise.all(
      listaFinalCandidatos.map(async (cand) => {
        const queryBusqueda = `${cand.marca} ${cand.nombre}`.trim();
        const obtenidos = await buscarPreciosConPython(queryBusqueda);
        const preciosTienda: any[] = Array.isArray(obtenidos) ? obtenidos : [];
        if (preciosTienda.length === 0) return;

        const fichaSintetica = enriquecerFichaConRadarYAlergenos({
          nombre: cand.nombre,
          marca: cand.marca,
          concentracion: cand.concentracion || "Eau de Parfum",
          familia_olfativa: cand.familia || "Amaderado / Aromático",
          genero: cand.genero || "Unisex",
          notas_salida: cand.notasDetalle?.slice(0, 2) || todasNotasBuscadas,
          notas_corazon: cand.notasDetalle?.slice(2, 4) || [],
          notas_fondo: cand.notasDetalle?.slice(4, 6) || [],
          acordes_principales: todasNotasBuscadas,
          duracion_horas: cand.duracion_horas || 8,
          proyeccion: cand.proyeccion || "Alta",
        });

        const itemGuardado = await guardarPerfumeDescubiertoEnCatalogo(queryBusqueda, preciosTienda, fichaSintetica);

        if (itemGuardado) {
          // Asegurar que las notas buscadas queden etiquetadas explícitamente
          itemGuardado.notas = Array.from(new Set([...(itemGuardado.notas || []), ...todasNotasBuscadas]));
          itemGuardado.notasDetalle = cand.notasDetalle || todasNotasBuscadas;
          itemGuardado.subtitulo = `${itemGuardado.concentracion.split(" ")[0]} · Notas: ${(cand.notasDetalle || todasNotasBuscadas).slice(0, 4).join(", ")}`;
          nuevosItemsCatalogo.push(itemGuardado);
        }
      })
    );

    const duracionTotal = Date.now() - inicioTotal;
    await registrarLog(
      "SUCCESS",
      "API",
      `Descubrimiento por notas completado: ${nuevosItemsCatalogo.length} fragancias encontradas para [${todasNotasBuscadas.join(modoNotas === "AND" ? " + " : " | ")}]`,
      duracionTotal
    );

    return c.json({
      success: true,
      latencia_ms: duracionTotal,
      items: nuevosItemsCatalogo,
      mensaje: `${nuevosItemsCatalogo.length} fragancias descubiertas con ${todasNotasBuscadas.join(modoNotas === "AND" ? " + " : " / ")}.`,
    });
  } catch (err: any) {
    return c.json({ success: false, mensaje: err.message }, 500);
  }
});

// ─────────────────────────────────────────────
//  POST /api/analizar (con foto)
// ─────────────────────────────────────────────
app.post("/api/analizar", async (c) => {
  const inicioTotal = Date.now();
  try {
    const body = await c.req.parseBody();
    const imagen = body["imagen"];

    if (imagen && imagen instanceof File) {
      estadisticasSistema.total_escaneos_foto++;
      await registrarLog("INFO", "API", `Imagen recibida para escaneo IA: ${imagen.name} (${Math.round(imagen.size / 1024)} KB)`);

      const AZURE_CONNECTION_STRING = Deno.env.get("AZURE_CONNECTION_STRING");
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

      if (!GEMINI_API_KEY) {
        throw new Error("Falta la variable GEMINI_API_KEY en .env");
      }

      const arrayBuffer = await imagen.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // 1. Subida a Azure Blob Storage (resiliente)
      let urlAzure = "almacenamiento-local";
      if (AZURE_CONNECTION_STRING && AZURE_CONNECTION_STRING.includes("AccountKey")) {
        try {
          const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
          const containerClient = blobServiceClient.getContainerClient("fotos-perfumes");
          const blockBlobClient = containerClient.getBlockBlobClient(`${Date.now()}-${imagen.name}`);
          await blockBlobClient.uploadData(buffer);
          urlAzure = blockBlobClient.url;
          await registrarLog("SUCCESS", "API", `Imagen respaldada en Azure Blob Storage`);
        } catch (azureErr: any) {
          await registrarLog("WARN", "API", `Azure Blob no disponible, procesando imagen en memoria local`);
        }
      }

      // 2. Análisis con IA (Azure OpenAI o Gemini Vision con Fallback)
      const prompt = `Analiza esta imagen de un perfume.
Identifica el nombre exacto del perfume, la marca y la lista de ingredientes o alérgenos si son visibles en la caja o frasco.
Devuelve ESTRICTAMENTE esta estructura JSON:
{
  "marca": "Nombre de la marca",
  "perfume": "Nombre exacto del perfume",
  "ingredientes": ["ingrediente 1", "ingrediente 2"]
}`;

      let datosExtraidos: any = null;

      if (Deno.env.get("AZURE_OPENAI_API_KEY")) {
        try {
          datosExtraidos = await llamarAzureOpenAI(
            "Eres un experto en perfumería y visión computacional. Devuelve únicamente JSON estructurado con marca, perfume e ingredientes.",
            prompt,
            encodeBase64(buffer),
            imagen.type
          );
        } catch (azureErr: any) {
          await registrarLog("WARN", "IA_AZURE", `Visión Azure pasó a Gemini: ${azureErr.message}`);
        }
      }

      if (!datosExtraidos) {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const contents = [
          prompt,
          { inlineData: { data: encodeBase64(buffer), mimeType: imagen.type } },
        ];
        datosExtraidos = await llamarGeminiConFallback(genAI, contents);
      }

      // 3. Precios, ficha y reviews en paralelo
      const [precios, ficha, mapaReviews] = await Promise.all([
        buscarPreciosConPython(datosExtraidos.perfume),
        generarFichaFragancia(datosExtraidos.perfume, GEMINI_API_KEY),
        cargarReviews(),
      ]);

      const listaPrecios = precios || [];
      const historial = await guardarEnHistorial(datosExtraidos.perfume, listaPrecios);
      await guardarPerfumeDescubiertoEnCatalogo(
        `${datosExtraidos.marca || ""} ${datosExtraidos.perfume || ""}`.trim(),
        listaPrecios,
        ficha
      );
      const reviews = mapaReviews[(datosExtraidos.perfume || "").toLowerCase().trim()] || [];
      const duracionTotal = Date.now() - inicioTotal;

      await registrarLog("SUCCESS", "API", `Escaneo por foto completado: "${datosExtraidos.perfume}"`, duracionTotal);

      return c.json({
        success: true,
        latencia_ms: duracionTotal,
        mensaje: "Proceso completo exitoso",
        url_azure: urlAzure,
        analisis: datosExtraidos,
        precios: listaPrecios,
        ficha,
        historial,
        reviews,
        sucursales: await obtenerSucursales(),
      });
    }

    return c.json({ success: false, mensaje: "No se detectó imagen en la solicitud." }, 400);

  } catch (error: any) {
    await registrarLog("ERROR", "API", `Error en análisis fotográfico: ${error.message}`, Date.now() - inicioTotal);

    if (
      error.message?.includes("503") ||
      error.message?.includes("429") ||
      error.message?.includes("quota") ||
      error.message?.includes("high demand")
    ) {
      return c.json({
        success: false,
        mensaje: "⚠️ Límite de consultas gratuitas de la clave Gemini alcanzado por hoy (código 429). Puedes ingresar el nombre del perfume en el buscador manual o usar una clave con cuota activa.",
      }, 429);
    }

    return c.json({ success: false, mensaje: `Error interno: ${error.message}` }, 500);
  }
});

// ─────────────────────────────────────────────
//  GET /imagenes/:filename  — Sirve imágenes descargadas localmente
// ─────────────────────────────────────────────
app.get("/imagenes/:filename", async (c) => {
  const filename = c.req.param("filename").replace(/[^a-zA-Z0-9._-]/g, "");
  try {
    const data = await Deno.readFile(`${DIRECTORIO_IMAGENES}/${filename}`);
    const ext = (filename.split(".").pop() || "jpg").toLowerCase();
    const mimes: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    return new Response(data, { headers: { "Content-Type": mimes[ext] || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return c.notFound();
  }
});

// ─────────────────────────────────────────────
//  POST /api/sync-imagenes  — Descarga y localiza todas las imágenes del catálogo existente
// ─────────────────────────────────────────────
app.post("/api/sync-imagenes", async (c) => {
  const catalogo = await cargarCatalogoDescubiertos();
  const imagenesLocales = new Map<string, string>();
  await Promise.all(
    catalogo.map(async (item: any) => {
      if (item.imagen?.startsWith("http") && !item.imagen.startsWith("http://localhost")) {
        const local = await descargarImagenLocal(item.imagen, item.id);
        if (local) imagenesLocales.set(item.id, local);
      }
    })
  );
  // Se recarga dentro de la cola para no pisar cambios hechos mientras se descargaban las imágenes
  const actualizados = imagenesLocales.size;
  await enCola(async () => {
    const actual = await cargarCatalogoDescubiertos();
    const resultado = actual.map((item: any) => (imagenesLocales.has(item.id) ? { ...item, imagen: imagenesLocales.get(item.id) } : item));
    await Deno.writeTextFile(ARCHIVO_CATALOGO_DESCUBIERTOS, JSON.stringify(resultado, null, 2));
  });
  await registrarLog("SUCCESS", "API", `Sync imágenes: ${actualizados}/${catalogo.length} descargadas localmente`);
  return c.json({ success: true, actualizados, total: catalogo.length });
});

await registrarLog("INFO", "API", "Servidor PerfumeScan v5.0 iniciado con Caché Inteligente, Motor de Alérgenos IFRA y Telemetría");
console.log("Servidor corriendo en http://localhost:8000");
console.log("  POST /api/analizar  - Analiza foto de perfume");
console.log("  GET  /api/buscar?q= - Busca por nombre directamente (multitienda + caché + alérgenos)");
console.log("  GET  /api/comparar  - Compara dos perfumes lado a lado");
console.log("  GET  /api/logs      - Telemetría y logs estructurados del sistema");
console.log("  GET/POST/DELETE /api/reviews - Reseñas (publicar y borrar piden cuenta)");
// Modo re-etiquetado del catálogo: hace el trabajo y termina sin levantar el servidor
if (Deno.args[0] === "--etiquetar") {
  console.log(await etiquetarCatalogo(Number(Deno.args[1]) || Infinity));
  Deno.exit(0);
}
// Modo traducción de las fichas guardadas: igual, con el servidor apagado (si no, el servidor pisa el archivo)
if (Deno.args[0] === "--traducir") {
  console.log(await traducirFichasGuardadas(Number(Deno.args[1]) || Infinity));
  Deno.exit(0);
}
obtenerSucursales(); // precarga los horarios en segundo plano para no demorar la primera búsqueda
// Refresco diario: primera revisión 2 min después de iniciar (para no competir con el arranque) y luego cada hora
setTimeout(revisarRefrescoDiario, Number(Deno.env.get("REFRESCO_ESPERA_MS")) || 2 * 60 * 1000);
setInterval(revisarRefrescoDiario, 60 * 60 * 1000);
Deno.serve({ port: 8000 }, app.fetch);
