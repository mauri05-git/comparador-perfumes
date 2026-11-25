// Ejecutar con: deno test -A cuentas_test.ts
import {
  type AlmacenCuentas,
  borrarUsuario,
  cambiarContrasena,
  cargarOCrearClave,
  cifrarDatos,
  descifrarDatos,
  cerrarSesion,
  crearUsuario,
  errorDeContrasena,
  guardarJsonSeguro,
  igualesTiempoConstante,
  LimiteIntentos,
  normalizarEmail,
  nuevaSesion,
  usuarioDeSesion,
  validarDatos,
  verificarContrasena,
} from "./cuentas.ts";

function assert(condicion: unknown, mensaje: string) {
  if (!condicion) throw new Error(mensaje);
}
const vacio = (): AlmacenCuentas => ({ usuarios: {}, sesiones: {} });

Deno.test("la contraseña se guarda derivada y se verifica", async () => {
  const alm = vacio();
  const u = await crearUsuario(alm, "ana@correo.cl", "clave-segura-1");
  assert(!JSON.stringify(alm).includes("clave-segura-1"), "la contraseña no debe quedar en el almacén");
  assert(u.iteraciones >= 600_000, "iteraciones según OWASP");
  assert((await verificarContrasena(alm, "ana@correo.cl", "clave-segura-1"))?.id === u.id, "contraseña correcta");
  assert((await verificarContrasena(alm, "ana@correo.cl", "clave-segura-2")) === null, "contraseña incorrecta");
  assert((await verificarContrasena(alm, "nadie@correo.cl", "clave-segura-1")) === null, "correo inexistente");
});

Deno.test("dos usuarios con la misma contraseña tienen hashes distintos (sal por usuario)", async () => {
  const alm = vacio();
  const a = await crearUsuario(alm, "a@correo.cl", "misma-clave");
  const b = await crearUsuario(alm, "b@correo.cl", "misma-clave");
  assert(a.hash !== b.hash && a.sal !== b.sal, "sal distinta");
});

