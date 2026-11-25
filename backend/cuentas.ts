// Cuentas de usuario de PerfumeScan: registro con correo y contraseña, sesión en una cookie y datos de cada usuario
// (Mi Lista y alergias). Sin dependencias: las contraseñas se derivan con PBKDF2 de Web Crypto.
//
// Seguridad:
// - La contraseña nunca se guarda: se guarda PBKDF2-SHA256 (600.000 iteraciones) con una sal aleatoria por usuario.
// - La cookie lleva un token aleatorio de 32 bytes; en disco solo queda su SHA-256, así que robar el archivo no da sesiones.
// - Cerrar sesión borra la sesión guardada: la cookie vieja deja de servir.
// - Los intentos fallidos se limitan por correo y por IP; un correo inexistente tarda lo mismo que uno real.
// - El usuario sale siempre de la sesión, nunca de lo que manda el navegador.
// - Mi Lista y las alergias se guardan cifradas (AES-256-GCM): quien copie datos_usuarios.json no puede leerlas
//   sin la clave, que vive aparte (CLAVE_DATOS o clave_datos.key, fuera de git).
import type { Hono } from "https://deno.land/x/hono/mod.ts";
import { enCola } from "./utilidades.ts";

export const ITERACIONES = 600_000;
const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000;
const NOMBRE_COOKIE = "perfumescan_sesion";
const MAX_CUERPO = 100_000; // bytes: Mi Lista y alergias de una persona caben con holgura

export interface Usuario {
  id: string;
  email: string;
  sal: string;
  hash: string;
  iteraciones: number;
  creado: string;
}
interface Sesion {
  usuario: string;
  expira: number;
}
export interface AlmacenCuentas {
  usuarios: Record<string, Usuario>; // por correo normalizado
  sesiones: Record<string, Sesion>; // por SHA-256 del token
}
export interface DatosUsuario {
  lista: Record<string, unknown>[];
  alergias: string[];
  notas: string[];
  listas: { id: string; nombre: string }[]; // listas con nombre que crea el usuario
}

// ── Utilidades de bytes ──
const aBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function derivar(contrasena: string, sal: Uint8Array, iteraciones: number): Promise<string> {
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(contrasena), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: iteraciones }, clave, 256);
  return aBase64(new Uint8Array(bits));
}

// Comparación que tarda lo mismo aunque difieran en el primer carácter
export function igualesTiempoConstante(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diferencia = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diferencia |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diferencia === 0;
}

const sha256 = async (texto: string) => aHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));

// ── Validación de lo que llega del navegador ──
export function normalizarEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

export function errorDeContrasena(contrasena: unknown): string | null {
  if (typeof contrasena !== "string") return "Escribe una contraseña.";
  if (contrasena.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (contrasena.length > 128) return "La contraseña puede tener como máximo 128 caracteres.";
  return null;
}

const esListaDeTextos = (x: unknown): x is string[] =>
  Array.isArray(x) && x.length <= 200 && x.every((s) => typeof s === "string" && s.length <= 200);
const urlValida = (u: unknown) => u === undefined || u === "" || (typeof u === "string" && /^https?:\/\//i.test(u) && u.length <= 2000);

// Mi Lista y alergias de un usuario; devuelve el texto del error si algo no calza
export function validarDatos(datos: any): DatosUsuario | string {
  if (!datos || typeof datos !== "object") return "Datos inválidos.";
  const { lista, alergias, notas } = datos;
  if (!Array.isArray(lista) || lista.length > 500) return "La lista no es válida.";
  for (const item of lista) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "Un perfume de la lista no es válido.";
    if (typeof item.id !== "string" || typeof item.perfume !== "string" || item.perfume.length > 300) return "Un perfume de la lista no es válido.";
    if (!urlValida(item.url) || !urlValida(item.imagen ?? undefined)) return "Un enlace de la lista no es válido.";
  }
  if (!esListaDeTextos(alergias) || !esListaDeTextos(notas)) return "Las alergias no son válidas.";
  // Las listas propias son opcionales: los datos guardados antes de que existieran no las traen
  const listas = datos.listas ?? [];
  const listaValida = (l: any) =>
    l && typeof l === "object" && typeof l.id === "string" && l.id.length <= 64 && typeof l.nombre === "string" && l.nombre.trim() !== "" && l.nombre.length <= 60;
  if (!Array.isArray(listas) || listas.length > 50 || !listas.every(listaValida)) return "Las listas no son válidas.";
  for (const item of lista) if (item.listas !== undefined && !esListaDeTextos(item.listas)) return "Un perfume de la lista no es válido.";
  return { lista, alergias, notas, listas: listas.map((l: any) => ({ id: l.id, nombre: l.nombre.trim() })) };
}

// ── Cuentas y sesiones (sobre el almacén en memoria; quien llama lo guarda) ──
export async function crearUsuario(alm: AlmacenCuentas, email: string, contrasena: string): Promise<Usuario> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const usuario: Usuario = {
    id: crypto.randomUUID(),
    email,
    sal: aBase64(sal),
    hash: await derivar(contrasena, sal, ITERACIONES),
    iteraciones: ITERACIONES,
    creado: new Date().toISOString(),
  };
  alm.usuarios[email] = usuario;
  return usuario;
}

