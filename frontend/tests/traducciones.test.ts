// Ejecutar con: node tests/traducciones.test.ts
// Revisa que cada texto que la interfaz pasa por t() / tn() tenga su traducción al inglés, con los mismos {valores}.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EN } from '../src/i18n/en.ts';
import { t, tn, tServidor, usarIdioma } from '../src/i18n.ts';

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((n) => {
    const ruta = join(carpeta, n);
    if (statSync(ruta).isDirectory()) return n === 'i18n' ? [] : archivos(ruta);
    return /\.(ts|tsx)$/.test(n) && n !== 'i18n.ts' ? [ruta] : [];
  });
}

// Textos literales dentro de t('…'), t("…") y los dos de tn(n, '…', '…')
const literal = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`;
const deT = new RegExp(String.raw`\bt\(\s*(?:${literal})`, 'g');
const deTn = new RegExp(String.raw`\btn\(\s*[^,]+,\s*(?:${literal})\s*,\s*(?:${literal})`, 'g');
const sinEscape = (s: string) => s.replace(/\\(['"\\])/g, '$1');

const usados = new Map<string, string>(); // texto -> archivo donde aparece
for (const ruta of archivos(join(import.meta.dirname, '../src'))) {
  const codigo = readFileSync(ruta, 'utf8');
  for (const m of codigo.matchAll(deT)) usados.set(sinEscape(m[1] ?? m[2]), ruta);
  for (const m of codigo.matchAll(deTn)) {
    usados.set(sinEscape(m[1] ?? m[2]), ruta);
    usados.set(sinEscape(m[3] ?? m[4]), ruta);
  }
}

const valoresDe = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const faltan: string[] = [];
const malValores: string[] = [];
for (const [texto, ruta] of usados) {
  if (!(texto in EN)) faltan.push(`${ruta.split(/[\\/]/).pop()}: ${texto}`);
  else if (valoresDe(texto) !== valoresDe(EN[texto])) malValores.push(`${texto}  ->  ${EN[texto]}`);
}
if (faltan.length) {
  console.error(`Faltan ${faltan.length} traducciones al inglés:\n  ${faltan.join('\n  ')}`);
  process.exit(1);
}
if (malValores.length) {
  console.error(`Traducciones con otros {valores} que el español:\n  ${malValores.join('\n  ')}`);
  process.exit(1);
}

// Los mensajes que manda el backend y la app muestra (tServidor): los de `mensaje: "…"` / `error: "…"` y los que
// devuelven las validaciones de cuentas y reseñas. Los que traen valores (`…${x}…`) se reconocen por su forma.
const backend = join(import.meta.dirname, '../../backend');
const deServidor = new Set<string>();
for (const archivo of ['server.ts', 'cuentas.ts', 'utilidades.ts']) {
  const codigo = readFileSync(join(backend, archivo), 'utf8');
  for (const m of codigo.matchAll(/\b(?:mensaje|error):\s*"((?:[^"\\]|\\.)*)"/g)) deServidor.add(m[1]);
  for (const m of codigo.matchAll(/^\s*if \([^\n]*\) return "((?:[^"\\]|\\.)*)";/gm)) deServidor.add(m[1]);
}
const sinTraducirServidor = [...deServidor].filter((m) => !(m in EN));
if (sinTraducirServidor.length) {
  console.error(`Faltan ${sinTraducirServidor.length} mensajes del backend en inglés:\n  ${sinTraducirServidor.join('\n  ')}`);
  process.exit(1);
}

// La función misma
usarIdioma('en');
EN['__prueba {n}'] = 'test {n}';
if (t('__prueba {n}', { n: 3 }) !== 'test 3') throw new Error('t() no puso el valor');
if (t('texto sin traducir') !== 'texto sin traducir') throw new Error('sin traducción debe quedar el español');
usarIdioma('es');
if (tn(1, '{n} oferta', '{n} ofertas') !== '1 oferta' || tn(2, '{n} oferta', '{n} ofertas') !== '2 ofertas') {
  throw new Error('tn() no eligió singular o plural');
}

usarIdioma('en');
if (tServidor('Correo o contraseña incorrectos.') !== 'Wrong email or password.') throw new Error('tServidor no tradujo un mensaje fijo');
if (tServidor('Error interno: timeout') !== 'Internal error: timeout') throw new Error('tServidor no reconoció un mensaje con valores');
if (tServidor('3 fragancias descubiertas con Rosa + Oud.') !== '3 fragrances discovered with Rosa + Oud.') throw new Error('tServidor: fragancias descubiertas');
if (tServidor(undefined) !== '') throw new Error('tServidor sin mensaje');
usarIdioma('es');
if (tServidor('Correo o contraseña incorrectos.') !== 'Correo o contraseña incorrectos.') throw new Error('en español, tal cual');

console.log(`ok: traducciones (${usados.size} textos de la interfaz, ${deServidor.size} del backend)`);
