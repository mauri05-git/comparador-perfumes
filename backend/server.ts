import { Hono } from "https://deno.land/x/hono/mod.ts";
import { cors } from "https://deno.land/x/hono/middleware.ts";
import { BlobServiceClient } from "npm:@azure/storage-blob";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { enCola, mismoProducto } from "./utilidades.ts";

const app = new Hono();
app.use("/*", cors());

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
        mejorHoy.set(clave, { fecha: fechaHoy, tienda: p.tienda, nombre: p.nombre, precio: p.precio, ml: extraerMl(p.nombre) });
      }
    }

    for (const registro of mejorHoy.values()) {
      const yaExisteHoy = mapa[key].some(
        (r) => r.fecha === fechaHoy && r.tienda === registro.tienda && r.nombre === registro.nombre
      );
      if (!yaExisteHoy) {
        mapa[key].push(registro);
      }
    }

    await Deno.writeTextFile(ARCHIVO_HISTORIAL, JSON.stringify(mapa, null, 2));
    return mapa[key];
  } catch (err) {
    console.error("[Historial] Error al guardar:", err);
    return [];
  }
}

// ─────────────────────────────────────────────
//  REVIEWS COMUNITARIAS (Persistencia JSON local)
// ─────────────────────────────────────────────
const ARCHIVO_REVIEWS = "./reviews_comunidad.json";

interface Review {
  id: string;
  perfume: string;
  usuario: string;
  rating: number; // 1-5
  duracion_horas: number;
  comentario: string;
  fecha: string;
}

