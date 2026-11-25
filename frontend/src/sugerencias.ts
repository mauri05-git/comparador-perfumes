// Sugerencias del campo de perfume (favoritos, recientes, populares) y fotos del catálogo para un nombre.
import { type ItemListaCompra } from './components/ListaComprasDrawer';
import { sinTildes } from './alergenos';
import { terminoDeBusqueda } from './nombres';
import { type GrupoPerfumes, type OpcionPerfume } from './components/CampoPerfume';
import { t } from './i18n.ts';
import { normalizarImagen } from './ofertas.ts';

// ─────────────────────────────────────────────
//  Componente: COMPARADOR LADO A LADO (Arena VS + Matriz Criterio por Criterio + Radar 6D + IFRA)
// ─────────────────────────────────────────────
export function buscarImagenRespaldoCatalogo(nombre: string): string | null {
  const n = nombre.toLowerCase();
  if (n.includes('acqua di gio') || n.includes('acqua di giò')) return '/perfumes/acqua-di-gio.jpg';
  if (n.includes('sauvage')) return '/perfumes/sauvage-dior.jpg';
  if (n.includes('bleu de chanel') || n.includes('bleu chanel')) return '/perfumes/bleu-de-chanel.jpg';
  if (n.includes('good girl')) return '/perfumes/good-girl.jpg';
  if (n.includes('eros')) return '/perfumes/versace-eros.jpg';
  if (n.includes('nautica') || n.includes('voyage')) return '/perfumes/nautica-voyage.jpg';
  return null;
}

// Opciones del campo de perfume: tus favoritos, las búsquedas recientes y, si se pide, los populares
// Foto del catálogo para un nombre suelto ("Sauvage Dior", "Light Blue Dolce Gabbana"): el producto cuyas palabras
// (marca y nombre, en cualquier orden) están todas en lo escrito; si hay varios, el más completo.
export type ConFoto = { nombre: string; marca: string; imagen?: string | null };

export const palabrasDeNombre = (t: string) => new Set(sinTildes(t.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean));

export function fotoDelCatalogo(catalogo: ConFoto[], texto: string): string | null {
  const escritas = palabrasDeNombre(texto);
  let mejor: { foto: string; largo: number } | null = null;
  for (const c of catalogo) {
    if (!c.imagen) continue;
    const suyas = palabrasDeNombre(`${c.marca} ${c.nombre}`);
    if (suyas.size && [...suyas].every((p) => escritas.has(p)) && (!mejor || suyas.size > mejor.largo)) {
      mejor = { foto: c.imagen, largo: suyas.size };
    }
  }
  return mejor ? normalizarImagen(mejor.foto) : null;
}

export function gruposDePerfumes(lista: ItemListaCompra[], recientes: string[], conPopulares: boolean, catalogo: ConFoto[] = []): GrupoPerfumes[] {
  const vistos = new Set<string>();
  const nuevo = (o: OpcionPerfume) => {
    const clave = sinTildes(o.nombre.toLowerCase());
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  };
  const grupos: GrupoPerfumes[] = [{
    titulo: t('Tus favoritos'),
    opciones: lista
      .map((i) => ({
        nombre: terminoDeBusqueda(i.perfume, i.marca),
        detalle: [i.tienda, i.ml ? `${i.ml} ml` : '', i.precioGuardado ? `$${i.precioGuardado.toLocaleString('es-CL')}` : '']
          .filter(Boolean)
          .join(' · '),
        imagen: normalizarImagen(i.imagen),
      }))
      .filter(nuevo),
  }];
  grupos.push({ titulo: t('Búsquedas recientes'), opciones: recientes.map((nombre) => ({ nombre, imagen: fotoDelCatalogo(catalogo, nombre) })).filter(nuevo) });
  if (conPopulares) {
    grupos.push({
      titulo: t('Populares'),
      opciones: POPULARES_CHILE.map((p) => ({ nombre: p.nombre, detalle: p.marca, imagen: fotoDelCatalogo(catalogo, `${p.marca} ${p.nombre}`) })).filter(nuevo),
    });
  }
  return grupos;
}

// ─────────────────────────────────────────────
//  COMPONENTE PRINCIPAL: App
// ─────────────────────────────────────────────
export const POPULARES_CHILE = [
  {
    nombre: 'Acqua Di Gio',
    marca: 'Giorgio Armani',
    precioAprox: 'Desde $99.990',
    precioNum: 99990,
    familia: 'Cítrico Acuático Marino',
    imagen: '/perfumes/acqua-di-gio.jpg',
    alergenosIds: ['limonene', 'linalool'],
  },
  {
    nombre: 'Sauvage Dior',
    marca: 'Dior',
    precioAprox: 'Desde $109.990',
    precioNum: 109990,
    familia: 'Amaderado Especiado Fresco',
    imagen: '/perfumes/sauvage-dior.jpg',
    alergenosIds: ['limonene', 'eugenol'],
  },
  {
    nombre: 'Bleu de Chanel',
    marca: 'Chanel',
    precioAprox: 'Desde $125.000',
    precioNum: 125000,
    familia: 'Amaderado Aromático',
    imagen: '/perfumes/bleu-de-chanel.jpg',
    alergenosIds: ['limonene', 'citral'],
  },
  {
    nombre: 'Good Girl',
    marca: 'Carolina Herrera',
    precioAprox: 'Desde $78.990',
    precioNum: 78990,
    familia: 'Ámbar Floral Dulce',
    imagen: '/perfumes/good-girl.jpg',
    alergenosIds: ['coumarin', 'linalool'],
  },
  {
    nombre: 'Versace Eros',
    marca: 'Versace',
    precioAprox: 'Desde $64.990',
    precioNum: 64990,
    familia: 'Aromático Fougère Fresco',
    imagen: '/perfumes/versace-eros.jpg',
    alergenosIds: ['coumarin', 'limonene'],
  },
  {
    nombre: 'Nautica Voyage',
    marca: 'Nautica',
    precioAprox: 'Desde $24.990',
    precioNum: 24990,
    familia: 'Acuático Manzana Verde',
    imagen: '/perfumes/nautica-voyage.jpg',
    alergenosIds: [],
  },
];
