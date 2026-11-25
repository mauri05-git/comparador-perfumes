// Ejecutar con: node tests/etiquetas.test.ts
import { etiquetasDeNotas, etiquetasDePerfume, familiaCatalogoDesde, ocasionesCatalogoDesde } from '../src/etiquetas.ts';
import { coincideFlexible, corregirBusqueda, distancia, nombresDistintos } from '../src/busquedaFlexible.ts';

function igual(real: unknown, esperado: unknown) {
  const [a, b] = [JSON.stringify(real), JSON.stringify(esperado)];
  if (a !== b) throw new Error(`esperaba ${b}, salió ${a}`);
}

// Etiquetas: palabras completas de las notas
igual(etiquetasDeNotas(['Bergamota', 'Pimienta rosa', 'Cedro', 'Ambroxan']), [
  'Madera (Cedro / Sándalo / Oud)', 'Bergamota / Limón', 'Pimienta / Especias', 'Ámbar / Ambroxan',
]);
igual(etiquetasDeNotas(['Jazmín', 'Haba tonka', 'Palo de rosa']), ['Madera (Cedro / Sándalo / Oud)', 'Vainilla / Haba Tonka', 'Jazmín / Rosa / Iris']);
// las que antes se colaban por pedazos de palabra
igual(etiquetasDeNotas('una fragancia poderosa que experimenta con el entorno universal y espera'), []);
igual(etiquetasDeNotas(['Mandarina', 'Piña', 'Pera', 'Sal marina']), ['Bergamota / Limón', 'Notas Marinas', 'Frutal / Coco / Manzana']);
igual(etiquetasDeNotas(['Amaderado', 'Aromático', 'Especiado']), ['Madera (Cedro / Sándalo / Oud)', 'Pimienta / Especias', 'Lavanda / Menta']);

// Para los filtros mandan los acordes; de las notas solo cuentan las que definen al perfume (chocolate, café...)
igual(etiquetasDePerfume(['Bergamota', 'Jazmín', 'Cacao', 'Cedro', 'Vainilla'], ['Dulce', 'Especiado']), ['Chocolate / Cacao', 'Pimienta / Especias']);
igual(etiquetasDePerfume(['Bergamota', 'Cedro'], []), ['Madera (Cedro / Sándalo / Oud)', 'Bergamota / Limón']); // sin acordes: todas las notas

igual(familiaCatalogoDesde('Amaderado Especiado'), 'Amaderado / Aromático');
igual(familiaCatalogoDesde('Oriental Floral'), 'Ámbar / Especiado');
igual(familiaCatalogoDesde('Aromática Fougère'), 'Amaderado / Aromático');
igual(familiaCatalogoDesde('Acuático Aromático'), 'Cítrico / Acuático');
igual(familiaCatalogoDesde('Almizclado'), 'Sin clasificar');
igual(familiaCatalogoDesde(''), 'Sin clasificar');

igual(ocasionesCatalogoDesde(['Casual', 'Citas', 'Noche']), ['Oficina & Diario', 'Noche & Fiesta', 'Citas Románticas']);
igual(ocasionesCatalogoDesde([]), []);

// Búsqueda flexible
igual(distancia('savage', 'sauvage'), 1);
igual(distancia('erso', 'eros'), 1);
const conocidos = ['Dior Sauvage', 'Versace Eros', 'Versace Eros Flame', 'Giorgio Armani Acqua di Giò', 'Chanel Bleu de Chanel', 'Hugo Boss Boss Bottled'];
igual(corregirBusqueda('savage dior', conocidos), 'sauvage dior');
igual(corregirBusqueda('versache eroz', conocidos), 'versace eros');
igual(corregirBusqueda('perfume aqua di gio', conocidos), 'perfume acqua di gio');
igual(corregirBusqueda('channel', conocidos), 'chanel');
igual(corregirBusqueda('Dior Sauvage', conocidos), null); // bien escrita
igual(corregirBusqueda('eros flame', conocidos), null);
igual(corregirBusqueda('khamrah qahwa', conocidos), null); // perfume que no se conoce: se busca tal cual
igual(corregirBusqueda("bois d'argent", conocidos), null); // "bois" se parece a "boss", pero "argent" no calza con nada
igual(corregirBusqueda('eau de parfum', conocidos), null);

igual(coincideFlexible('Dior Sauvage Eau de Toilette', 'savage'), true);
igual(coincideFlexible('Dior Sauvage Eau de Toilette', 'sauv dio'), true); // se está escribiendo
igual(coincideFlexible('Giorgio Armani Acqua di Giò', 'aqua gio'), true);
igual(coincideFlexible('Versace Eros', 'sauvage'), false);

// La IA puso otro perfume de la marca en vez del buscado
igual(nombresDistintos('armani power of you', 'Emporio Armani Stronger With You', 'Giorgio Armani'), true);
igual(nombresDistintos('my way ylang', 'My Way Intense', 'Giorgio Armani'), true);
// Mismo perfume con más o menos palabras
igual(nombresDistintos('one million', '1 Million', 'Paco Rabanne'), false);
igual(nombresDistintos('ysl libre', 'Libre Eau de Parfum', 'Yves Saint Laurent'), false);
igual(nombresDistintos('acqua di gio', 'Acqua di Giò Pour Homme', 'Giorgio Armani'), false);
igual(nombresDistintos('bois dargent dior', "Bois d'Argent", 'Dior'), false);
igual(nombresDistintos('bleu chanel', 'Bleu de Chanel', 'Chanel'), false);
igual(nombresDistintos('Paco 1 Million Golden Oud Set de Regalo 3 Piezas para Hombre 100 ml Perfume', '1 Million Golden Oud', 'Paco Rabanne'), false);

console.log('ok: etiquetas y búsqueda flexible');