// Sal fija para el cálculo de relleno cuando el correo no existe: así la respuesta tarda lo mismo
const SAL_RELLENO = new Uint8Array(16);

export async function verificarContrasena(alm: AlmacenCuentas, email: string, contrasena: string): Promise<Usuario | null> {
  const usuario = alm.usuarios[email];
  if (!usuario) {
    await derivar(contrasena, SAL_RELLENO, ITERACIONES);
    return null;
  }
  const hash = await derivar(contrasena, deBase64(usuario.sal), usuario.iteraciones);
  return igualesTiempoConstante(hash, usuario.hash) ? usuario : null;
}

export async function nuevaSesion(alm: AlmacenCuentas, usuarioId: string, ahora = Date.now()): Promise<string> {
  const token = aBase64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
  alm.sesiones[await sha256(token)] = { usuario: usuarioId, expira: ahora + DURACION_SESION_MS };
  // Las sesiones vencidas se limpian de paso
  for (const [clave, s] of Object.entries(alm.sesiones)) if (s.expira < ahora) delete alm.sesiones[clave];
  return token;
}

export async function usuarioDeSesion(alm: AlmacenCuentas, token: string | null, ahora = Date.now()): Promise<Usuario | null> {
  if (!token || token.length > 100) return null;
  const sesion = alm.sesiones[await sha256(token)];
  if (!sesion || sesion.expira < ahora) return null;
  return Object.values(alm.usuarios).find((u) => u.id === sesion.usuario) ?? null;
}

export async function cerrarSesion(alm: AlmacenCuentas, token: string | null) {
  if (token) delete alm.sesiones[await sha256(token)];
}

function cerrarTodasLasSesiones(alm: AlmacenCuentas, usuarioId: string) {
  for (const [clave, s] of Object.entries(alm.sesiones)) if (s.usuario === usuarioId) delete alm.sesiones[clave];
}

// Pide la contraseña actual; al cambiarla se cierran las sesiones de los demás equipos
export async function cambiarContrasena(alm: AlmacenCuentas, usuario: Usuario, actual: string, nueva: string): Promise<boolean> {
  if (!(await verificarContrasena(alm, usuario.email, actual))) return false;
  const sal = crypto.getRandomValues(new Uint8Array(16));
  usuario.sal = aBase64(sal);
  usuario.hash = await derivar(nueva, sal, ITERACIONES);
  usuario.iteraciones = ITERACIONES;
  cerrarTodasLasSesiones(alm, usuario.id);
  return true;
}

export async function borrarUsuario(alm: AlmacenCuentas, usuario: Usuario, contrasena: string): Promise<boolean> {
  if (!(await verificarContrasena(alm, usuario.email, contrasena))) return false;
  delete alm.usuarios[usuario.email];
  cerrarTodasLasSesiones(alm, usuario.id);
  return true;
}

