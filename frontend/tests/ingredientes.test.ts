// Ejecutar con: node tests/ingredientes.test.ts
import { esListaResumida, leerIngredientes } from '../src/ingredientes.ts';

function asegurar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(mensaje);
}

// Lista real de My Way EDP publicada por Falabella
const myWay = 'Alcohol, Perfume/Fragancia, Agua, Linalool, Salicilato De Bencilo, Alcohol Bencílico, Hidroxicitronelal, Limoneno, Salicilato De Etilhexilo, Butil Metoxidibenzoilmetano, Antranilato De Metilo, Hexil Cinamal, Geraniol, Citronelol, Eugenol, Citral, Alfa-Isometil Ionona, Citrato De Tris(Tetrametilhidroxipiperidinol), Isoeugenol, Cinamal, Benzoato De Bencilo, Ci 17200/Rojo 33, Ci 60730/Ext. Violeta 2';
const r = leerIngredientes(myWay, 'Eau de Parfum');
asegurar(r !== null && r.items.length === 23, `items: ${r?.items.length}`);
const tipo = (nombre: string) => r!.items.find((i) => i.nombre === nombre)?.tipo;
asegurar(tipo('Alcohol') === 'solvente', 'alcohol es la base');
asegurar(tipo('Alcohol Bencílico') === 'alergeno', 'alcohol bencílico es alérgeno, no la base');
asegurar(tipo('Perfume/Fragancia') === 'fragancia', 'fragancia');
asegurar(tipo('Agua') === 'agua', 'agua');
asegurar(tipo('Salicilato De Etilhexilo') === 'filtro_uv', 'filtro UV, no alérgeno');
asegurar(tipo('Salicilato De Bencilo') === 'alergeno', 'salicilato de bencilo es alérgeno');
asegurar(tipo('Hexil Cinamal') === 'alergeno', 'hexil cinamal es alérgeno');
asegurar(tipo('Ci 17200/Rojo 33') === 'colorante', 'colorante');
asegurar(tipo('Citrato De Tris(Tetrametilhidroxipiperidinol)') === 'estabilizante', 'estabilizante');
asegurar(r!.items[0].cantidad === '≈ 70–84 %', `alcohol EDP: ${r!.items[0].cantidad}`);
asegurar(r!.items[1].cantidad === '≈ 15–20 %', `fragancia EDP: ${r!.items[1].cantidad}`);

// My Way Ylang: alcohol de anís es alérgeno y el colorante viene mal traducido
const ylang = leerIngredientes('Alcohol, Perfume/Fragancia, Agua, Alcohol De Anís, Farnesol, Canela, En 19140 / Año 5', 'EDP');
const tipoY = (nombre: string) => ylang!.items.find((i) => i.nombre === nombre)?.tipo;
asegurar(tipoY('Alcohol De Anís') === 'alergeno', `alcohol de anís: ${tipoY('Alcohol De Anís')}`);
asegurar(tipoY('En 19140 / Año 5') === 'colorante', 'colorante CI mal traducido');
asegurar(ylang!.items.filter((i) => i.tipo === 'solvente').length === 1, 'una sola base de alcohol');
asegurar(leerIngredientes('Alcohol Denat., Parfum, Aqua')?.items[0].tipo === 'solvente', 'alcohol denat');

// Acqua di Giò EDT: Falabella publica la lista sin separadores
const adg = leerIngredientes('Alcohol Aqua / Agua Perfume / Fragancia Bht Linalol Geraniol Eugenol Alfa-Isometil Ionona Alcohol Cinamílico Limoneno Citral Citronelol Butilfenil Metilpropional Salicilato De Bencilo', 'EDT');
asegurar(
  adg?.items.map((i) => i.nombre).join('|') === 'Alcohol|Aqua / Agua|Perfume / Fragancia|Bht|Linalol|Geraniol|Eugenol|Alfa-Isometil Ionona|Alcohol Cinamílico|Limoneno|Citral|Citronelol|Butilfenil Metilpropional|Salicilato De Bencilo',
  `sin comas: ${adg?.items.map((i) => i.nombre).join('|')}`,
);
asegurar(adg!.items.find((i) => i.nombre === 'Linalol')?.tipo === 'alergeno', 'linalol es alérgeno');
asegurar(adg!.items.find((i) => i.nombre === 'Alcohol Cinamílico')?.tipo === 'alergeno', 'alcohol cinamílico es alérgeno');
asegurar(adg!.items[0].cantidad === '≈ 75–94 %', `alcohol EDT: ${adg!.items[0].cantidad}`);

// Bad Boy EDT: nombre del producto entre asteriscos y un "Alcohol" repetido más abajo
const bb = leerIngredientes('*** Bad Boy Eau De Toilette *** Alcohol Denat, Parfum (Fragrance), Aqua (Water), Coumarin, Linalool, Alpha-Isomethyl Ionone, Methyl 2-Octynoate, Alcohol, Hydroxycitronellal, Ci 60730 (Ext. Violet 2)', 'EDT');
asegurar(bb!.items[0].nombre === 'Alcohol Denat', `sin el título: ${bb!.items[0].nombre}`);
asegurar(bb!.items.find((i) => i.nombre === 'Alpha-Isomethyl Ionone')?.tipo === 'alergeno', 'alpha-isomethyl ionone es alérgeno');
asegurar(bb!.items.filter((i) => i.tipo === 'solvente').length === 1, 'el alcohol repetido no vuelve a ser la base');
asegurar(bb!.items.find((i) => i.nombre === 'Alcohol')?.cantidad === 'menos de 1 %', 'alcohol repetido sin rango grande');

// Lista resumida por el vendedor: no prueba que falten alérgenos
asegurar(esListaResumida(leerIngredientes('Alcohol - Parfum - Aqua')!), 'D&G resumida');
asegurar(!esListaResumida(leerIngredientes(myWay)!), 'My Way completa');

// Otros formatos de Falabella
const dg = leerIngredientes('Alcohol - Parfum - Aqua', 'EDT');
asegurar(dg?.items.map((i) => i.tipo).join(',') === 'solvente,fragancia,agua', `D&G: ${dg?.items.map((i) => i.tipo)}`);
asegurar(dg?.concentracion === 'Eau de Toilette', 'concentración EDT');
asegurar(leerIngredientes('Alcohol • Perfume / Fragancia • Linalool • Limoneno')?.items.length === 4, 'separador •');

// Textos que no son listas
asegurar(leerIngredientes('Alcohol agua fragancia aroma aceites esenciales bergamota') === null, 'descripción libre');
asegurar(leerIngredientes('Madreselva, jazmín, sándalo, almizcle') === null, 'notas olfativas');
asegurar(leerIngredientes('perfume') === null, 'una palabra');
asegurar(leerIngredientes(undefined) === null, 'sin texto');

console.log('ok');
