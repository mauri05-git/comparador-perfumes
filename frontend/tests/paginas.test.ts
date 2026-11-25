// Ejecutar con: node tests/paginas.test.ts
import { paginasVisibles } from '../src/paginas.ts';

const casos: [number, number, string][] = [
  [1, 39, '1 2 3 4 5 … 39'],
  [4, 39, '1 2 3 4 5 … 39'],
  [5, 39, '1 … 3 4 5 6 7 … 39'],
  [20, 39, '1 … 18 19 20 21 22 … 39'],
  [36, 39, '1 … 35 36 37 38 39'],
  [39, 39, '1 … 35 36 37 38 39'],
  [3, 6, '1 2 3 4 5 6'],
  [1, 1, '1'],
];
for (const [actual, total, esperado] of casos) {
  const obtenido = paginasVisibles(actual, total).join(' ');
  if (obtenido !== esperado) throw new Error(`página ${actual} de ${total}: "${obtenido}", se esperaba "${esperado}"`);
}
console.log(`ok: ${casos.length} casos de paginación`);
