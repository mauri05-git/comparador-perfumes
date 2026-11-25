// Ejecutar con: node tests/lecturaRadar.test.ts
import { caracterPrincipal, diferenciasOlfativas, loQueLoDistingue } from '../src/lecturaRadar.ts';

const fresco = { frescura: 79, dulzor: 20, amaderado: 43, especiado: 18, floral: 36, intensidad: 68 };
const dulce = { frescura: 43, dulzor: 74, amaderado: 43, especiado: 36, floral: 18, intensidad: 86 };

function asegurar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(mensaje);
}

const frases = diferenciasOlfativas(fresco, dulce, 'Acqua di Giò', 'Eros');
asegurar(frases[0] === 'Eros es más dulce', frases.join(' | ')); // la diferencia más grande va primero
asegurar(frases.includes('Acqua di Giò es más fresco'), frases.join(' | '));
asegurar(!frases.some((f) => f.includes('amaderado')), 'iguales en amaderado: no se nombra');
asegurar(diferenciasOlfativas(fresco, { ...fresco, floral: 46 }, 'A', 'B').length === 0, 'una diferencia menor a una nota no cuenta');
asegurar(caracterPrincipal(fresco) === 'frescura', caracterPrincipal(fresco));
asegurar(caracterPrincipal(dulce) === 'dulzor', caracterPrincipal(dulce));
asegurar(caracterPrincipal({ ...fresco, intensidad: 99 }) === 'frescura', 'la intensidad no es un olor');
// Eros: tanta frescura como dulzor; frente a uno más fresco, lo que lo distingue es lo dulce
const eros = { frescura: 79, dulzor: 79, amaderado: 43, especiado: 36, floral: 18, intensidad: 86 };
asegurar(caracterPrincipal(eros) === 'frescura', 'empate: gana el primero');
asegurar(loQueLoDistingue(eros, fresco) === 'dulzor', loQueLoDistingue(eros, fresco));
asegurar(loQueLoDistingue(fresco, eros) === 'floral', loQueLoDistingue(fresco, eros)); // 36 vs 18
asegurar(loQueLoDistingue(fresco, fresco) === 'frescura', 'iguales: lo que más lo define');
console.log('ok: lectura del radar');