async function cargarReviews(): Promise<Record<string, Review[]>> {
  try {
    const texto = await Deno.readTextFile(ARCHIVO_REVIEWS);
    return JSON.parse(texto);
  } catch {
    return {
      "acqua di gio": [
        {
          id: "1",
          perfume: "Acqua Di Gio",
          usuario: "Carlos M.",
          rating: 5,
          duracion_horas: 8,
          comentario: "Un clásico veraniego que nunca falla. Proyección limpia y fresca a brisa marina y bergamota.",
          fecha: "2026-10-10",
        },
        {
          id: "2",
          perfume: "Acqua Di Gio",
          usuario: "Valeria S.",
          rating: 4,
          duracion_horas: 7,
          comentario: "Rico aroma acuático y cítrico. Muy agradable para días calurosos en la oficina.",
          fecha: "2026-10-18",
        },
        {
          id: "3",
          perfume: "Acqua Di Gio",
          usuario: "Felipe T.",
          rating: 5,
          duracion_horas: 8,
          comentario: "Excelente fijación en el secado con notas de cedro y pachulí. Totalmente versátil.",
          fecha: "2026-10-20",
        },
      ],
      "sauvage": [
        {
          id: "4",
          perfume: "Sauvage Dior",
          usuario: "Martín R.",
          rating: 5,
          duracion_horas: 10,
          comentario: "Una bestia en proyección. El ambroxan y la pimienta de Sichuan llenan una habitación sin abrumar.",
          fecha: "2026-10-15",
        },
        {
          id: "5",
          perfume: "Sauvage Dior",
          usuario: "Andrés B.",
          rating: 4,
          duracion_horas: 9,
          comentario: "Muy elogiado por la gente. Huele moderno, limpio pero con mucha fuerza.",
          fecha: "2026-10-19",
        },
      ],
      "sauvage dior": [
        {
          id: "6",
          perfume: "Sauvage Dior",
          usuario: "Martín R.",
          rating: 5,
          duracion_horas: 10,
          comentario: "Una bestia en proyección. El ambroxan y la pimienta de Sichuan llenan una habitación sin abrumar.",
          fecha: "2026-10-15",
        },
      ],
      "bleu de chanel": [
        {
          id: "7",
          perfume: "Bleu de Chanel",
          usuario: "Ignacio P.",
          rating: 5,
          duracion_horas: 9,
          comentario: "La definición de elegancia azul. Cítrico al inicio y luego un incienso místico riquísimo.",
          fecha: "2026-10-12",
        },
      ],
    };
  }
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

const CATALOGO_REGLAS_ALERGENOS: {
  id: string;
  compuesto_quimico: string;
  nombre_comun: string;
  keywords: string[];
  nivel_riesgo: "Alto" | "Moderado" | "Bajo";
  descripcion: string;
}[] = [
  {
    id: "limonene",
    compuesto_quimico: "D-Limonene",
    nombre_comun: "Cítricos / Bergamota / Limón",
    keywords: ["bergamota", "limón", "limon", "naranja", "mandarina", "pomelo", "toronja", "cítrico", "citrico", "cítricos", "citricos", "yuzu", "lima", "neroli"],
    nivel_riesgo: "Moderado",
    descripcion: "Terpeno natural presente en cáscaras cítricas. Puede oxidarse al contacto con el aire y causar dermatitis en pieles reactivas.",
  },
  {
    id: "linalool",
    compuesto_quimico: "Linalool",
    nombre_comun: "Lavanda / Flores Blancas / Neroli",
    keywords: ["lavanda", "neroli", "cilantro", "albahaca", "jazmín", "jazmin", "flor de azahar", "azahar", "bergamota", "salvia", "geranio"],
    nivel_riesgo: "Moderado",
    descripcion: "Alcohol terpénico floral muy frecuente en perfumería fina. Regulado por la norma europea e IFRA.",
  },
  {
    id: "cinnamal",
    compuesto_quimico: "Cinnamal / Cinamaldehído",
    nombre_comun: "Canela y Especias Cálidas",
    keywords: ["canela", "cassia", "especias cálidas", "especiado", "cardamomo", "nuez moscada"],
    nivel_riesgo: "Alto",
    descripcion: "Compuesto orgánico responsable del aroma a canela. Es uno de los sensibilizantes cutáneos más potentes según IFRA.",
  },
  {
    id: "eugenol",
    compuesto_quimico: "Eugenol / Isoeugenol",
    nombre_comun: "Clavo de Olor / Pimienta / Especias",
    keywords: ["clavo", "pimienta", "pimienta rosa", "pimienta negra", "sichuan", "nuez moscada", "albahaca", "canela", "especias"],
    nivel_riesgo: "Alto",
    descripcion: "Fenilpropanoide presente en clavo de olor y especias picantes. Restringido en pieles con dermatitis de contacto.",
  },
  {
    id: "coumarin",
    compuesto_quimico: "Coumarin (Cumarina)",
    nombre_comun: "Haba Tonka / Vainilla / Almendra",
    keywords: ["haba tonka", "tonka", "vainilla", "almendra", "cacao", "praliné", "praline", "caramelo", "dulce"],
    nivel_riesgo: "Moderado",
    descripcion: "Lactona aromática típica de fragancias orientales, dulces y gourmand (presente de forma natural en el haba tonka).",
  },
  {
    id: "oakmoss",
    compuesto_quimico: "Evernia Prunastri (Musgo de Roble)",
    nombre_comun: "Musgo de Roble / Notas Terrosas",
    keywords: ["musgo", "musgo de roble", "roble", "liquen", "chipre", "fougère", "fougere", "vetiver", "pachulí", "pachuli"],
    nivel_riesgo: "Alto",
    descripcion: "Extracto botánico clásico de alta fijación severamente regulado por IFRA por su alto potencial alergénico (atranol).",
  },
  {
    id: "citral",
    compuesto_quimico: "Citral (Geranial + Neral)",
    nombre_comun: "Verbena / Hierba Limón / Jengibre",
    keywords: ["verbena", "lemongrass", "hierba limón", "jengibre", "cidra", "petitgrain", "limón"],
    nivel_riesgo: "Moderado",
    descripcion: "Aldehído terpénico de aroma cítrico intenso que puede producir irritación en pieles sensibles al sol.",
  },
  {
    id: "geraniol",
    compuesto_quimico: "Geraniol / Citronellol",
    nombre_comun: "Rosa / Geranio / Peonía",
    keywords: ["rosa", "geranio", "peonía", "peonia", "magnolia", "lirio", "tuberosa", "nardo", "floral"],
    nivel_riesgo: "Bajo",
    descripcion: "Alcohol monoterpénico principal en aceites esenciales de rosa y geranio.",
  },
];

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
async function generarFichaFragancia(nombrePerfume: string, apiKey: string) {
  if (esTerminoNoFragancia(nombrePerfume)) {
    await registrarLog("WARN", "API", `Búsqueda rechazada por filtro de categoría no-fragancia: "${nombrePerfume}"`);
    return null;
  }

  const prompt = `Eres un evaluador y maestro perfumista internacional con más de 20 años de experiencia y especialista en seguridad dermatológica IFRA.
Evalúa el siguiente término ingresado: "${nombrePerfume}".

PASO 1: VERIFICACIÓN RIGUROSA
Determina si "${nombrePerfume}" corresponde a un perfume, colonia, fragancia, marca de perfumería o aroma real.
Si el término NO es un perfume (por ejemplo: si es calzado, ropa, zapatillas, muebles, camas, electrodomésticos, tecnología, comida, etc.), NO DEBES INVENTAR NOTAS OLFATIVAS NI PIRÁMIDE. Devuelve exactamente este JSON:
{
  "es_perfume": false,
  "mensaje": "El término '${nombrePerfume}' no corresponde a una fragancia o perfume reconocido."
}

PASO 2: SI SÍ ES UN PERFUME O FRAGANCIA
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
    "atomizaciones": "3 a 5 atomizaciones recomendadas (2 en cuello, 1 en muñecas y 1 en pecho)",
    "puntos_pulso": ["Cuello lateral", "Interior de las muñecas", "Detrás de las orejas", "Pecho"],
    "consejo_experto": "Aplica tras la ducha sobre piel limpia e hidratada. No frotes las muñecas entre sí, ya que la fricción rompe las moléculas olfativas de salida.",
    "clima_ideal": "Clima templado a cálido para potenciar su proyección y evolución en piel"
  },
  "descripcion": "Descripción experta de 3-4 frases describiendo la evolución, el carácter y la experiencia olfativa única de este perfume.",
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
        if (fichaAzure.es_perfume === false) {
          await registrarLog("WARN", "IA_AZURE", `IA rechazó "${nombrePerfume}" por no ser un perfume.`);
          return null;
        }
        if (fichaAzure.nombre) return normalizarFicha(fichaAzure);
      }
    } catch (azureErr: any) {
      await registrarLog("WARN", "IA_AZURE", `Fallback a Gemini activado: ${azureErr.message}`);
    }
  }

  // 2. Probar con Gemini
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await llamarGeminiConFallback(genAI, [prompt]);
    if (result) {
      if (result.es_perfume === false) {
        await registrarLog("WARN", "IA_GEMINI", `Gemini identificó que "${nombrePerfume}" NO es un perfume.`);
        return null;
      }
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
      presentaciones_habituales: ["50 ml", "100 ml", "200 ml"],
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
    };
  }

  // Perfume fuera de la lista curada y sin IA disponible: no se inventa una ficha genérica
  return null;
}


// ─────────────────────────────────────────────
//  PUENTE DENO → PYTHON (scraper multi-tienda con telemetría)
// ─────────────────────────────────────────────
async function buscarPreciosConPython(nombrePerfume: string) {
  const inicio = Date.now();
  try {
    const palabras = nombrePerfume.trim().split(/\s+/);
    const comando = new Deno.Command("python", {
      args: ["scraper_stock.py", ...palabras],
      stdout: "piped",
      stderr: "piped",
    });

    const proceso = await comando.output();
    const duracion = Date.now() - inicio;

    if (proceso.code === 0) {
      const resultadoTexto = new TextDecoder().decode(proceso.stdout);
      const lista = JSON.parse(resultadoTexto);
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
      return lista;
    } else {
      const err = new TextDecoder().decode(proceso.stderr);
      await registrarLog("ERROR", "SCRAPER", `Fallo en subproceso Python para "${nombrePerfume}"`, duracion, { stderr: err });
      return null;
    }
  } catch (error: any) {
    const duracion = Date.now() - inicio;
    await registrarLog("ERROR", "SCRAPER", `Excepción al invocar Python: ${error.message}`, duracion);
    return null;
  }
}

// ─────────────────────────────────────────────
//  SUCURSALES Y HORARIOS (Disponibilidad Geográfica)
// ─────────────────────────────────────────────
const SUCURSALES_CHILE = [
  {
    tienda: "Falabella",
    nombre: "Falabella Parque Arauco",
    direccion: "Av. Pdte. Kennedy 5413, Las Condes",
    horario: "Lunes a Domingo: 10:00 - 20:30",
    comuna: "Las Condes",
    region: "Metropolitana",
    telefono: "600 380 5000",
    lat: -33.4058,
    lng: -70.5792,
  },
  {
    tienda: "Falabella",
    nombre: "Falabella Costanera Center",
    direccion: "Av. Andrés Bello 2425, Providencia",
    horario: "Lunes a Domingo: 10:00 - 20:30",
    comuna: "Providencia",
    region: "Metropolitana",
    telefono: "600 380 5000",
    lat: -33.4175,
    lng: -70.6063,
  },
  {
    tienda: "Falabella",
    nombre: "Falabella Apumanque",
    direccion: "Manquehue Sur 31, Las Condes",
    horario: "Lunes a Domingo: 10:00 - 20:00",
    comuna: "Las Condes",
    region: "Metropolitana",
    telefono: "600 380 5000",
    lat: -33.4143,
    lng: -70.5963,
  },
  {
    tienda: "Falabella",
    nombre: "Falabella Alto Las Condes",
    direccion: "Av. Presidente Kennedy 9001, Las Condes",
    horario: "Lunes a Domingo: 10:00 - 21:00",
    comuna: "Las Condes",
    region: "Metropolitana",
    telefono: "600 380 5000",
    lat: -33.3914,
    lng: -70.5411,
  },
  {
    tienda: "Falabella",
    nombre: "Falabella Mall Plaza Egaña",
    direccion: "Tobalaba 8700, Ñuñoa",
    horario: "Lunes a Domingo: 10:00 - 21:00",
    comuna: "Ñuñoa",
    region: "Metropolitana",
    telefono: "600 380 5000",
    lat: -33.4542,
    lng: -70.5891,
  },
  {
    tienda: "Farmacias Ahumada",
    nombre: "Ahumada Providencia 24h",
    direccion: "Av. Providencia 2185, Providencia",
    horario: "Abierto 24 Horas",
    comuna: "Providencia",
    region: "Metropolitana",
    telefono: "600 222 4000",
    lat: -33.4262,
    lng: -70.6103,
  },
  {
    tienda: "Farmacias Ahumada",
    nombre: "Ahumada Las Condes",
    direccion: "Av. Las Condes 12348, Las Condes",
    horario: "Lunes a Domingo: 9:00 - 22:00",
    comuna: "Las Condes",
    region: "Metropolitana",
    telefono: "600 222 4000",
    lat: -33.3820,
    lng: -70.5513,
  },
  {
    tienda: "Farmacias Ahumada",
    nombre: "Ahumada Ñuñoa",
    direccion: "Av. Irarrázaval 1890, Ñuñoa",
    horario: "Lunes a Viernes: 8:30 - 21:30, Sáb-Dom: 9:00 - 20:00",
    comuna: "Ñuñoa",
    region: "Metropolitana",
    telefono: "600 222 4000",
    lat: -33.4551,
    lng: -70.6282,
  },
  {
    tienda: "Alisha Perfumes",
    nombre: "Alisha Perfumes Mall Plaza Norte",
    direccion: "Américo Vespucio 1737, Huechuraba",
    horario: "Lunes a Domingo: 10:00 - 21:00",
    comuna: "Huechuraba",
    region: "Metropolitana",
    telefono: "+56 9 8765 4321",
    lat: -33.3667,
    lng: -70.6494,
  },
  {
    tienda: "Alisha Perfumes",
    nombre: "Alisha Perfumes Mall Costanera",
    direccion: "Av. Andrés Bello 2447, Local 2021, Providencia",
    horario: "Lunes a Domingo: 10:00 - 21:00",
    comuna: "Providencia",
    region: "Metropolitana",
    telefono: "+56 9 8765 4322",
    lat: -33.4172,
    lng: -70.6071,
  },
  {
    tienda: "DBS Beauty Store",
    nombre: "DBS Beauty Store La Reina",
    direccion: "Av. Ossa 1881, La Reina",
    horario: "Lunes a Viernes: 10:00 - 19:30, Sáb: 10:00 - 15:00",
    comuna: "La Reina",
    region: "Metropolitana",
    telefono: "+56 2 2273 0000",
    lat: -33.4454,
    lng: -70.5585,
  },
].map((s) => ({ ...s, fuente: "referencial" }));

// Horarios reales de Farmacias Ahumada (scraper_sucursales.py); el resto de cadenas queda como referencia manual
const TTL_SUCURSALES_MS = 24 * 60 * 60 * 1000;
const REINTENTO_SUCURSALES_MS = 10 * 60 * 1000;
let cacheSucursales: { expira: number; datos: Promise<any[]> } | null = null;

async function scrapearSucursalesAhumada(): Promise<any[]> {
  const inicio = Date.now();
  try {
    const proceso = await new Deno.Command("python", {
      args: ["scraper_sucursales.py"],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const duracion = Date.now() - inicio;
    if (proceso.code !== 0) {
      await registrarLog("ERROR", "SCRAPER", "Fallo al obtener sucursales de Ahumada", duracion, {
        stderr: new TextDecoder().decode(proceso.stderr),
      });
      return [];
    }
    const locales = JSON.parse(new TextDecoder().decode(proceso.stdout));
    await registrarLog("SUCCESS", "SCRAPER", `Horarios de ${locales.length} locales de Ahumada actualizados`, duracion);
    return Array.isArray(locales) ? locales : [];
  } catch (error: any) {
    await registrarLog("ERROR", "SCRAPER", `Excepción al obtener sucursales: ${error.message}`, Date.now() - inicio);
    return [];
  }
}

function obtenerSucursales(): Promise<any[]> {
  if (cacheSucursales && Date.now() < cacheSucursales.expira) return cacheSucursales.datos;
  const entrada = { expira: Date.now() + TTL_SUCURSALES_MS, datos: Promise.resolve(SUCURSALES_CHILE) };
  entrada.datos = scrapearSucursalesAhumada().then((ahumada) => {
    if (ahumada.length === 0) {
      entrada.expira = Date.now() + REINTENTO_SUCURSALES_MS;
      return SUCURSALES_CHILE;
    }
    return [...SUCURSALES_CHILE.filter((s) => s.tienda !== "Farmacias Ahumada"), ...ahumada];
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

app.delete("/api/logs", async (c) => {
  memoriaLogs = [];
  await registrarLog("INFO", "API", "Historial de logs reiniciado manualmente por el usuario.");
  return c.json({ success: true, logs: memoriaLogs });
});

// ─────────────────────────────────────────────
//  GET /api/buscar?q=nombre
// ─────────────────────────────────────────────
app.get("/api/buscar", async (c) => {
  const inicioTotal = Date.now();
  const query = c.req.query("q")?.trim();
  const sinCache = c.req.query("nocache") === "1";

  if (!query || query.length < 2) {
    return c.json(
      { success: false, mensaje: "Parámetro 'q' requerido (mínimo 2 caracteres)." },
      400
    );
  }

  estadisticasSistema.total_busquedas++;
  const cacheKey = `buscar:${query.toLowerCase()}`;

  // Filtro preventivo: descartar búsquedas explícitas de categorías no-perfume
  if (esTerminoNoFragancia(query)) {
    await registrarLog("WARN", "API", `Búsqueda bloqueada por filtro no-fragancia: "${query}"`, Date.now() - inicioTotal);
    return c.json({
      success: true,
      query,
      es_perfume: false,
      mensaje: `⚠️ "${query}" no corresponde a un perfume o fragancia. PerfumeScan está optimizado exclusivamente para perfumes de diseñador y fragancias originales.`,
      precios: [],
      ficha: null,
      historial: [],
      reviews: [],
      sucursales: await obtenerSucursales(),
    });
  }

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
      return c.json({
        ...cacheado,
        reviews: reviewsActualizadas,
        desde_cache: true,
        latencia_ms: duracionCache,
      });
    }
  }

  estadisticasSistema.cache_misses++;
  await registrarLog("INFO", "API", `Iniciando búsqueda en vivo para "${query}"...`);

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  const [precios, ficha] = await Promise.all([
    buscarPreciosConPython(query),
    GEMINI_API_KEY ? generarFichaFragancia(query, GEMINI_API_KEY) : Promise.resolve(null),
  ]);

  const listaPrecios = precios || [];
  const historial = await guardarEnHistorial(query, listaPrecios);

  const mapaReviews = await cargarReviews();
  const key = query.toLowerCase().trim();
  const reviews = mapaReviews[key] || [];
  const duracionTotal = Date.now() - inicioTotal;

  const respuesta = {
    success: true,
    query,
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
    await guardarPerfumeDescubiertoEnCatalogo(query, listaPrecios, ficha);
  }

  await registrarLog(
    "SUCCESS",
    "API",
    `Búsqueda "${query}" finalizada (${listaPrecios.length} precios, ficha: ${ficha ? "Sí" : "No"}, alérgenos: ${ficha?.alergenos_detectados?.length || 0})`,
    duracionTotal
  );

  return c.json(respuesta);
});

// ─────────────────────────────────────────────
//  GET /api/comparar?p1=nombre1&p2=nombre2
//  Comparador Lado a Lado entre 2 perfumes (reutiliza caché individual y ordena ofertas)
// ─────────────────────────────────────────────
async function obtenerDatosPerfumeParaDuelo(nombre: string, apiKey?: string, delayIaMs = 0) {
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
        if (delayIaMs > 0) await new Promise((r) => setTimeout(r, delayIaMs));
        return generarFichaFragancia(nombre, apiKey);
      })(),
    ]);
    preciosRaw = preciosObtenidos || [];
    ficha = fichaObtenida;

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

// ─────────────────────────────────────────────
//  POST /api/reviews
//  Permite a los usuarios publicar una review
// ─────────────────────────────────────────────
app.post("/api/reviews", async (c) => {
  try {
    const body = await c.req.json();
    const { perfume, usuario, rating, duracion_horas, comentario } = body;

    if (!perfume || !usuario || !rating || !comentario) {
      return c.json({ success: false, mensaje: "Faltan campos obligatorios" }, 400);
    }

    const mapa = await cargarReviews();
    const key = perfume.toLowerCase().trim();
    if (!mapa[key]) mapa[key] = [];

    const nuevaReview: Review = {
      id: Date.now().toString(),
      perfume,
      usuario: usuario.trim(),
      rating: Number(rating),
      duracion_horas: Number(duracion_horas) || 6,
      comentario: comentario.trim(),
      fecha: new Date().toISOString().split("T")[0],
    };

    mapa[key].unshift(nuevaReview);
    await Deno.writeTextFile(ARCHIVO_REVIEWS, JSON.stringify(mapa, null, 2));
    await registrarLog("SUCCESS", "API", `Nueva reseña publicada por "${usuario}" para "${perfume}" (${rating}★)`);

    return c.json({ success: true, review: nuevaReview });
  } catch (err: any) {
    return c.json({ success: false, mensaje: err.message }, 500);
  }
});

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

function mapearFamiliaCatalogo(familiaRaw: string): string {
  const f = (familiaRaw || "").toLowerCase();
  if (!f) return "Sin clasificar";
  if (f.includes("acuát") || f.includes("acuat") || f.includes("marin") || f.includes("cítric") || f.includes("citric")) return "Cítrico / Acuático";
  if (f.includes("gourmand") || f.includes("dulce") || f.includes("vainilla") || f.includes("cacao") || f.includes("chocolate")) return "Dulce / Gourmand";
  if (f.includes("foug") || f.includes("azul")) return "Fougère / Azul";
  if (f.includes("especiad") || f.includes("oriental") || f.includes("ámbar") || f.includes("ambar")) return "Ámbar / Especiado";
  if (f.includes("floral") || f.includes("frutal")) return "Floral / Frutal";
  return "Amaderado / Aromático";
}

function mapearNotasEstandarizadas(ficha: any, textoExtra = ""): string[] {
  const todo = [
    ...(ficha?.notas_salida || []),
    ...(ficha?.notas_corazon || []),
    ...(ficha?.notas_fondo || []),
    ...(ficha?.acordes_principales || []),
    ficha?.familia_olfativa || "",
    ficha?.descripcion || "",
    textoExtra,
  ].join(" ").toLowerCase();

  const etiquetas: string[] = [];
  if (todo.includes("chocolate") || todo.includes("cacao") || todo.includes("pralin") || todo.includes("avellana") || todo.includes("nutella")) {
    etiquetas.push("Chocolate / Cacao");
  }
  if (todo.includes("madera") || todo.includes("cedro") || todo.includes("sándalo") || todo.includes("sandalo") || todo.includes("oud") || todo.includes("vetiver") || todo.includes("pachul") || todo.includes("roble") || todo.includes("abedul") || todo.includes("guayaco")) {
    etiquetas.push("Madera (Cedro / Sándalo / Oud)");
  }
  if (todo.includes("café") || todo.includes("cafe") || todo.includes("espresso") || todo.includes("cappuccino")) {
    etiquetas.push("Café / Espresso");
  }
  if (todo.includes("vainilla") || todo.includes("tonka") || todo.includes("almendra")) {
    etiquetas.push("Vainilla / Haba Tonka");
  }
  if (todo.includes("tabaco") || todo.includes("cuero") || todo.includes("humo") || todo.includes("incienso") || todo.includes("whisky") || todo.includes("ron")) {
    etiquetas.push("Tabaco / Cuero / Incienso");
  }
  if (todo.includes("caramelo") || todo.includes("miel") || todo.includes("dátil") || todo.includes("datil") || todo.includes("algodón")) {
    etiquetas.push("Caramelo / Miel");
  }
  if (todo.includes("bergamota") || todo.includes("limón") || todo.includes("limon") || todo.includes("pomelo") || todo.includes("mandarina") || todo.includes("naranja") || todo.includes("cítric") || todo.includes("citric")) {
    etiquetas.push("Bergamota / Limón");
  }
  if (todo.includes("marin") || todo.includes("acuát") || todo.includes("acuat") || todo.includes("ozón") || todo.includes("sal ")) {
    etiquetas.push("Notas Marinas");
  }
  if (todo.includes("pimienta") || todo.includes("canela") || todo.includes("cardamomo") || todo.includes("jengibre") || todo.includes("nuez moscada") || todo.includes("clavo") || todo.includes("especia")) {
    etiquetas.push("Pimienta / Especias");
  }
  if (todo.includes("lavanda") || todo.includes("menta") || todo.includes("romero") || todo.includes("salvia")) {
    etiquetas.push("Lavanda / Menta");
  }
  if (todo.includes("ámbar") || todo.includes("ambar") || todo.includes("ambroxan") || todo.includes("almizcle")) {
    etiquetas.push("Ámbar / Ambroxan");
  }
  if (todo.includes("rosa") || todo.includes("jazmín") || todo.includes("jazmin") || todo.includes("iris") || todo.includes("azahar") || todo.includes("nardos") || todo.includes("peonía")) {
    etiquetas.push("Jazmín / Rosa / Iris");
  }
  if (todo.includes("coco") || todo.includes("piña") || todo.includes("mango") || todo.includes("maracuyá") || todo.includes("manzana") || todo.includes("pera") || todo.includes("cereza")) {
    etiquetas.push("Frutal / Coco / Manzana");
  }

  return etiquetas;
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
    const mejorOferta = validos.find((p) => p.stock !== "Agotado") || validos[0];
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
      familia: mapearFamiliaCatalogo(ficha?.familia_olfativa || ""),
      notas: mapearNotasEstandarizadas(ficha, `${marcaOficial} ${nombreOficial}`),
      notasDetalle: todasNotasRaw.slice(0, 6),
      estaciones: ficha?.estaciones || ["Otoño", "Primavera"],
      ocasion: "Oficina & Diario",
      duracionHoras: ficha?.duracion_horas || 8,
      proyeccion: ficha?.proyeccion === "Bestia" ? "Bestia" : ficha?.proyeccion === "Alta" ? "Alta" : "Moderada",
      alergenosIds: (ficha?.alergenos_detectados || []).map((a: any) => a.id),
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
        (x) => x.id === nuevoItem.id || x.nombre.toLowerCase() === nuevoItem.nombre.toLowerCase()
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
      // Si el catálogo no tenía notas y ahora la IA entregó una ficha, se completan
      if ((existente.notas || []).length === 0 && nuevoItem.notas.length > 0) {
        Object.assign(actualizado, {
          subtitulo: nuevoItem.subtitulo,
          familia: nuevoItem.familia,
          notas: nuevoItem.notas,
          notasDetalle: nuevoItem.notasDetalle,
          alergenosIds: nuevoItem.alergenosIds,
          duracionHoras: nuevoItem.duracionHoras,
          proyeccion: nuevoItem.proyeccion,
        });
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
  try {
    let indexados: any[] = [];
    try {
      indexados = JSON.parse(await Deno.readTextFile(ARCHIVO_CATALOGO_KNASTA));
    } catch {
      // Sin el catálogo indexado se refrescan solo los descubiertos
    }
    const unicos = new Map<string, any>();
    for (const x of [...indexados, ...(await cargarCatalogoDescubiertos())]) unicos.set(clave(x), x);
    let entradas = Array.from(unicos.values());
    if (limite) entradas = entradas.slice(0, limite);
    progresoRefresco.total = entradas.length;
    progresoRefresco.procesados = 0;
    await registrarLog("INFO", "SCRAPER", `Refresco de catálogo iniciado: ${entradas.length} perfumes`);

    // De a 2 a la vez para no saturar a las tiendas ni competir con las búsquedas de los usuarios
    for (let i = 0; i < entradas.length; i += 2) {
      await Promise.all(entradas.slice(i, i + 2).map(async (entrada) => {
        try {
          const consulta = `${entrada.marca} ${entrada.nombre}`;
          const precios = (await buscarPreciosConPython(consulta)) || [];
          await guardarEnHistorial(consulta, precios);
          const mismo = precios.find(
            (p: any) => typeof p.precio === "number" && p.precio > 0 && mismoProducto(p.url, entrada.urlMejorPrecio)
          );
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

    const resumen = { ultimo: new Date().toISOString(), perfumes: entradas.length, reCotizados, sinMismoProducto };
    await Deno.writeTextFile(ARCHIVO_ESTADO_REFRESCO, JSON.stringify(resumen, null, 2));
    await registrarLog(
      "SUCCESS",
      "SCRAPER",
      `Refresco de catálogo: ${reCotizados} precios actualizados, ${sinMismoProducto} sin el mismo producto en vivo`,
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
console.log("  POST /api/reviews   - Publica una review de usuario");
obtenerSucursales(); // precarga los horarios en segundo plano para no demorar la primera búsqueda
// Refresco diario: primera revisión 2 min después de iniciar (para no competir con el arranque) y luego cada hora
setTimeout(revisarRefrescoDiario, Number(Deno.env.get("REFRESCO_ESPERA_MS")) || 2 * 60 * 1000);
setInterval(revisarRefrescoDiario, 60 * 60 * 1000);
Deno.serve({ port: 8000 }, app.fetch);
