// Ejecutar con: node tests/paraTi.test.ts  (Node 24 corre TypeScript directamente)
import { recomendarParaTi } from '../src/paraTi.ts';

function asegurar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(mensaje);
}

function perfume(id: string, nombre: string, familia: string, notas: string[], precio: number, alergenos: string[] = []) {
  return {
    id, nombre, marca: 'Marca', subtitulo: '', precioReferencia: precio, ml: 100,
    concentracion: 'Eau de Parfum (EDP)', genero: 'Unisex', familia, notas, notasDetalle: [],
    estaciones: [], ocasion: 'Oficina & Diario', duracionHoras: 8, proyeccion: 'Alta',
    alergenosIds: alergenos, imagen: null, colorFrasco: { primario: '', secundario: '', acento: '', forma: 'clasico' },
  } as any;
}

const catalogo = [
  perfume('1', 'Good Girl', 'Dulce / Gourmand', ['Vainilla / Haba Tonka', 'Chocolate / Cacao'], 90000),
  perfume('2', 'La Vie Est Belle', 'Dulce / Gourmand', ['Vainilla / Haba Tonka', 'Jazmín / Rosa / Iris'], 100000),
  perfume('3', 'Bad Boy', 'Ámbar / Especiado', ['Chocolate / Cacao', 'Pimienta / Especias'], 95000, ['cinnamal']),
  perfume('4', 'Acqua di Gio', 'Cítrico / Acuático', ['Notas Marinas'], 80000),
  perfume('5', 'Power Of You', 'Sin clasificar', [], 90000),
];

// Le gusta Good Girl: recomienda La Vie Est Belle (familia + vainilla) antes que Bad Boy (solo cacao)
let r = recomendarParaTi(catalogo, [{ nombre: 'Good Girl', peso: 3 }], [], []);
asegurar(r[0]?.item.nombre === 'La Vie Est Belle', 'primero La Vie Est Belle: ' + r.map(x => x.item.nombre));
asegurar(r[0].motivo.startsWith('Como Good Girl: misma familia'), 'motivo explicado: ' + r[0].motivo);
asegurar(!r.some(x => x.item.nombre === 'Good Girl'), 'no recomienda lo que ya le gusta');
asegurar(!r.some(x => x.item.nombre === 'Acqua di Gio'), 'sin familia ni notas en comun no se recomienda');
asegurar(!r.some(x => x.item.nombre === 'Power Of You'), 'sin clasificar no se recomienda');

// Alergia a cinamal excluye Bad Boy
r = recomendarParaTi(catalogo, [{ nombre: 'Good Girl', peso: 3 }], ['cinnamal'], []);
asegurar(!r.some(x => x.item.nombre === 'Bad Boy'), 'excluye alergenos del usuario');

// Nota personalizada a evitar ("jazmín") excluye La Vie Est Belle
r = recomendarParaTi(catalogo, [{ nombre: 'Good Girl', peso: 3 }], [], ['jazmín']);
asegurar(!r.some(x => x.item.nombre === 'La Vie Est Belle'), 'excluye notas a evitar');

// Busqueda con marca ("Carolina Herrera Good Girl") tambien cuenta como gusto
r = recomendarParaTi(catalogo, [{ nombre: 'Carolina Herrera Good Girl', peso: 1 }], [], []);
asegurar(r.length > 0, 'reconoce la busqueda con marca');

// Sin senales, sin recomendaciones
asegurar(recomendarParaTi(catalogo, [], [], []).length === 0, 'sin senales no recomienda');

console.log('ok: paraTi');