// ── Límite de intentos fallidos ──
export class LimiteIntentos {
  private fallos = new Map<string, number[]>();
  constructor(private maximo = 5, private ventanaMs = 15 * 60 * 1000) {}
  private recientes(clave: string, ahora: number) {
    const lista = (this.fallos.get(clave) || []).filter((t) => ahora - t < this.ventanaMs);
    this.fallos.set(clave, lista);
    return lista;
  }
  bloqueado(claves: string[], ahora = Date.now()) {
    return claves.some((c) => this.recientes(c, ahora).length >= this.maximo);
  }
  fallo(claves: string[], ahora = Date.now()) {
    for (const c of claves) this.recientes(c, ahora).push(ahora);
  }
  limpiar(clave: string) {
    this.fallos.delete(clave);
  }
}

// ── Cifrado de Mi Lista y alergias en disco ──
export interface Sobre {
  v: 1;
  iv: string; // 12 bytes al azar, distintos en cada guardado
  datos: string; // JSON cifrado con AES-256-GCM (incluye la etiqueta que detecta si alguien lo modificó)
}

// La clave sale de CLAVE_DATOS (32 bytes en base64) o de un archivo que se crea la primera vez.
// Si se pierde la clave, los datos guardados no se pueden recuperar.
export async function cargarOCrearClave(rutaArchivo: string): Promise<CryptoKey> {
  let base64 = Deno.env.get("CLAVE_DATOS")?.trim();
  if (!base64) {
    try {
      base64 = (await Deno.readTextFile(rutaArchivo)).trim();
    } catch {
      base64 = aBase64(crypto.getRandomValues(new Uint8Array(32)));
      await Deno.writeTextFile(rutaArchivo, base64 + "\n");
      console.log(`[Cuentas] Clave de cifrado nueva en ${rutaArchivo}: respáldala, sin ella no se leen los datos guardados.`);
    }
  }
  const bytes = deBase64(base64);
  if (bytes.length !== 32) throw new Error("La clave de datos debe tener 32 bytes en base64");
  return crypto.subtle.importKey("raw", bytes as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// El id del usuario va como dato asociado: un sobre copiado a la cuenta de otro no se puede abrir
export async function cifrarDatos(clave: CryptoKey, usuarioId: string, datos: unknown): Promise<Sobre> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(usuarioId) },
    clave,
    new TextEncoder().encode(JSON.stringify(datos)),
  );
  return { v: 1, iv: aBase64(iv), datos: aBase64(new Uint8Array(cifrado)) };
}

export async function descifrarDatos<T>(clave: CryptoKey, usuarioId: string, sobre: Sobre): Promise<T> {
  const claro = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deBase64(sobre.iv) as BufferSource, additionalData: new TextEncoder().encode(usuarioId) },
    clave,
    deBase64(sobre.datos) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(claro));
}

const esSobre = (x: any): x is Sobre => x && x.v === 1 && typeof x.iv === "string" && typeof x.datos === "string";

// ── Archivos: se escriben en uno temporal y se renombran, para no perder las cuentas si se corta a la mitad ──
export async function cargarJson<T>(ruta: string, vacio: T): Promise<T> {
  try {
    return JSON.parse(await Deno.readTextFile(ruta));
  } catch {
    return vacio;
  }
}

export function guardarJsonSeguro(ruta: string, datos: unknown): Promise<void> {
  return enCola(async () => {
    const temporal = `${ruta}.tmp`;
    await Deno.writeTextFile(temporal, JSON.stringify(datos));
    await Deno.rename(temporal, ruta);
  });
}

// ── Cookies ──
function leerCookie(cabecera: string | undefined, nombre: string): string | null {
  for (const parte of (cabecera || "").split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return v.join("=") || null;
  }
  return null;
}

function cookieDeSesion(token: string, segura: boolean, maxAge: number) {
  return `${NOMBRE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${segura ? "; Secure" : ""}`;
}

