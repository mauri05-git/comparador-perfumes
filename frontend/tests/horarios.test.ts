// Ejecutar con: node tests/horarios.test.ts
import { abiertoAhora } from '../src/horarios.ts';

function igual(real: unknown, esperado: unknown, caso: string) {
  if (real !== esperado) throw new Error(`${caso}: esperaba ${esperado}, salió ${real}`);
}

// 2026-11-13 es viernes; 2026-11-14 sábado; 2026-11-15 domingo
const viernes = (h: number, m = 0) => new Date(2026, 10, 13, h, m);
const sabado = (h: number) => new Date(2026, 10, 14, h);
const domingo = (h: number) => new Date(2026, 10, 15, h);

igual(abiertoAhora('Lunes a Domingo: 10:00 - 21:00', viernes(12)), true, 'todos los días, mediodía');
igual(abiertoAhora('Lunes a Domingo: 10:00 - 21:00', domingo(12)), true, 'domingo dentro de lunes a domingo');
igual(abiertoAhora('Lunes a Domingo: 10:00 - 21:00', viernes(21)), false, 'justo a la hora de cierre');
igual(abiertoAhora('Lunes a Domingo: 10:00 - 21:00', viernes(9, 59)), false, 'antes de abrir');

const dbs = 'Lunes a Viernes: 10:00 - 19:30, Sáb: 10:00 - 15:00';
igual(abiertoAhora(dbs, viernes(19, 15)), true, 'viernes antes del cierre');
igual(abiertoAhora(dbs, sabado(14)), true, 'sábado abreviado');
igual(abiertoAhora(dbs, sabado(16)), false, 'sábado después del cierre');
igual(abiertoAhora(dbs, domingo(12)), false, 'domingo no aparece: cerrado');

const ahumada = 'Lunes a Viernes: 08:00 - 21:00 · Sábado: 09:00 - 20:00 · Domingo: 10:00 - 14:00';
igual(abiertoAhora(ahumada, domingo(13)), true, 'domingo con su propio tramo');
igual(abiertoAhora(ahumada, domingo(15)), false, 'domingo fuera de su tramo');

igual(abiertoAhora('Abierto 24 horas', viernes(3)), true, '24 horas');
igual(abiertoAhora('Lunes a Viernes: 09:00:00 - 21:00:00 · Sábado: 09:00:00 - 21:00:00', viernes(20, 30)), true, 'con segundos');
igual(abiertoAhora('Consultar en tienda', viernes(12)), null, 'horario que no se entiende');
igual(abiertoAhora('', viernes(12)), null, 'sin horario');

console.log('ok: horarios');