Deno.test("sesiones: el token no se guarda, vence y se puede cerrar", async () => {
  const alm = vacio();
  const u = await crearUsuario(alm, "ana@correo.cl", "clave-segura-1");
  const token = await nuevaSesion(alm, u.id, 1_000);
  assert(!JSON.stringify(alm.sesiones).includes(token), "solo se guarda el hash del token");
  assert((await usuarioDeSesion(alm, token, 2_000))?.id === u.id, "sesión válida");
  assert((await usuarioDeSesion(alm, token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"), 2_000)) === null, "token alterado");
  assert((await usuarioDeSesion(alm, token, 1_000 + 31 * 24 * 3600 * 1000)) === null, "sesión vencida");
  assert((await usuarioDeSesion(alm, null)) === null, "sin cookie");
  await cerrarSesion(alm, token);
  assert((await usuarioDeSesion(alm, token, 2_000)) === null, "después de cerrar sesión");
});

Deno.test("cambiar contraseña y borrar cuenta piden la actual y cierran las sesiones", async () => {
  const alm = vacio();
  const u = await crearUsuario(alm, "ana@correo.cl", "clave-segura-1");
  const token = await nuevaSesion(alm, u.id, 1_000);
  assert(!(await cambiarContrasena(alm, u, "otra-cosa-1", "clave-nueva-2")), "rechaza sin la actual");
  assert((await usuarioDeSesion(alm, token, 2_000))?.id === u.id, "un intento fallido no cierra la sesión");
  assert(await cambiarContrasena(alm, u, "clave-segura-1", "clave-nueva-2"), "cambia con la actual");
  assert((await verificarContrasena(alm, "ana@correo.cl", "clave-segura-1")) === null, "la vieja ya no sirve");
  assert((await verificarContrasena(alm, "ana@correo.cl", "clave-nueva-2"))?.id === u.id, "la nueva sí");
  assert((await usuarioDeSesion(alm, token, 2_000)) === null, "las sesiones anteriores se cierran");
  const otro = await nuevaSesion(alm, u.id, 1_000);
  assert(!(await borrarUsuario(alm, u, "clave-segura-1")), "no borra sin la contraseña");
  assert(await borrarUsuario(alm, u, "clave-nueva-2"), "borra con la contraseña");
  assert(!alm.usuarios["ana@correo.cl"] && (await usuarioDeSesion(alm, otro, 2_000)) === null, "sin usuario ni sesiones");
});

Deno.test("validación de correo, contraseña y datos", () => {
  assert(normalizarEmail("  Ana@Correo.CL ") === "ana@correo.cl", "normaliza");
  assert(normalizarEmail("sin-arroba") === null && normalizarEmail(42) === null, "rechaza inválidos");
  assert(errorDeContrasena("corta") !== null && errorDeContrasena("x".repeat(129)) !== null, "largo");
  assert(errorDeContrasena("suficiente") === null, "válida");
  assert(typeof validarDatos({ lista: [], alergias: ["linalool"], notas: [] }) === "object", "datos válidos");
  assert(typeof validarDatos({ lista: [{ id: "1", perfume: "Sauvage", url: "javascript:alert(1)" }], alergias: [], notas: [] }) === "string", "url peligrosa");
  assert(typeof validarDatos({ lista: "no", alergias: [], notas: [] }) === "string", "lista inválida");
  assert(typeof validarDatos({ lista: [], alergias: [{}], notas: [] }) === "string", "alergias inválidas");
  const conListas = validarDatos({ lista: [{ id: "1", perfume: "Sauvage", listas: ["l1"] }], alergias: [], notas: [], listas: [{ id: "l1", nombre: " Verano " }] });
  assert(typeof conListas === "object" && conListas.listas[0].nombre === "Verano", "listas propias válidas");
  assert(typeof validarDatos({ lista: [], alergias: [], notas: [] }) === "object", "sin listas (datos antiguos)");
  assert(typeof validarDatos({ lista: [], alergias: [], notas: [], listas: [{ id: "l1", nombre: "" }] }) === "string", "lista sin nombre");
  assert(typeof validarDatos({ lista: [{ id: "1", perfume: "Sauvage", listas: [5] }], alergias: [], notas: [] }) === "string", "pertenencia inválida");
});

Deno.test("límite de intentos fallidos", () => {
  const limite = new LimiteIntentos(5, 15 * 60 * 1000);
  for (let i = 0; i < 5; i++) limite.fallo(["ip:1"], 1_000 + i);
  assert(limite.bloqueado(["ip:1"], 2_000), "bloquea al quinto");
  assert(!limite.bloqueado(["ip:2"], 2_000), "otra IP no");
  assert(!limite.bloqueado(["ip:1"], 1_000 + 16 * 60 * 1000), "se libera después de la ventana");
});

Deno.test("comparación en tiempo constante", () => {
  assert(igualesTiempoConstante("abc", "abc") && !igualesTiempoConstante("abc", "abd") && !igualesTiempoConstante("abc", "ab"), "compara bien");
});

Deno.test("guardado seguro: escribe completo y sin dejar el temporal", async () => {
  const ruta = await Deno.makeTempFile({ suffix: ".json" });
  await guardarJsonSeguro(ruta, { usuarios: { a: 1 } });
  assert(JSON.parse(await Deno.readTextFile(ruta)).usuarios.a === 1, "contenido");
  let quedoTemporal = true;
  try { await Deno.stat(`${ruta}.tmp`); } catch { quedoTemporal = false; }
  assert(!quedoTemporal, "no queda el .tmp");
  await Deno.remove(ruta);
});

Deno.test("Mi Lista y alergias quedan cifradas y solo las abre su dueño", async () => {
  const ruta = await Deno.makeTempFile({ suffix: ".key" });
  await Deno.remove(ruta); // que la cree
  const anterior = Deno.env.get("CLAVE_DATOS");
  Deno.env.delete("CLAVE_DATOS");
  try {
    const clave = await cargarOCrearClave(ruta);
    const datos = { lista: [{ id: "1", perfume: "Sauvage" }], alergias: ["linalool"], notas: [], listas: [] };
    const sobre = await cifrarDatos(clave, "usuario-a", datos);
    assert(!JSON.stringify(sobre).includes("linalool") && !JSON.stringify(sobre).includes("Sauvage"), "en disco no se lee el contenido");
    assert(JSON.stringify(await descifrarDatos(clave, "usuario-a", sobre)) === JSON.stringify(datos), "su dueño lo abre");
    let abrioOtro = true;
    try { await descifrarDatos(clave, "usuario-b", sobre); } catch { abrioOtro = false; }
    assert(!abrioOtro, "copiado a otra cuenta no se abre");
    const otraVez = await cargarOCrearClave(ruta);
    assert(JSON.stringify(await descifrarDatos(otraVez, "usuario-a", sobre)) === JSON.stringify(datos), "la clave guardada se reutiliza");
    const alterado = { ...sobre, datos: sobre.datos.slice(0, -4) + (sobre.datos.endsWith("AAA=") ? "BBB=" : "AAA=") };
    let abrioAlterado = true;
    try { await descifrarDatos(clave, "usuario-a", alterado); } catch { abrioAlterado = false; }
    assert(!abrioAlterado, "un sobre modificado se rechaza");
  } finally {
    if (anterior) Deno.env.set("CLAVE_DATOS", anterior);
    try { await Deno.remove(ruta); } catch { /* ya no está */ }
  }
});
