// Tipos de datos que comparten la app y sus componentes (ofertas, fichas, locales, reseñas).
import { type DatosRadar } from './components/RadarOlfativoChart';
import { type AlergenoDetectado } from './components/SistemaAlergias';

// ─────────────────────────────────────────────
//  Tipos de Datos
// ─────────────────────────────────────────────
export interface PrecioMercado {
  tienda: string;
  nombre: string;
  precio: number | null;
  moneda: string;
  stock: string;
  url: string;
  imagen: string | null;
  // De la ficha del producto en la tienda (hoy Falabella): lista de ingredientes y notas publicadas
  ingredientes?: string;
  notasTienda?: string;
  alergenosDeclarados?: AlergenoDetectado[];
  // La oferta no publica su lista: se tomó la de otra presentación del mismo perfume y concentración
  ingredientesOrigen?: { nombre: string; tienda: string; url: string };
  // Precio de la búsqueda anterior, mientras su tienda todavía no responde
  deMemoria?: boolean;
  // Ninguna tienda respondió: es el precio de la búsqueda anterior (fecha de esa búsqueda), sin confirmar hoy
  sinConfirmarDesde?: string;
  // La página del producto no respondió (Falabella bloqueando con 403): faltan sus notas e ingredientes
  detalleNoDisponible?: boolean;
}

export interface PerfumeSimilar {
  nombre: string;
  marca: string;
  motivo: string;
  precio_estimado?: string;
}

export interface FichaFragancia {
  nombre: string;
  marca: string;
  concentracion: string;
  familia_olfativa: string;
  acordes_principales?: string[];
  genero: string;
  notas_salida: string[];
  notas_corazon: string[];
  notas_fondo: string[];
  duracion_horas: number;
  proyeccion: string;
  sillage?: string;
  estaciones: string[];
  ocasiones: string[];
  mejor_momento_dia?: string;
  publico_objetivo?: string;
  intensidad?: string;
  presentaciones_habituales?: string[];
  radar_olfativo?: DatosRadar;
  alergenos_detectados?: AlergenoDetectado[];
  alergenos_fuente?: 'ingredientes';
  alergenos_origen?: string;
  sin_notas?: boolean;
  // De dónde salió la ficha: sin origen, la escribió la IA de memoria; 'tiendas', con lo que publican las tiendas (la
  // IA no conocía el perfume); 'curada', la de respaldo escrita a mano; 'catalogo', el resumen guardado en el catálogo
  origen?: 'tiendas' | 'curada' | 'catalogo';
  guia_aplicacion?: {
    atomizaciones: string;
    puntos_pulso: string[];
    consejo_experto: string;
    clima_ideal: string;
  };
  descripcion: string;
  similares_olfativos?: PerfumeSimilar[];
  similares_precio?: PerfumeSimilar[];
  // Los textos de la ficha en inglés (la IA la escribe en español). Solo los campos que calzaron con el español
  en?: Partial<Pick<FichaFragancia, 'familia_olfativa' | 'acordes_principales' | 'notas_salida' | 'notas_corazon' | 'notas_fondo' |
    'estaciones' | 'ocasiones' | 'mejor_momento_dia' | 'sillage' | 'publico_objetivo' | 'descripcion' | 'guia_aplicacion'>>;
}

export interface RegistroHistorial {
  fecha: string;
  tienda: string;
  precio: number;
  ml?: number | null;
  nombre?: string;
  url?: string;
}

export interface Review {
  id: string;
  perfume: string;
  usuario: string;
  rating: number;
  duracion_horas: number;
  comentario: string;
  fecha: string;
}

export interface Sucursal {
  tienda: string;
  nombre: string;
  direccion: string;
  horario: string;
  comuna: string;
  region: string;
  telefono: string;
  lat?: number;
  lng?: number;
  distancia?: number;
  fuente?: 'scraping' | 'referencial';
}

export interface PerfumeComparado {
  nombre: string;
  precios: PrecioMercado[];
  mejorPrecio: number | null;
  ficha: FichaFragancia | null;
  reviews: Review[];
}
