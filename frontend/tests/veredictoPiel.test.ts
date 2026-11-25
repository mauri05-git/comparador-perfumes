// Ejecutar con: node tests/veredictoPiel.test.ts
import { veredictoPiel, type LadoPiel } from '../src/veredictoPiel.ts';

function igual(real: string, esperado: string) {
  if (real !== esperado) throw new Error(`esperaba "${esperado}", salió "${real}"`);
}

const acqua: LadoPiel = { nombre: 'Acqua di Gio', declara: true, choques: ['Salicilato de Bencilo'], total: 10 };
const sauvage: LadoPiel = { nombre: 'Sauvage', declara: true, choques: [], total: 6 };
const eros: LadoPiel = { nombre: 'Eros', declara: false, choques: [], total: 3 };

igual(veredictoPiel(acqua, sauvage, true).titulo, 'Sauvage es mejor para tu piel');
igual(veredictoPiel(sauvage, acqua, true).detalle, 'Acqua di Gio declara Salicilato de Bencilo; Sauvage no los declara en su envase.');
// el otro no tiene lista: no se le da por bueno
igual(veredictoPiel(acqua, eros, true).titulo, 'Acqua di Gio tiene tus alérgenos');
igual(veredictoPiel(sauvage, eros, true).titulo, 'Sin verificar');
igual(veredictoPiel(sauvage, eros, true).detalle, 'Falta la lista del envase de Eros: revisa la caja antes de comprar.');
igual(veredictoPiel(sauvage, { ...sauvage, nombre: 'Bleu' }, true).titulo, 'Ninguno tiene tus alérgenos');
igual(
  veredictoPiel(acqua, { ...eros, choques: ['Limoneno', 'Linalool'] }, true).detalle,
  'Acqua di Gio declara Salicilato de Bencilo; Eros podría contener (según sus notas) Limoneno y Linalool.',
);
igual(veredictoPiel(acqua, sauvage, false).titulo, 'Configura tus alergias');

console.log('ok: veredictoPiel');