// ── Rutas /api/cuenta ──
export async function montarRutasCuenta(
  app: Hono,
  { archivoUsuarios, archivoDatos, archivoClave, origenPermitido, alBorrarUsuario }: {
    archivoUsuarios: string;
    archivoDatos: string;
    archivoClave: string;
    origenPermitido: (o: string) => boolean;
    alBorrarUsuario?: (usuarioId: string) => Promise<void>; // lo que otros módulos guardan de la cuenta (reseñas)
  },
) {
  const alm = await cargarJson<AlmacenCuentas>(archivoUsuarios, { usuarios: {}, sesiones: {} });
  const clave = await cargarOCrearClave(archivoClave);
  const datos = await cargarJson<Record<string, Sobre | (DatosUsuario & { actualizado: string })>>(archivoDatos, {});
  // Datos guardados antes del cifrado: se cifran al arrancar
  let habiaSinCifrar = false;
  for (const [id, d] of Object.entries(datos)) {
    if (!esSobre(d)) {
      datos[id] = await cifrarDatos(clave, id, d);
      habiaSinCifrar = true;
    }
  }
  if (habiaSinCifrar) await guardarJsonSeguro(archivoDatos, datos);
  const limite = new LimiteIntentos();
  const limiteRegistro = new LimiteIntentos(10, 60 * 60 * 1000);
  const guardarCuentas = () => guardarJsonSeguro(archivoUsuarios, alm);

  // Detrás del proxy de Railway la IP real es la última de x-forwarded-for (las anteriores las puede inventar el cliente)
  const ipDe = (c: any): string =>
    Deno.env.get("DETRAS_DE_PROXY") === "1"
      ? (c.req.header("x-forwarded-for") || "").split(",").pop()!.trim() || "sin-ip"
      : c.env?.remoteAddr?.hostname || "sin-ip";
  const esHttps = (c: any) => c.req.header("x-forwarded-proto") === "https" || c.req.url.startsWith("https:");
  const tokenDe = (c: any) => leerCookie(c.req.header("cookie"), NOMBRE_COOKIE);

  // Lo que cambia algo solo se acepta desde la propia aplicación (protección contra CSRF)
  const origenValido = (c: any) => origenPermitido(c.req.header("origin") || "");

  async function cuerpoJson(c: any): Promise<any | null> {
    const texto = await c.req.text();
    if (texto.length > MAX_CUERPO) return null;
    try {
      return JSON.parse(texto);
    } catch {
      return null;
    }
  }

  async function iniciarSesion(c: any, usuario: Usuario) {
    const token = await nuevaSesion(alm, usuario.id);
    await guardarCuentas();
    c.header("Set-Cookie", cookieDeSesion(token, esHttps(c), DURACION_SESION_MS / 1000));
    return c.json({ usuario: { email: usuario.email } });
  }

  app.get("/api/cuenta", async (c) => {
    const usuario = await usuarioDeSesion(alm, tokenDe(c));
    return usuario ? c.json({ usuario: { email: usuario.email } }) : c.json({ usuario: null }, 401);
  });

  app.post("/api/cuenta/registro", async (c) => {
    if (!origenValido(c)) return c.json({ error: "Origen no permitido." }, 403);
    const ip = ipDe(c);
    if (limiteRegistro.bloqueado([ip])) return c.json({ error: "Demasiados registros desde esta conexión. Intenta más tarde." }, 429);
    const cuerpo = await cuerpoJson(c);
    const email = normalizarEmail(cuerpo?.email);
    if (!email) return c.json({ error: "Escribe un correo válido." }, 400);
    const error = errorDeContrasena(cuerpo?.contrasena);
    if (error) return c.json({ error }, 400);
    limiteRegistro.fallo([ip]); // cuenta cada intento de registro, no solo los fallidos
    if (alm.usuarios[email]) return c.json({ error: "Ya existe una cuenta con ese correo. Entra con tu contraseña." }, 409);
    const usuario = await crearUsuario(alm, email, cuerpo.contrasena);
    return iniciarSesion(c, usuario);
  });

  app.post("/api/cuenta/entrar", async (c) => {
    if (!origenValido(c)) return c.json({ error: "Origen no permitido." }, 403);
    const cuerpo = await cuerpoJson(c);
    const email = normalizarEmail(cuerpo?.email);
    const claves = [`ip:${ipDe(c)}`, `email:${email || "invalido"}`];
    if (limite.bloqueado(claves)) return c.json({ error: "Demasiados intentos. Espera unos minutos y vuelve a intentar." }, 429);
    const usuario = email && typeof cuerpo?.contrasena === "string" && cuerpo.contrasena.length <= 128
      ? await verificarContrasena(alm, email, cuerpo.contrasena)
      : null;
    if (!usuario) {
      limite.fallo(claves);
      return c.json({ error: "Correo o contraseña incorrectos." }, 401);
    }
    limite.limpiar(`email:${email}`);
    return iniciarSesion(c, usuario);
  });

  app.post("/api/cuenta/salir", async (c) => {
    if (!origenValido(c)) return c.json({ error: "Origen no permitido." }, 403);
    await cerrarSesion(alm, tokenDe(c));
    await guardarCuentas();
    c.header("Set-Cookie", cookieDeSesion("", esHttps(c), 0));
    return c.body(null, 204);
  });

  // Cambiar la contraseña o borrar la cuenta pide la contraseña actual, con el mismo límite de intentos que entrar
  async function conContrasena(c: any, accion: (usuario: Usuario, cuerpo: any) => Promise<Response | null>) {
    if (!origenValido(c)) return c.json({ error: "Origen no permitido." }, 403);
    const usuario = await usuarioDeSesion(alm, tokenDe(c));
    if (!usuario) return c.json({ error: "Inicia sesión." }, 401);
    const claves = [`ip:${ipDe(c)}`, `email:${usuario.email}`];
    if (limite.bloqueado(claves)) return c.json({ error: "Demasiados intentos. Espera unos minutos y vuelve a intentar." }, 429);
    const cuerpo = await cuerpoJson(c);
    if (typeof cuerpo?.contrasena !== "string" || cuerpo.contrasena.length > 128) return c.json({ error: "Escribe tu contraseña actual." }, 400);
    const respuesta = await accion(usuario, cuerpo);
    if (respuesta) return respuesta;
    limite.fallo(claves);
    return c.json({ error: "La contraseña actual no es correcta." }, 401);
  }

  app.post("/api/cuenta/contrasena", (c) =>
    conContrasena(c, async (usuario, cuerpo) => {
      const error = errorDeContrasena(cuerpo.nueva);
      if (error) return c.json({ error }, 400);
      if (!(await cambiarContrasena(alm, usuario, cuerpo.contrasena, cuerpo.nueva))) return null;
      return iniciarSesion(c, usuario); // las demás sesiones quedaron cerradas; esta sigue con un token nuevo
    }));

  app.post("/api/cuenta/borrar", (c) =>
    conContrasena(c, async (usuario, cuerpo) => {
      if (!(await borrarUsuario(alm, usuario, cuerpo.contrasena))) return null;
      delete datos[usuario.id];
      await guardarCuentas();
      await guardarJsonSeguro(archivoDatos, datos);
      await alBorrarUsuario?.(usuario.id);
      c.header("Set-Cookie", cookieDeSesion("", esHttps(c), 0));
      return c.body(null, 204);
    }));

  app.get("/api/cuenta/datos", async (c) => {
    const usuario = await usuarioDeSesion(alm, tokenDe(c));
    if (!usuario) return c.json({ error: "Inicia sesión." }, 401);
    const sobre = datos[usuario.id];
    let d: DatosUsuario | null = null;
    if (esSobre(sobre)) {
      try {
        d = await descifrarDatos<DatosUsuario>(clave, usuario.id, sobre);
      } catch {
        // Clave distinta a la que los cifró: no se pueden leer (no se muestra nada del contenido)
        console.error("[Cuentas] No se pudieron descifrar los datos de un usuario: ¿cambió la clave?");
      }
    }
    return c.json(d ? { lista: d.lista, alergias: d.alergias, notas: d.notas, listas: d.listas ?? [] } : { lista: [], alergias: [], notas: [], listas: [] });
  });

  app.put("/api/cuenta/datos", async (c) => {
    if (!origenValido(c)) return c.json({ error: "Origen no permitido." }, 403);
    const usuario = await usuarioDeSesion(alm, tokenDe(c));
    if (!usuario) return c.json({ error: "Inicia sesión." }, 401);
    const cuerpo = await cuerpoJson(c);
    const validos = validarDatos(cuerpo);
    if (typeof validos === "string") return c.json({ error: validos }, 400);
    datos[usuario.id] = await cifrarDatos(clave, usuario.id, { ...validos, actualizado: new Date().toISOString() });
    await guardarJsonSeguro(archivoDatos, datos);
    return c.body(null, 204);
  });

  // Para otras rutas que necesitan saber quién está conectado (reseñas)
  return { usuarioDe: (c: any) => usuarioDeSesion(alm, tokenDe(c)) };
}
