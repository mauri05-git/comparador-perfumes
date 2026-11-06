import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Search,
  Camera,
  Scale,
  ShoppingBag,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Sun,
  Moon,
  Store,
  MapPin,
  TrendingUp,
  Star,
  Droplets,
  Wind,
  Heart,
  ExternalLink,
  Check,
  Award,
  Compass,
  Printer,
  Navigation,
  Clock,
  Phone,
  Activity,
  X,
  AlertCircle,
  ArrowLeftRight,
  Zap,
} from 'lucide-react';
import './App.css';
import { RadarOlfativoChart, type DatosRadar } from './components/RadarOlfativoChart';
import {
  BannerSemaforoAlergia,
  ModalPerfilAlergias,
  evaluarRiesgoAlergia,
  CATALOGO_ALERGIAS_IFRA,
  type AlergenoDetectado,
} from './components/SistemaAlergias';
import { ModalListaCompras, type ItemListaCompra } from './components/ListaComprasDrawer';
import { ConsolaLogsModal, type EntradaLogSistema } from './components/ConsolaLogsModal';
import { QuizDescubridor } from './components/QuizDescubridor';
import {
  CatalogoFiltrosSidebar,
  CATALOGO_FRAGANCIAS_CHILE,
  aprenderPerfumeEnCatalogoLocal,
  etiquetasDeNotas,
  familiaCatalogoDesde,
  type FraganciaCatalogoItem,
} from './components/CatalogoFiltrosSidebar';

// ─────────────────────────────────────────────
//  Tipos de Datos
// ─────────────────────────────────────────────
interface PrecioMercado {
  tienda: string;
  nombre: string;
  precio: number | null;
  moneda: string;
  stock: string;
  url: string;
  imagen: string | null;
}

interface PerfumeSimilar {
  nombre: string;
  marca: string;
  motivo: string;
  precio_estimado?: string;
}

interface FichaFragancia {
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
  guia_aplicacion?: {
    atomizaciones: string;
    puntos_pulso: string[];
    consejo_experto: string;
    clima_ideal: string;
  };
  descripcion: string;
  similares_olfativos?: PerfumeSimilar[];
  similares_precio?: PerfumeSimilar[];
}

interface RegistroHistorial {
  fecha: string;
  tienda: string;
  precio: number;
  ml?: number | null;
  nombre?: string;
}

interface Review {
  id: string;
  perfume: string;
  usuario: string;
  rating: number;
  duracion_horas: number;
  comentario: string;
  fecha: string;
}

interface Sucursal {
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

const MAX_SUCURSALES_VISIBLES = 12;

interface PerfumeComparado {
  nombre: string;
  precios: PrecioMercado[];
  mejorPrecio: number | null;
  ficha: FichaFragancia | null;
  reviews: Review[];
}

const ESTILO_TIENDA: Record<string, { color: string; bg: string }> = {
  "Falabella":          { color: "#15803d", bg: "rgba(22, 163, 74, 0.12)" },
  "DBS Beauty Store":   { color: "#be185d", bg: "rgba(219, 39, 119, 0.12)" },
  "Alisha Perfumes":    { color: "#b45309", bg: "rgba(217, 119, 6, 0.12)" },
  "Farmacias Ahumada":  { color: "#0369a1", bg: "rgba(2, 132, 199, 0.12)" },
};

const API_BASE = "http://localhost:8000";

// ─────────────────────────────────────────────
//  Helpers de Formato, ML, Radar y Clasificación
// ─────────────────────────────────────────────
function normalizarImagen(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/perfumes/")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

function extraerMl(nombre: string): number | null {
  if (!nombre) return null;
  const match = nombre.match(/\b(\d{1,3})\s*(?:ml|m\b)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 5 && val <= 500) return val;
  }
  return null;
}

// Mismo producto según su URL (en Falabella, el id de /product/{id}); igual que mismoProducto() del backend
function mismoProductoUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  const clave = (url: string | null | undefined) => {
    const u = (url || '').trim().toLowerCase().split(/[?#]/)[0].replace(/\/+$/, '');
    const falabella = u.match(/falabella\.com\/.*\/product\/(\d+)/);
    return falabella ? `falabella:${falabella[1]}` : u;
  };
  const ca = clave(a);
  return ca !== '' && ca === clave(b);
}

// Concentración según el nombre que publica la tienda; null si no la indica
function extraerConcentracion(nombre: string): string | null {
  const n = (nombre || '').toLowerCase();
  if (/\beau de toilette\b|\bedt\b/.test(n)) return 'Eau de Toilette';
  if (/\beau de parfum\b|\bedp\b/.test(n)) return 'Eau de Parfum';
  if (/\beau de cologne\b|\bedc\b|\bcologne\b|\bcolonia\b/.test(n)) return 'Eau de Cologne';
  if (/\bextrait\b|\bparfum\b/.test(n)) return 'Parfum';
  return null;
}

const PATRON_CONCENTRACION = /\b(extrait de parfum|eau de (toilette|parfum|cologne)|edt|edp|edc|parfum)\b/gi;

function calcularPrecioPorMl(precio: number | null, ml: number | null): string | null {
  if (!precio || !ml || ml <= 0) return null;
  const porMl = Math.round(precio / ml);
  return `~$${porMl.toLocaleString('es-CL')}/ml`;
}

function obtenerRadarDeFicha(ficha: FichaFragancia | null | undefined): DatosRadar {
  if (ficha?.radar_olfativo && typeof ficha.radar_olfativo.frescura === 'number') {
    return ficha.radar_olfativo;
  }
  const txt = [
    ficha?.familia_olfativa || '',
    ...(ficha?.acordes_principales || []),
    ...(ficha?.notas_salida || []),
    ...(ficha?.notas_corazon || []),
    ...(ficha?.notas_fondo || []),
  ].join(' ').toLowerCase();

  const count = (words: string[]) => words.reduce((a, w) => (txt.includes(w) ? a + 1 : a), 0);
  const sc = (base: number, n: number) => Math.min(96, Math.max(22, base + n * 18));

  return {
    frescura: sc(30, count(['acuático', 'marino', 'cítrico', 'bergamota', 'limón', 'menta', 'fresco', 'verde'])),
    dulzor: sc(22, count(['vainilla', 'tonka', 'caramelo', 'cacao', 'dulce', 'ámbar', 'almendra', 'miel'])),
    amaderado: sc(28, count(['cedro', 'sándalo', 'vetiver', 'pachulí', 'madera', 'amaderado', 'incienso', 'roble'])),
    especiado: sc(24, count(['pimienta', 'canela', 'cardamomo', 'jengibre', 'especiado', 'tabaco', 'cuero'])),
    floral: sc(25, count(['rosa', 'jazmín', 'lavanda', 'iris', 'neroli', 'floral', 'azahar', 'geranio'])),
    intensidad: ficha?.duracion_horas ? Math.min(96, ficha.duracion_horas * 10) : 72,
  };
}

function detectarGeneroProducto(nombre: string, generoFicha?: string): 'hombre' | 'mujer' | 'unisex' {
  const n = nombre.toLowerCase();
  if (n.includes('hombre') || n.includes('homme') || n.includes('men') || n.includes('masculin')) return 'hombre';
  if (n.includes('mujer') || n.includes('femme') || n.includes('woman') || n.includes('women') || n.includes('dama') || n.includes('lady')) return 'mujer';
  if (n.includes('unisex')) return 'unisex';
  
  if (generoFicha) {
    const g = generoFicha.toLowerCase();
    if (g.includes('masculin') || g.includes('hombre')) return 'hombre';
    if (g.includes('femenin') || g.includes('mujer')) return 'mujer';
    if (g.includes('unisex')) return 'unisex';
  }
  return 'unisex';
}

function calcularDistanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function BottlePlaceholder({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 120 140" fill="none" aria-hidden="true">
      <rect x="46" y="10" width="28" height="16" rx="4" fill="#d97706" />
      <rect x="52" y="26" width="16" height="10" fill="#94a3b8" />
      <rect x="26" y="36" width="68" height="90" rx="14" fill="#1e293b" stroke="#60a5fa" strokeWidth="2.5" />
      <rect x="38" y="62" width="44" height="34" rx="4" fill="#f8fafc" />
      <line x1="46" y1="74" x2="74" y2="74" stroke="#0f172a" strokeWidth="2.5" />
      <line x1="50" y1="84" x2="70" y2="84" stroke="#64748b" strokeWidth="2" />
    </svg>
  );
}

// ─────────────────────────────────────────────
//  Componente: Tarjeta de Oferta Individual (Editorial M3)
// ─────────────────────────────────────────────
function TarjetaPrecio({
  item,
  esMenor = false,
  esSeleccionado = false,
  enListaCompras = false,
  onSeleccionar,
  onGuardarLista,
}: {
  item: PrecioMercado;
  esMenor?: boolean;
  esSeleccionado?: boolean;
  enListaCompras?: boolean;
  onSeleccionar?: () => void;
  onGuardarLista?: () => void;
}) {
  const imgUrl = normalizarImagen(item.imagen);
  const ml = extraerMl(item.nombre);
  const precioPorMl = calcularPrecioPorMl(item.precio, ml);
  const badgeTienda = ESTILO_TIENDA[item.tienda] || { color: 'var(--m3-primary)', bg: 'var(--m3-primary-container)' };

  return (
    <div className={`m3-product-card ${esSeleccionado ? 'selected-ref' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '6px' }}>
        <span
          style={{
            fontSize: '11px',
            color: badgeTienda.color,
            background: badgeTienda.bg,
            padding: '4px 10px',
            borderRadius: '99px',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Store size={12} strokeWidth={2.2} /> {item.tienda}
        </span>

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {esMenor && (
            <span style={{ background: '#16a34a', color: 'white', fontSize: '10px', padding: '3px 8px', borderRadius: '99px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Award size={11} /> Mejor Precio
            </span>
          )}
          {onGuardarLista && (
            <button
              type="button"
              onClick={onGuardarLista}
              title={enListaCompras ? 'Guardado en tu lista' : 'Guardar en mi lista de compras'}
              style={{
                border: '1px solid var(--m3-outline-variant)',
                background: enListaCompras ? 'rgba(220, 38, 38, 0.12)' : 'var(--m3-surface-container)',
                color: enListaCompras ? '#dc2626' : 'var(--m3-text-secondary)',
                borderRadius: '99px',
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.18s ease',
              }}
            >
              <Heart size={12} fill={enListaCompras ? '#dc2626' : 'none'} />
              {enListaCompras ? 'Guardado' : 'Guardar'}
            </button>
          )}
        </div>
      </div>

      {imgUrl && (
        <div className="m3-card-img-wrap">
          <img
            src={imgUrl}
            alt={item.nombre}
            className="m3-card-img"
            onError={(e) => {
              const padre = e.currentTarget.parentElement as HTMLElement;
              if (padre) padre.style.display = 'none';
            }}
          />
        </div>
      )}

      <div>
        <p className="m3-editorial-title" style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 700, color: 'var(--m3-text-primary)', lineHeight: 1.35, minHeight: '40px' }}>
          {item.nombre}
        </p>

        {ml && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span className="m3-volume-badge">
              <Droplets size={11} /> {ml} ml
            </span>
            {precioPorMl && <span className="m3-price-per-ml">{precioPorMl}</span>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--m3-outline-variant)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--m3-primary)', fontFamily: 'var(--font-mono)' }}>
            {item.precio !== null ? `$${item.precio.toLocaleString('es-CL')}` : 'Consultar'}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: item.stock === 'En Stock' ? '#16a34a' : item.stock === 'Agotado' ? '#dc2626' : '#94a3b8' }}>
            ● {item.stock}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onSeleccionar && (
            <button
              onClick={onSeleccionar}
              className="m3-btn m3-btn-tonal"
              style={{
                flex: 1, padding: '8px 10px', fontSize: '11.5px',
                background: esSeleccionado ? 'var(--m3-primary)' : undefined,
                color: esSeleccionado ? '#fff' : undefined
              }}
            >
              {esSeleccionado ? <><Check size={13} /> Activo</> : 'Seleccionar'}
            </button>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="m3-btn m3-btn-outlined"
              style={{ flex: 1, padding: '8px 10px', fontSize: '11.5px', textDecoration: 'none' }}
            >
              Tienda <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Componente: Ficha Olfativa, Radar 6D y Alergias
// ─────────────────────────────────────────────
function FichaFraganciaCard({
  ficha,
  alergiasIds,
  notasCustom,
  onAbrirAlergias,
  onVerSimilares,
  onGuardarFicha,
}: {
  ficha: FichaFragancia;
  alergiasIds: string[];
  notasCustom: string[];
  onAbrirAlergias: () => void;
  onVerSimilares?: () => void;
  onGuardarFicha?: () => void;
}) {
  const PROYECCION_COLOR: Record<string, string> = {
    'Muy Baja': '#94a3b8', 'Baja': '#64748b', 'Media': '#2563eb', 'Alta': '#d97706', 'Bestia': '#dc2626',
  };
  const INTENSIDAD_COLOR: Record<string, string> = {
    'Ligero': '#22c55e', 'Moderado': '#2563eb', 'Intenso': '#d97706', 'Muy Intenso': '#dc2626',
  };

  const radarDatos = obtenerRadarDeFicha(ficha);

  return (
    <div className="m3-ficha-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {ficha.marca} · {ficha.concentracion}
          </span>
          <h3 className="m3-editorial-title" style={{ margin: '3px 0 0 0', fontSize: '1.65rem', color: 'var(--m3-text-primary)', fontWeight: 800 }}>
            {ficha.nombre}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onGuardarFicha && (
            <button onClick={onGuardarFicha} className="m3-btn m3-btn-tonal" style={{ fontSize: '12px' }}>
              <ShoppingBag size={14} /> Guardar en Lista
            </button>
          )}
          {onVerSimilares && (
            <button onClick={onVerSimilares} className="m3-btn m3-btn-outlined" style={{ fontSize: '12px' }}>
              <Sparkles size={14} /> Ver Similares
            </button>
          )}
        </div>
      </div>

      {/* Semáforo de Alergias en Ficha */}
      <BannerSemaforoAlergia
        ficha={ficha}
        alergiasIds={alergiasIds}
        notasCustom={notasCustom}
        onAbrirConfig={onAbrirAlergias}
      />

      <p style={{ fontSize: '14px', color: 'var(--m3-text-secondary)', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.6 }}>
        "{ficha.descripcion}"
      </p>

      {/* Radar Olfativo Visual 6D */}
      <RadarOlfativoChart radar1={radarDatos} nombre1={ficha.nombre} />

      {/* Grid de atributos M3 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
        background: 'var(--m3-surface-container-lowest)',
        padding: '18px',
        borderRadius: 'var(--m3-shape-lg)',
        border: '1px solid var(--m3-outline-variant)'
      }}>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>Familia</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)' }}>{ficha.familia_olfativa}</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>Género</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)' }}>{ficha.genero}</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>Longevidad</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#15803d' }}>~{ficha.duracion_horas} horas</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>Proyección</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: PROYECCION_COLOR[ficha.proyeccion] ?? 'var(--m3-text-primary)' }}>{ficha.proyeccion}</span>
        </div>
        {ficha.intensidad && (
          <div>
            <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>Intensidad</span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: INTENSIDAD_COLOR[ficha.intensidad] ?? 'var(--m3-text-primary)' }}>{ficha.intensidad}</span>
          </div>
        )}
        {ficha.mejor_momento_dia && (
          <div>
            <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>Momento</span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)' }}>{ficha.mejor_momento_dia}</span>
          </div>
        )}
      </div>

      {/* Acordes Principales */}
      {ficha.acordes_principales && ficha.acordes_principales.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>
            Acordes Dominantes
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {ficha.acordes_principales.map(a => (
              <span key={a} style={{
                background: 'var(--m3-primary-container)', color: 'var(--m3-primary)',
                borderRadius: 'var(--m3-shape-full)', padding: '5px 13px', fontSize: '12px', fontWeight: 700
              }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pirámide Olfativa Visual */}
      <div style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-lg)', padding: '18px' }}>
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
            Notas de Salida · Apertura (0 – 15 min)
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ficha.notas_salida.map(n => (
              <span key={n} style={{ background: 'var(--m3-gold-soft)', color: 'var(--m3-gold)', border: '1px solid var(--m3-gold-border)', borderRadius: 'var(--m3-shape-full)', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                {n}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
            Notas de Corazón · Cuerpo Aromático (15 min – 3h)
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ficha.notas_corazon.map(n => (
              <span key={n} style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', borderRadius: 'var(--m3-shape-full)', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                {n}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
            Notas de Fondo · Fijación y Estela (3h+)
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ficha.notas_fondo.map(n => (
              <span key={n} style={{ background: 'var(--m3-secondary-container)', color: 'var(--m3-secondary)', borderRadius: 'var(--m3-shape-full)', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Componente: Guía de Aplicación & ML (M3)
// ─────────────────────────────────────────────
function GuiaAplicacionCard({ ficha }: { ficha: FichaFragancia }) {
  const guia = ficha.guia_aplicacion || {
    atomizaciones: "3 a 4 atomizaciones (2 en lados del cuello, 1 en muñecas)",
    puntos_pulso: ["Cuello lateral", "Interior de las muñecas", "Detrás de las orejas", "Pecho"],
    consejo_experto: "Aplica inmediatamente tras la ducha sobre piel limpia e hidratada. NUNCA frotes las muñecas entre sí, ya que la fricción destruye las moléculas de salida.",
    clima_ideal: "Excelente rendimiento en clima templado a cálido"
  };

  const presentaciones = ficha.presentaciones_habituales || ["50 ml", "100 ml", "200 ml"];

  return (
    <div className="m3-app-guide-box">
      <div className="m3-guide-header">
        <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.15rem', color: 'var(--m3-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wind size={18} style={{ color: '#16a34a' }} /> Protocolo de Aplicación y Fijación
        </h4>
        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '4px 10px', borderRadius: '99px', background: 'rgba(22, 163, 74, 0.14)', color: '#16a34a', textTransform: 'uppercase' }}>
          Guía Sommelier
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--m3-text-secondary)', margin: '6px 0 16px 0', lineHeight: 1.5 }}>
        Optimiza el rendimiento de <strong>{ficha.nombre}</strong> según su concentración ({ficha.concentracion}) e intensidad ({ficha.intensidad || 'Moderado'}).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div style={{ background: 'var(--m3-surface-container-lowest)', padding: '14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Atomizaciones Ideales
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)' }}>
            {guia.atomizaciones}
          </p>
        </div>

        <div style={{ background: 'var(--m3-surface-container-lowest)', padding: '14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Clima Recomendado
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', fontWeight: 600, color: 'var(--m3-text-secondary)' }}>
            {guia.clima_ideal}
          </p>
        </div>

        <div style={{ background: 'var(--m3-surface-container-lowest)', padding: '14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Formatos Comerciales
          </span>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {presentaciones.map(p => (
              <span key={p} className="m3-volume-badge">
                <Droplets size={11} /> {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--m3-surface-container-lowest)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)', marginBottom: '12px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
          Puntos de Pulso Recomendados
        </span>
        <div className="m3-pulse-points-grid">
          {guia.puntos_pulso.map(pt => (
            <span key={pt} className="m3-pulse-chip">
              <Check size={12} style={{ color: '#16a34a' }} /> {pt}
            </span>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--m3-gold-soft)', border: '1px solid var(--m3-gold-border)', borderRadius: '12px', padding: '12px 16px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Consejo del Maestro Perfumista
        </span>
        <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--m3-text-primary)', lineHeight: 1.5 }}>
          {guia.consejo_experto}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Componente: Historial y Tendencias (M3)
// ─────────────────────────────────────────────
export function HistorialPreciosCard({ historial }: { historial: RegistroHistorial[] }) {
  if (!historial || historial.length === 0) return null;

  const preciosValidos = historial.map(h => h.precio);
  const minPrecio = Math.min(...preciosValidos);
  const maxPrecio = Math.max(...preciosValidos);
  const ultimo = historial[historial.length - 1]?.precio || minPrecio;
  const primero = historial[0]?.precio || ultimo;
  const diferencia = ultimo - primero;
  const porcentaje = primero > 0 ? ((diferencia / primero) * 100).toFixed(1) : "0";

  return (
    <div style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-xl)', padding: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--m3-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} style={{ color: 'var(--m3-primary)' }} /> Tendencia e Historial de Precios
        </h4>
        <span style={{
          fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '99px',
          background: diferencia < 0 ? 'rgba(22, 163, 74, 0.14)' : (diferencia > 0 ? 'rgba(220, 38, 38, 0.14)' : 'var(--m3-surface-container)'),
          color: diferencia < 0 ? '#15803d' : (diferencia > 0 ? '#dc2626' : 'var(--m3-text-secondary)')
        }}>
          {diferencia < 0 ? `Bajó un ${Math.abs(Number(porcentaje))}%` : (diferencia > 0 ? `Subió un ${porcentaje}%` : "Precio estable")}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '130px', padding: '10px 0', borderBottom: '1px solid var(--m3-outline-variant)' }}>
        {historial.slice(-6).map((item, idx) => {
          const ratio = maxPrecio > minPrecio ? (item.precio - minPrecio) / (maxPrecio - minPrecio) : 0.5;
          const barHeight = Math.max(30, ratio * 90);
          return (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--m3-text-tertiary)', marginBottom: '5px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                ${(item.precio / 1000).toFixed(0)}k
              </span>
              <div style={{
                width: '72%', height: `${barHeight}px`,
                background: idx === historial.slice(-6).length - 1 ? 'linear-gradient(180deg, #6366f1, #3730a3)' : 'var(--m3-surface-container-high)',
                borderRadius: '8px 8px 0 0',
                transition: 'height 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
              }} />
              <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', marginTop: '6px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                {item.fecha.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '14px 0 0 0', fontSize: '12.5px', color: 'var(--m3-text-secondary)', textAlign: 'center' }}>
        Mínimo histórico registrado: <strong style={{ color: '#16a34a', fontFamily: 'var(--font-mono)' }}>${minPrecio.toLocaleString('es-CL')} CLP</strong>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Componente: Sucursales Físicas y GPS (M3)
// ─────────────────────────────────────────────
function SucursalesCard({ sucursales }: { sucursales: Sucursal[] }) {
  const [comunaFiltro, setComunaFiltro] = useState<string>('todas');
  const [coordsUsuario, setCoordsUsuario] = useState<{ lat: number; lng: number } | null>(null);
  const [estadoGPS, setEstadoGPS] = useState<'inactivo' | 'cargando' | 'ok' | 'error'>('inactivo');

  const activarGPS = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    setEstadoGPS('cargando');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordsUsuario({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setEstadoGPS('ok');
      },
      () => setEstadoGPS('error')
    );
  };

  const comunas = ['todas', ...Array.from(new Set(sucursales.map(s => s.comuna))).sort((a, b) => a.localeCompare(b, 'es'))];

  const sucursalesConDistancia = sucursales.map(s => {
    if (coordsUsuario && s.lat && s.lng) {
      return { ...s, distancia: calcularDistanciaKm(coordsUsuario.lat, coordsUsuario.lng, s.lat, s.lng) };
    }
    return { ...s, distancia: Infinity };
  });

  const filtradas = (comunaFiltro === 'todas'
    ? sucursalesConDistancia
    : sucursalesConDistancia.filter(s => s.comuna === comunaFiltro)
  ).sort((a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity));
  const visibles = filtradas.slice(0, MAX_SUCURSALES_VISIBLES);

  return (
    <div style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-xl)', padding: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--m3-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} style={{ color: 'var(--m3-primary)' }} /> Sucursales Físicas en Santiago
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>Cálculo de cercanía por fórmula esférica de Haversine.</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={activarGPS}
            className="m3-btn m3-btn-tonal"
            style={{ fontSize: '11.5px', padding: '7px 13px' }}
          >
            <Navigation size={13} /> {estadoGPS === 'cargando' ? 'Obteniendo GPS...' : estadoGPS === 'ok' ? 'GPS Activo' : 'Ordenar por Cercanía'}
          </button>
          <select
            value={comunaFiltro}
            onChange={e => setComunaFiltro(e.target.value)}
            style={{ fontSize: '12px', padding: '7px 12px', borderRadius: '10px', border: '1px solid var(--m3-outline)', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}
          >
            {comunas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {visibles.map((s, idx) => (
          <div key={idx} style={{ background: 'var(--m3-surface-container-low)', padding: '14px 16px', borderRadius: 'var(--m3-shape-md)', border: '1px solid var(--m3-outline-variant)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Store size={14} /> {s.nombre}
              </p>
              {coordsUsuario && s.distancia !== undefined && s.distancia !== Infinity && (
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', fontFamily: 'var(--font-mono)',
                  background: s.distancia < 3 ? 'rgba(22, 163, 74, 0.14)' : 'var(--m3-surface-container-high)',
                  color: s.distancia < 3 ? '#15803d' : 'var(--m3-text-primary)',
                }}>
                  {s.distancia.toFixed(1)} km
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 6px 0', fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>{s.direccion} ({s.comuna})</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--m3-text-tertiary)', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {s.horario}
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: s.fuente === 'scraping' ? '#15803d' : 'var(--m3-text-tertiary)' }}>
                  ({s.fuente === 'scraping' ? 'publicado por la tienda' : 'referencial'})
                </span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {s.telefono}</span>
            </div>
            {s.lat && s.lng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11.5px', color: 'var(--m3-primary)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}
              >
                Cómo llegar en Google Maps <ExternalLink size={12} />
              </a>
            )}
          </div>
        ))}
        {filtradas.length > visibles.length && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)', textAlign: 'center' }}>
            Mostrando {visibles.length} de {filtradas.length} sucursales. Activa el GPS o elige una comuna para ver las más cercanas.
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Componente: Reseñas de la Comunidad (M3)
// ─────────────────────────────────────────────
function ReviewsSection({
  perfumeNombre,
  reviewsIniciales,
}: {
  perfumeNombre: string;
  reviewsIniciales: Review[];
}) {
  const [reviews, setReviews] = useState<Review[]>(reviewsIniciales);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [rating, setRating] = useState(5);
  const [duracion, setDuracion] = useState(8);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setReviews(reviewsIniciales);
  }, [reviewsIniciales]);

  const promedio = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "Sin valoraciones";

  const enviarReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !comentario.trim()) return;
    setEnviando(true);

    try {
      const resp = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perfume: perfumeNombre,
          usuario,
          rating,
          duracion_horas: duracion,
          comentario,
        }),
      });
      const data = await resp.json();
      if (data.success && data.review) {
        setReviews([data.review, ...reviews]);
        setComentario('');
        setMostrarForm(false);
      }
    } catch {
      alert("Error al enviar la reseña.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-xl)', padding: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--m3-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={18} style={{ color: '#eab308' }} fill="#eab308" /> Opiniones de la Comunidad
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
            Valoración global: <strong style={{ color: '#d97706' }}>{promedio} / 5</strong> ({reviews.length} reseñas)
          </span>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="m3-btn m3-btn-primary"
          style={{ fontSize: '12px' }}
        >
          {mostrarForm ? 'Cerrar' : '+ Publicar Reseña'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={enviarReview} style={{ background: 'var(--m3-surface-container-low)', padding: '16px', borderRadius: 'var(--m3-shape-lg)', marginBottom: '16px', border: '1px solid var(--m3-outline-variant)' }}>
          <input
            type="text" placeholder="Tu nombre o apodo" required value={usuario}
            onChange={e => setUsuario(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '10px', border: '1px solid var(--m3-outline)', fontSize: '13px', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}
          />
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--m3-text-secondary)', fontWeight: 600 }}>Calificación:</label>
              <select value={rating} onChange={e => setRating(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--m3-outline)', fontSize: '12px', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}>
                <option value={5}>5 / 5 Excelente</option>
                <option value={4}>4 / 5 Muy bueno</option>
                <option value={3}>3 / 5 Regular</option>
                <option value={2}>2 / 5 Bajo</option>
                <option value={1}>1 / 5 Malo</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--m3-text-secondary)', fontWeight: 600 }}>Duración en piel:</label>
              <select value={duracion} onChange={e => setDuracion(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--m3-outline)', fontSize: '12px', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}>
                <option value={4}>~4 horas</option>
                <option value={6}>~6 horas</option>
                <option value={8}>~8 horas</option>
                <option value={10}>~10+ horas</option>
              </select>
            </div>
          </div>
          <textarea
            placeholder="Describe el secado, proyección o cumplidos recibidos..."
            required rows={3} value={comentario} onChange={e => setComentario(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '10px', border: '1px solid var(--m3-outline)', fontSize: '13px', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}
          />
          <button type="submit" disabled={enviando} className="m3-btn m3-btn-primary" style={{ width: '100%' }}>
            {enviando ? 'Publicando...' : 'Publicar reseña'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {reviews.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: 'var(--m3-text-tertiary)', margin: 0 }}>Aún no hay reseñas registradas. ¡Sé el primero en opinar!</p>
        ) : (
          reviews.map(r => (
            <div key={r.id} style={{ borderBottom: '1px solid var(--m3-outline-variant)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <strong>{r.usuario}</strong>
                <span style={{ color: '#eab308', letterSpacing: '1px' }}>{'★'.repeat(r.rating)}</span>
              </div>
              <p style={{ margin: '5px 0', fontSize: '13px', color: 'var(--m3-text-secondary)', lineHeight: 1.45 }}>"{r.comentario}"</p>
              <span style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>Fijación: ~{r.duracion_horas}h · {r.fecha}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Componente: COMPARADOR LADO A LADO (Arena VS + Matriz Criterio por Criterio + Radar 6D + IFRA)
// ─────────────────────────────────────────────
function buscarImagenRespaldoCatalogo(nombre: string): string | null {
  const n = nombre.toLowerCase();
  if (n.includes('acqua di gio') || n.includes('acqua di giò')) return '/perfumes/acqua-di-gio.jpg';
  if (n.includes('sauvage')) return '/perfumes/sauvage-dior.jpg';
  if (n.includes('bleu de chanel') || n.includes('bleu chanel')) return '/perfumes/bleu-de-chanel.jpg';
  if (n.includes('good girl')) return '/perfumes/good-girl.jpg';
  if (n.includes('eros')) return '/perfumes/versace-eros.jpg';
  if (n.includes('nautica') || n.includes('voyage')) return '/perfumes/nautica-voyage.jpg';
  return null;
}

function ordenarOfertasComparador(precios: PrecioMercado[]): PrecioMercado[] {
  return [...(precios || [])].sort((a, b) => {
    const agotadoA = a.stock === 'Agotado' ? 1 : 0;
    const agotadoB = b.stock === 'Agotado' ? 1 : 0;
    if (agotadoA !== agotadoB) return agotadoA - agotadoB;
    const pa = typeof a.precio === 'number' && a.precio > 0 ? a.precio : Infinity;
    const pb = typeof b.precio === 'number' && b.precio > 0 ? b.precio : Infinity;
    return pa - pb;
  });
}

function ComparadorLadoALado({
  p1Inicial = '',
  p2Inicial = '',
  alergiasIds,
  notasCustom,
  listaCompras,
  onAbrirAlergias,
  onGuardarEnLista,
  onExplorarPerfume,
  onRegistrarLogCliente,
}: {
  p1Inicial?: string;
  p2Inicial?: string;
  alergiasIds: string[];
  notasCustom: string[];
  listaCompras: ItemListaCompra[];
  onAbrirAlergias: () => void;
  onGuardarEnLista: (item: Omit<ItemListaCompra, 'id' | 'fechaGuardado'>) => void;
  onExplorarPerfume: (nombre: string) => void;
  onRegistrarLogCliente: (nivel: EntradaLogSistema['nivel'], modulo: string, mensaje: string, duracion?: number) => void;
}) {
  const [perfume1, setPerfume1] = useState(p1Inicial);
  const [perfume2, setPerfume2] = useState(p2Inicial);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{ p1: PerfumeComparado; p2: PerfumeComparado } | null>(null);
  const [error, setError] = useState('');
  const [p1Idx, setP1Idx] = useState<number>(0);
  const [p2Idx, setP2Idx] = useState<number>(0);

  const SUGERENCIAS = [
    { p1: 'Acqua Di Gio', p2: 'Sauvage Dior', label: 'Acqua Di Gio vs Sauvage', tag: 'Clásico vs Bestia' },
    { p1: 'Versace Eros', p2: 'One Million Paco Rabanne', label: 'Versace Eros vs 1 Million', tag: 'Duelo Nocturno' },
    { p1: 'Bleu de Chanel', p2: 'Dylan Blue Versace', label: 'Bleu de Chanel vs Dylan Blue', tag: 'Azules de Oficina' },
    { p1: 'Dolce & Gabbana Light Blue', p2: 'Calvin Klein CK One', label: 'Light Blue vs CK One', tag: 'Frescos Verano' },
    { p1: 'Good Girl Carolina Herrera', p2: 'La Vie Est Belle Lancome', label: 'Good Girl vs La Vie Est Belle', tag: 'Íconos Gourmand' },
  ];

  const ejecutarComparacionParams = async (p1Raw: string, p2Raw: string) => {
    const p1 = p1Raw.trim();
    const p2 = p2Raw.trim();
    if (!p1 || !p2) {
      setError('Por favor ingresa los dos perfumes a comparar.');
      return;
    }
    if (p1.toLowerCase() === p2.toLowerCase()) {
      setError('Selecciona dos perfumes distintos para contrastar sus precios y notas.');
      return;
    }
    const t0 = Date.now();
    setCargando(true);
    setError('');
    setResultado(null);
    setP1Idx(0);
    setP2Idx(0);

    try {
      const resp = await fetch(
        `${API_BASE}/api/comparar?p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`
      );
      const data = await resp.json();
      const dur = Date.now() - t0;
      if (data.success && data.p1 && data.p2) {
        const precios1 = ordenarOfertasComparador(data.p1.precios || []);
        const precios2 = ordenarOfertasComparador(data.p2.precios || []);
        const esComprable = (x: PrecioMercado) => typeof x.precio === 'number' && x.precio > 0 && x.stock !== 'Agotado';
        const mejor1 = precios1.find(esComprable)?.precio ?? data.p1.mejorPrecio ?? null;
        const mejor2 = precios2.find(esComprable)?.precio ?? data.p2.mejorPrecio ?? null;

        setResultado({
          p1: { ...data.p1, precios: precios1, mejorPrecio: mejor1 },
          p2: { ...data.p2, precios: precios2, mejorPrecio: mejor2 },
        });
        onRegistrarLogCliente(
          data.desde_cache ? 'CACHE' : 'SUCCESS',
          'COMPARADOR',
          `Comparación "${p1}" vs "${p2}" lista (${data.desde_cache ? 'desde caché' : 'en vivo'})`,
          dur
        );
      } else {
        setError(data.mensaje || 'Error al realizar la comparación');
      }
    } catch {
      setError('Error de conexión con el servidor. Verifica que el backend esté activo en el puerto 8000.');
      onRegistrarLogCliente('ERROR', 'COMPARADOR', `Fallo de red al comparar "${p1}" vs "${p2}"`);
    } finally {
      setCargando(false);
    }
  };

  const invertirPerfumes = () => {
    const temp1 = perfume1;
    setPerfume1(perfume2);
    setPerfume2(temp1);
    if (resultado) {
      setResultado({ p1: resultado.p2, p2: resultado.p1 });
      const idxTemp = p1Idx;
      setP1Idx(p2Idx);
      setP2Idx(idxTemp);
    }
  };

  useEffect(() => {
    if (p1Inicial) setPerfume1(p1Inicial);
    if (p2Inicial) setPerfume2(p2Inicial);
    if (p1Inicial && p2Inicial) {
      ejecutarComparacionParams(p1Inicial, p2Inicial);
    }
  }, [p1Inicial, p2Inicial]);

  const ofertaActivaP1 = resultado?.p1.precios[p1Idx];
  const ofertaActivaP2 = resultado?.p2.precios[p2Idx];

  const precioP1 = ofertaActivaP1?.precio ?? resultado?.p1.mejorPrecio ?? null;
  const precioP2 = ofertaActivaP2?.precio ?? resultado?.p2.mejorPrecio ?? null;

  const mlP1 = extraerMl(ofertaActivaP1?.nombre || resultado?.p1.nombre || '') || 100;
  const mlP2 = extraerMl(ofertaActivaP2?.nombre || resultado?.p2.nombre || '') || 100;

  const costoPorMlP1 = precioP1 ? Math.round(precioP1 / mlP1) : null;
  const costoPorMlP2 = precioP2 ? Math.round(precioP2 / mlP2) : null;

  let ganadorPrecio: 'p1' | 'p2' | 'empate' = 'empate';
  let diferenciaPrecio = 0;
  let porcentajeAhorro = 0;
  if (precioP1 !== null && precioP2 !== null) {
    if (precioP1 < precioP2) {
      ganadorPrecio = 'p1';
      diferenciaPrecio = precioP2 - precioP1;
      porcentajeAhorro = Math.round((diferenciaPrecio / precioP2) * 100);
    } else if (precioP2 < precioP1) {
      ganadorPrecio = 'p2';
      diferenciaPrecio = precioP1 - precioP2;
      porcentajeAhorro = Math.round((diferenciaPrecio / precioP1) * 100);
    }
  }

  const durP1 = resultado?.p1.ficha?.duracion_horas || 7;
  const durP2 = resultado?.p2.ficha?.duracion_horas || 7;
  const ganadorRendimiento: 'p1' | 'p2' | 'empate' =
    durP1 > durP2 ? 'p1' : durP2 > durP1 ? 'p2' : 'empate';

  const evalAlergiaP1 = resultado?.p1.ficha
    ? evaluarRiesgoAlergia(resultado.p1.ficha, alergiasIds, notasCustom)
    : null;
  const evalAlergiaP2 = resultado?.p2.ficha
    ? evaluarRiesgoAlergia(resultado.p2.ficha, alergiasIds, notasCustom)
    : null;

  const alergenosCountP1 = evalAlergiaP1?.todosLosAlergenosDelPerfume.length ?? 0;
  const alergenosCountP2 = evalAlergiaP2?.todosLosAlergenosDelPerfume.length ?? 0;
  const choquesUsuarioP1 = evalAlergiaP1?.coincidencias.length ?? 0;
  const choquesUsuarioP2 = evalAlergiaP2?.coincidencias.length ?? 0;

  let ganadorPiel: 'p1' | 'p2' | 'empate' = 'empate';
  if (choquesUsuarioP1 !== choquesUsuarioP2) {
    ganadorPiel = choquesUsuarioP1 < choquesUsuarioP2 ? 'p1' : 'p2';
  } else if (alergenosCountP1 !== alergenosCountP2) {
    ganadorPiel = alergenosCountP1 < alergenosCountP2 ? 'p1' : 'p2';
  }

  // Notas en común entre ambos perfumes
  const todasNotasP1 = [
    ...(resultado?.p1.ficha?.notas_salida || []),
    ...(resultado?.p1.ficha?.notas_corazon || []),
    ...(resultado?.p1.ficha?.notas_fondo || []),
  ];
  const todasNotasP2 = [
    ...(resultado?.p2.ficha?.notas_salida || []),
    ...(resultado?.p2.ficha?.notas_corazon || []),
    ...(resultado?.p2.ficha?.notas_fondo || []),
  ];
  const notasEnComun = Array.from(
    new Set(
      todasNotasP1.filter(n1 =>
        todasNotasP2.some(
          n2 =>
            n1.toLowerCase().includes(n2.toLowerCase()) ||
            n2.toLowerCase().includes(n1.toLowerCase())
        )
      )
    )
  );

  // Nombres rápidos disponibles desde Lista de Compras + Populares
  const opcionesRapidas = Array.from(
    new Set([
      ...listaCompras.map(i => i.perfume),
      ...POPULARES_CHILE.map(p => p.nombre),
      'One Million Paco Rabanne',
      'Dylan Blue Versace',
      'CK One',
    ])
  ).slice(0, 8);

  const renderColumnaPerfume = (
    lado: 'p1' | 'p2',
    datos: PerfumeComparado,
    otroNombre: string,
    idxActivo: number,
    setIdxActivo: (n: number) => void,
    precioActual: number | null,
    mlActual: number,
    costoMlActual: number | null
  ) => {
    const esA = lado === 'p1';
    const colorTema = esA ? 'var(--m3-primary)' : '#0d9488';
    const oferta = datos.precios[idxActivo];
    const imgUrl =
      normalizarImagen(oferta?.imagen || datos.precios.find(p => p.imagen)?.imagen) ||
      buscarImagenRespaldoCatalogo(datos.nombre);
    const esGanadorPrecio = ganadorPrecio === lado;

    return (
      <div className={`m3-compare-column ${esGanadorPrecio ? 'winner' : ''}`}>
        {/* Cabecera de Opción A / B */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              color: colorTema,
              background: esA ? 'var(--m3-primary-container)' : 'rgba(13, 148, 136, 0.14)',
              padding: '3px 10px',
              borderRadius: '99px',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            {esA ? 'Opción A · Índigo' : 'Opción B · Esmeralda'}
          </span>

          {esGanadorPrecio && (
            <span
              style={{
                background: '#16a34a',
                color: '#fff',
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: '99px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Award size={12} /> Mejor Precio
            </span>
          )}
        </div>

        {/* Imagen del Frasco */}
        {imgUrl && (
          <div className="m3-card-img-wrap" style={{ height: '150px', marginBottom: '12px' }}>
            <img
              src={imgUrl}
              alt={datos.nombre}
              className="m3-card-img"
              onError={e => {
                const padre = e.currentTarget.parentElement as HTMLElement;
                if (padre) padre.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Nombre, Marca y Precio Activo */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          {datos.ficha?.marca && (
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>
              {datos.ficha.marca} · {datos.ficha.concentracion || 'EDP'}
            </span>
          )}
          <h4 className="m3-editorial-title" style={{ margin: '3px 0 6px 0', fontSize: '1.35rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
            {datos.ficha?.nombre || datos.nombre}
          </h4>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="m3-volume-badge">
              <Droplets size={11} /> {mlActual} ml
            </span>
            {costoMlActual && (
              <span className="m3-price-per-ml">
                ${costoMlActual.toLocaleString('es-CL')}/ml
              </span>
            )}
          </div>

          {precioActual ? (
            <div style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: colorTema, fontFamily: 'var(--font-mono)', display: 'block' }}>
                ${precioActual.toLocaleString('es-CL')} CLP
              </span>
              {oferta?.tienda && (
                <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <Store size={12} /> {oferta.tienda} ({datos.precios.length} ofertas en Chile)
                </span>
              )}
            </div>
          ) : (
            <div style={{ marginTop: '8px', padding: '7px 10px', background: 'var(--m3-surface-container)', borderRadius: '8px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--m3-text-tertiary)', fontWeight: 600 }}>
                Sin stock verificado hoy en retail chileno
              </span>
            </div>
          )}

          {/* Botones de Acción Rápida: Ver en tienda, Guardar en Lista, Ficha Completa */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
            {oferta?.url && (
              <a
                href={oferta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="m3-btn m3-btn-primary"
                style={{ fontSize: '11.5px', padding: '6px 12px', textDecoration: 'none' }}
              >
                Ir a {oferta.tienda} <ExternalLink size={12} />
              </a>
            )}
            <button
              type="button"
              onClick={() =>
                onGuardarEnLista({
                  perfume: oferta?.nombre || datos.nombre,
                  marca: datos.ficha?.marca,
                  tienda: oferta?.tienda || 'Referencia IA',
                  precioGuardado: precioActual ?? null,
                  ml: mlActual,
                  url: oferta?.url || '',
                  imagen: imgUrl,
                  categoria: 'comprar',
                  notaPersonal: `Duelo VS ${otroNombre}`,
                })
              }
              className="m3-btn m3-btn-tonal"
              style={{ fontSize: '11.5px', padding: '6px 12px' }}
            >
              <Heart size={12} /> Guardar
            </button>
            <button
              type="button"
              onClick={() => onExplorarPerfume(datos.nombre)}
              className="m3-btn m3-btn-tonal"
              style={{ fontSize: '11.5px', padding: '6px 10px' }}
              title="Ver todas las tiendas y sucursales de este perfume"
            >
              <Search size={12} /> Ver todo
            </button>
          </div>
        </div>

        {/* Semáforo de Alergias IFRA */}
        {datos.ficha && (
          <BannerSemaforoAlergia
            ficha={datos.ficha}
            alergiasIds={alergiasIds}
            notasCustom={notasCustom}
            onAbrirConfig={onAbrirAlergias}
            compacto
          />
        )}

        {/* Selector Interactivo de Presentación / Tienda */}
        {datos.precios.length > 1 && (
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
              Cambiar oferta o tamaño ({datos.precios.length} disponibles):
            </span>
            <div className="m3-offer-pill-list">
              {datos.precios.slice(0, 4).map((p, i) => {
                const mlItem = extraerMl(p.nombre);
                const activo = i === idxActivo;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdxActivo(i)}
                    className={`m3-offer-pill ${activo ? 'selected' : ''}`}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '11.5px', color: 'var(--m3-text-primary)' }}>{p.tienda}</strong>
                        {mlItem && (
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#0284c7', fontWeight: 700 }}>
                            {mlItem}ml
                          </span>
                        )}
                        {i === 0 && (
                          <span style={{ fontSize: '9.5px', background: 'rgba(22, 163, 74, 0.14)', color: '#15803d', padding: '1px 6px', borderRadius: '99px', fontWeight: 800 }}>
                            Mínimo
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.nombre}
                      </span>
                    </div>
                    <strong style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: activo ? 'var(--m3-primary)' : 'var(--m3-text-primary)', flexShrink: 0 }}>
                      {p.precio ? `$${p.precio.toLocaleString('es-CL')}` : 'S/P'}
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pirámide Olfativa Completa y Especificaciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
          <div style={{ borderBottom: '1px solid var(--m3-outline-variant)', paddingBottom: '7px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', fontWeight: 800 }}>Familia Olfativa</span>
            <strong style={{ color: 'var(--m3-text-primary)', textAlign: 'right' }}>{datos.ficha?.familia_olfativa || 'Sin datos'}</strong>
          </div>

          <div style={{ borderBottom: '1px solid var(--m3-outline-variant)', paddingBottom: '7px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', fontWeight: 800 }}>Longevidad y Estela</span>
            <strong style={{ color: 'var(--m3-text-primary)' }}>
              {datos.ficha?.duracion_horas ? `~${datos.ficha.duracion_horas}h` : 'Sin datos'}
              {datos.ficha?.proyeccion ? ` · Proyección ${datos.ficha.proyeccion}` : ''}
            </strong>
          </div>

          {/* Pirámide en 3 Capas */}
          <div style={{ background: 'var(--m3-surface-container-low)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--m3-outline-variant)' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: colorTema, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
              Pirámide Olfativa
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
              <div>
                <strong style={{ color: 'var(--m3-text-primary)' }}>Salida: </strong>
                <span style={{ color: 'var(--m3-text-secondary)' }}>
                  {datos.ficha?.notas_salida?.join(', ') || 'Sin datos'}
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--m3-text-primary)' }}>Corazón: </strong>
                <span style={{ color: 'var(--m3-text-secondary)' }}>
                  {datos.ficha?.notas_corazon?.join(', ') || 'Sin datos'}
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--m3-text-primary)' }}>Fondo: </strong>
                <span style={{ color: 'var(--m3-text-secondary)' }}>
                  {datos.ficha?.notas_fondo?.join(', ') || 'Sin datos'}
                </span>
              </div>
            </div>
          </div>

          {/* Estaciones y Ocasiones */}
          {datos.ficha?.estaciones && datos.ficha.estaciones.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
              {datos.ficha.estaciones.map((est, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: 'var(--m3-surface-container)',
                    color: 'var(--m3-text-secondary)',
                  }}
                >
                  {est}
                </span>
              ))}
              {(datos.ficha.ocasiones || []).slice(0, 2).map((oc, i) => (
                <span
                  key={`oc-${i}`}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: 'var(--m3-primary-container)',
                    color: 'var(--m3-primary)',
                  }}
                >
                  {oc}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="m3-compare-container">
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Laboratorio Comparativo Multi-Tienda & IFRA
        </span>
        <h3 className="m3-editorial-title" style={{ margin: '2px 0 6px 0', fontSize: '1.45rem', color: 'var(--m3-text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={21} style={{ color: 'var(--m3-primary)' }} /> Duelo Frente a Frente & Radar Olfativo 6D
        </h3>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--m3-text-secondary)' }}>
          Contrasta precios verificados en Chile, eficiencia por mililitro (<code>$/ml</code>), superposición sensorial 6D y compatibilidad dermatológica.
        </p>
      </div>

      {/* Duelos Clásicos a 1 Clic */}
      <div style={{ marginBottom: '14px' }}>
        <div className="m3-suggestions-bar">
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={12} style={{ color: 'var(--m3-primary)' }} /> Duelos instantáneos:
          </span>
          {SUGERENCIAS.map((s, i) => {
            const activo =
              perfume1.toLowerCase() === s.p1.toLowerCase() &&
              perfume2.toLowerCase() === s.p2.toLowerCase();
            return (
              <button
                key={i}
                type="button"
                className="m3-suggestion-chip"
                style={{
                  borderColor: activo ? 'var(--m3-primary)' : undefined,
                  background: activo ? 'var(--m3-primary-container)' : undefined,
                  color: activo ? 'var(--m3-primary)' : undefined,
                }}
                onClick={() => {
                  setPerfume1(s.p1);
                  setPerfume2(s.p2);
                  ejecutarComparacionParams(s.p1, s.p2);
                }}
              >
                <Scale size={12} />
                <span>{s.label}</span>
                <span style={{ fontSize: '10px', opacity: 0.75, fontWeight: 700 }}>· {s.tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Arena de Selección A vs B con Botón de Intercambio */}
      <div className="m3-compare-arena">
        {/* Slot A */}
        <div className="m3-compare-slot slot-a">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Fragancia A (Índigo)
            </label>
            {perfume1 && (
              <button
                type="button"
                onClick={() => setPerfume1('')}
                style={{ border: 'none', background: 'transparent', color: 'var(--m3-text-tertiary)', cursor: 'pointer', fontSize: '11px' }}
              >
                Limpiar
              </button>
            )}
          </div>
          <input
            type="text"
            className="m3-search-input"
            style={{ width: '100%', background: 'var(--m3-surface-container-low)', border: '1px solid var(--m3-outline)', borderRadius: '10px', padding: '9px 12px', fontSize: '13.5px' }}
            placeholder="Ej: Acqua Di Gio"
            value={perfume1}
            onChange={e => setPerfume1(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ejecutarComparacionParams(perfume1, perfume2)}
          />
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
            {opcionesRapidas.slice(0, 4).map(nombre => (
              <button
                key={`a-${nombre}`}
                type="button"
                onClick={() => setPerfume1(nombre)}
                style={{
                  fontSize: '10.5px',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  border: '1px solid var(--m3-outline-variant)',
                  background: perfume1 === nombre ? 'var(--m3-primary-container)' : 'transparent',
                  color: perfume1 === nombre ? 'var(--m3-primary)' : 'var(--m3-text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Botón Central Invertir A ↔ B */}
        <button
          type="button"
          className="m3-vs-swap-btn"
          onClick={invertirPerfumes}
          title="Invertir orden de comparación (A ↔ B)"
        >
          <ArrowLeftRight size={18} strokeWidth={2.2} />
        </button>

        {/* Slot B */}
        <div className="m3-compare-slot slot-b">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Fragancia B (Esmeralda)
            </label>
            {perfume2 && (
              <button
                type="button"
                onClick={() => setPerfume2('')}
                style={{ border: 'none', background: 'transparent', color: 'var(--m3-text-tertiary)', cursor: 'pointer', fontSize: '11px' }}
              >
                Limpiar
              </button>
            )}
          </div>
          <input
            type="text"
            className="m3-search-input"
            style={{ width: '100%', background: 'var(--m3-surface-container-low)', border: '1px solid var(--m3-outline)', borderRadius: '10px', padding: '9px 12px', fontSize: '13.5px' }}
            placeholder="Ej: Sauvage Dior"
            value={perfume2}
            onChange={e => setPerfume2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ejecutarComparacionParams(perfume1, perfume2)}
          />
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
            {opcionesRapidas.slice(1, 5).map(nombre => (
              <button
                key={`b-${nombre}`}
                type="button"
                onClick={() => setPerfume2(nombre)}
                style={{
                  fontSize: '10.5px',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  border: '1px solid var(--m3-outline-variant)',
                  background: perfume2 === nombre ? 'rgba(13, 148, 136, 0.14)' : 'transparent',
                  color: perfume2 === nombre ? '#0d9488' : 'var(--m3-text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => ejecutarComparacionParams(perfume1, perfume2)}
        disabled={cargando || !perfume1.trim() || !perfume2.trim()}
        className="m3-btn m3-btn-primary"
        style={{ width: '100%', padding: '12px', fontSize: '0.95rem', borderRadius: 'var(--m3-shape-md)' }}
      >
        <Scale size={16} /> {cargando ? 'Contrastando precios en Chile, radar 6D y alérgenos...' : 'Ejecutar Duelo Comparativo'}
      </button>

      {error && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.35)', color: '#dc2626', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {cargando && (
        <div className="m3-skeleton-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="m3-skeleton-card">
            <div className="m3-skeleton-box" style={{ height: '140px' }} />
            <div className="m3-skeleton-box" style={{ height: '24px', width: '70%' }} />
            <div className="m3-skeleton-box" style={{ height: '90px' }} />
          </div>
          <div className="m3-skeleton-card">
            <div className="m3-skeleton-box" style={{ height: '140px' }} />
            <div className="m3-skeleton-box" style={{ height: '24px', width: '70%' }} />
            <div className="m3-skeleton-box" style={{ height: '90px' }} />
          </div>
        </div>
      )}

      {/* Resultados del Duelo */}
      {resultado && (
        <div style={{ marginTop: '22px' }}>
          {/* 1. Podio de Veredicto Ejecutivo (3 Ejes: Precio, Rendimiento, Piel) */}
          <div className="m3-verdict-podium">
            {/* Eje 1: Mejor Bolsillo / Ahorro */}
            <div className="m3-podium-card" style={{ borderColor: 'rgba(22, 163, 74, 0.4)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Award size={19} />
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block' }}>
                  Veredicto Comercial (Chile)
                </span>
                <strong className="m3-editorial-title" style={{ fontSize: '14.5px', color: 'var(--m3-text-primary)', display: 'block', margin: '2px 0' }}>
                  {ganadorPrecio === 'p1'
                    ? `${resultado.p1.nombre} es más económico`
                    : ganadorPrecio === 'p2'
                    ? `${resultado.p2.nombre} es más económico`
                    : 'Precio equivalente'}
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)' }}>
                  {diferenciaPrecio > 0
                    ? `Ahorras $${diferenciaPrecio.toLocaleString('es-CL')} CLP (${porcentajeAhorro}% menos)`
                    : 'Sin diferencia de precio entre las ofertas seleccionadas'}
                </span>
              </div>
            </div>

            {/* Eje 2: Mejor Rendimiento / Fijación */}
            <div className="m3-podium-card" style={{ borderColor: 'rgba(79, 70, 229, 0.35)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={18} />
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block' }}>
                  Veredicto de Fijación & Estela
                </span>
                <strong className="m3-editorial-title" style={{ fontSize: '14.5px', color: 'var(--m3-text-primary)', display: 'block', margin: '2px 0' }}>
                  {ganadorRendimiento === 'p1'
                    ? `${resultado.p1.nombre} (~${durP1}h)`
                    : ganadorRendimiento === 'p2'
                    ? `${resultado.p2.nombre} (~${durP2}h)`
                    : `Empate técnico (~${durP1}h en piel)`}
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)' }}>
                  Proyección {resultado.p1.ficha?.proyeccion || 'Media'} vs {resultado.p2.ficha?.proyeccion || 'Media'}
                </span>
              </div>
            </div>

            {/* Eje 3: Seguridad Dermatológica IFRA */}
            <div className="m3-podium-card" style={{ borderColor: 'rgba(13, 148, 136, 0.35)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={19} />
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block' }}>
                  Veredicto Dermatológico IFRA
                </span>
                <strong className="m3-editorial-title" style={{ fontSize: '14.5px', color: 'var(--m3-text-primary)', display: 'block', margin: '2px 0' }}>
                  {ganadorPiel === 'p1'
                    ? `${resultado.p1.nombre} es más suave`
                    : ganadorPiel === 'p2'
                    ? `${resultado.p2.nombre} es más suave`
                    : 'Perfil dermatológico similar'}
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)' }}>
                  {alergenosCountP1} vs {alergenosCountP2} compuestos regulados detectados
                </span>
              </div>
            </div>
          </div>

          {/* 2. Gráfico de Radar 6D Superpuesto */}
          <RadarOlfativoChart
            radar1={obtenerRadarDeFicha(resultado.p1.ficha)}
            nombre1={resultado.p1.nombre}
            radar2={obtenerRadarDeFicha(resultado.p2.ficha)}
            nombre2={resultado.p2.nombre}
          />

          {/* 3. Matriz Comparativa Criterio por Criterio */}
          <div className="m3-compare-matrix">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--m3-text-primary)' }}>
                Matriz Comparativa Criterio por Criterio
              </h4>
              {notasEnComun.length > 0 && (
                <span style={{ fontSize: '11.5px', color: 'var(--m3-primary)', background: 'var(--m3-primary-container)', padding: '3px 10px', borderRadius: '99px', fontWeight: 700 }}>
                  Notas en común: {notasEnComun.slice(0, 4).join(', ')}
                </span>
              )}
            </div>

            {/* Fila 1: Mejor Precio */}
            <div className="m3-matrix-row">
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: ganadorPrecio === 'p1' ? '#16a34a' : 'var(--m3-text-primary)' }}>
                {precioP1 ? `$${precioP1.toLocaleString('es-CL')}` : 'Sin stock'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase' }}>
                Precio Seleccionado
              </div>
              <div style={{ textAlign: 'left', fontFamily: 'var(--font-mono)', fontWeight: 800, color: ganadorPrecio === 'p2' ? '#16a34a' : 'var(--m3-text-primary)' }}>
                {precioP2 ? `$${precioP2.toLocaleString('es-CL')}` : 'Sin stock'}
              </div>
            </div>

            {/* Fila 2: Costo por Mililitro */}
            <div className="m3-matrix-row">
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: costoPorMlP1 && costoPorMlP2 && costoPorMlP1 < costoPorMlP2 ? '#16a34a' : 'var(--m3-text-secondary)' }}>
                {costoPorMlP1 ? `$${costoPorMlP1.toLocaleString('es-CL')}/ml (${mlP1}ml)` : '—'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase' }}>
                Eficiencia $/ml
              </div>
              <div style={{ textAlign: 'left', fontFamily: 'var(--font-mono)', fontWeight: 700, color: costoPorMlP1 && costoPorMlP2 && costoPorMlP2 < costoPorMlP1 ? '#16a34a' : 'var(--m3-text-secondary)' }}>
                {costoPorMlP2 ? `$${costoPorMlP2.toLocaleString('es-CL')}/ml (${mlP2}ml)` : '—'}
              </div>
            </div>

            {/* Fila 3: Fijación en Piel con barra visual */}
            <div className="m3-matrix-row">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '12.5px' }}>~{durP1}h</span>
                <div style={{ width: '70px', height: '7px', background: 'var(--m3-surface-container)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, durP1 * 9)}%`, height: '100%', background: 'var(--m3-primary)', borderRadius: '99px' }} />
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase' }}>
                Fijación en Piel
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }}>
                <div style={{ width: '70px', height: '7px', background: 'var(--m3-surface-container)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, durP2 * 9)}%`, height: '100%', background: '#0d9488', borderRadius: '99px' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '12.5px' }}>~{durP2}h</span>
              </div>
            </div>

            {/* Fila 4: Ofertas en Retail Chileno */}
            <div className="m3-matrix-row">
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>
                {resultado.p1.precios.length} ofertas ({Array.from(new Set(resultado.p1.precios.map(p => p.tienda))).length} cadenas)
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase' }}>
                Stock en Chile
              </div>
              <div style={{ textAlign: 'left', fontWeight: 700, fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>
                {resultado.p2.precios.length} ofertas ({Array.from(new Set(resultado.p2.precios.map(p => p.tienda))).length} cadenas)
              </div>
            </div>
          </div>

          {/* 4. Columnas Detalladas Lado a Lado */}
          <div className="m3-compare-grid">
            {renderColumnaPerfume(
              'p1',
              resultado.p1,
              resultado.p2.nombre,
              p1Idx,
              setP1Idx,
              precioP1,
              mlP1,
              costoPorMlP1
            )}
            {renderColumnaPerfume(
              'p2',
              resultado.p2,
              resultado.p1.nombre,
              p2Idx,
              setP2Idx,
              precioP2,
              mlP2,
              costoPorMlP2
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Componente: Modal de Rango y Alcance de Búsqueda (M3)
// ─────────────────────────────────────────────
function ModalRangoBusqueda({
  abierto,
  alCerrar,
}: {
  abierto: boolean;
  alCerrar: () => void;
}) {
  if (!abierto) return null;

  return (
    <div className="m3-modal-backdrop" onClick={alCerrar}>
      <div className="m3-modal-card" onClick={e => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Compass size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
                Alcance Técnico y Cobertura en Chile
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Parámetros de recopilación, validación IFRA y filtrado anti-marketplace
              </span>
            </div>
          </div>
          <button onClick={alCerrar} className="m3-search-clear" title="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="m3-modal-body">
          <div className="m3-range-grid">
            <div className="m3-range-item">
              <Store size={20} style={{ color: 'var(--m3-primary)' }} />
              <strong style={{ display: 'block', margin: '6px 0 3px 0', fontSize: '13px' }}>4 Cadenas Monitoreadas</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Extracción simultánea en <strong>Falabella</strong>, <strong>DBS Beauty Store</strong>, <strong>Alisha Perfumes</strong> y <strong>Farmacias Ahumada</strong>.
              </p>
            </div>

            <div className="m3-range-item">
              <MapPin size={20} style={{ color: 'var(--m3-primary)' }} />
              <strong style={{ display: 'block', margin: '6px 0 3px 0', fontSize: '13px' }}>11 Sucursales Georreferenciadas</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Cálculo de distancia satelital por fórmula de Haversine y despacho online a las 16 regiones de Chile.
              </p>
            </div>

            <div className="m3-range-item">
              <ShieldCheck size={20} style={{ color: '#16a34a' }} />
              <strong style={{ display: 'block', margin: '6px 0 3px 0', fontSize: '13px' }}>Seguridad Dermatológica IFRA</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Cruce automático de notas con 9 familias de alérgenos químicos (Limoneno, Linalool, Cinamal, Eugenol, Musgo de Roble).
              </p>
            </div>

            <div className="m3-range-item">
              <Droplets size={20} style={{ color: '#0284c7' }} />
              <strong style={{ display: 'block', margin: '6px 0 3px 0', fontSize: '13px' }}>Costo Unitario por Mililitro</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Detección heurística de tamaños (30ml a 200ml) y cálculo de <code>$/ml</code> para identificar la oferta más conveniente.
              </p>
            </div>
          </div>
        </div>

        <div className="m3-modal-footer">
          <button onClick={alCerrar} className="m3-btn m3-btn-primary">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  COMPONENTE PRINCIPAL: App
// ─────────────────────────────────────────────
const POPULARES_CHILE = [
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

export default function App() {
  const [vistaPrincipal, setVistaPrincipal] = useState<'explorar' | 'comparar'>('explorar');
  const [subPestana, setSubPestana] = useState<'precios' | 'ficha' | 'guia' | 'similares' | 'reviews' | 'historial' | 'tiendas'>('precios');

  // ── Tema Claro / Oscuro siguiendo estándar color-scheme ──
  const [temaOscuro, setTemaOscuro] = useState<boolean>(() => {
    try {
      const guardado = localStorage.getItem('color-scheme');
      if (guardado === 'dark') return true;
      if (guardado === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const alternarTema = () => {
    const nuevoOscuro = !temaOscuro;
    setTemaOscuro(nuevoOscuro);
    const targetScheme = nuevoOscuro ? 'dark' : 'light';
    const prefiereSistemaOscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const sistemaActual = prefiereSistemaOscuro ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', targetScheme);
    const meta = document.querySelector('meta[name="color-scheme"]');

    try {
      if (targetScheme === sistemaActual) {
        localStorage.removeItem('color-scheme');
        if (meta) meta.setAttribute('content', 'light dark');
      } else {
        localStorage.setItem('color-scheme', targetScheme);
        if (meta) meta.setAttribute('content', targetScheme);
      }
    } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', temaOscuro ? 'dark' : 'light');
  }, [temaOscuro]);

  // ── Sistema de Alergias del Usuario (Semana 5) ──
  const [mostrarModalAlergias, setMostrarModalAlergias] = useState(false);
  const [alergiasUsuario, setAlergiasUsuario] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('perfumescan_alergias_ids');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [notasAlergiaCustom, setNotasAlergiaCustom] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('perfumescan_alergias_custom');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const toggleAlergiaId = (id: string) => {
    const nuevas = alergiasUsuario.includes(id)
      ? alergiasUsuario.filter(a => a !== id)
      : [...alergiasUsuario, id];
    setAlergiasUsuario(nuevas);
    try { localStorage.setItem('perfumescan_alergias_ids', JSON.stringify(nuevas)); } catch {}
    registrarLogCliente('INFO', 'ALERGIAS', `Perfil dermatológico actualizado (${nuevas.length} compuestos IFRA activos)`);
  };

  const agregarNotaAlergiaCustom = (nota: string) => {
    if (notasAlergiaCustom.some(n => n.toLowerCase() === nota.toLowerCase())) return;
    const nuevas = [...notasAlergiaCustom, nota];
    setNotasAlergiaCustom(nuevas);
    try { localStorage.setItem('perfumescan_alergias_custom', JSON.stringify(nuevas)); } catch {}
    registrarLogCliente('INFO', 'ALERGIAS', `Ingrediente sensible personalizado añadido: "${nota}"`);
  };

  const eliminarNotaAlergiaCustom = (nota: string) => {
    const nuevas = notasAlergiaCustom.filter(n => n !== nota);
    setNotasAlergiaCustom(nuevas);
    try { localStorage.setItem('perfumescan_alergias_custom', JSON.stringify(nuevas)); } catch {}
  };

  // ── Lista de Compras / Favoritos sin Pasarela de Pago (Semana 5) ──
  const [mostrarModalLista, setMostrarModalLista] = useState(false);
  const [listaCompras, setListaCompras] = useState<ItemListaCompra[]>(() => {
    try {
      const s = localStorage.getItem('perfumescan_lista_compras');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  const dispararToast = (msg: string) => {
    setToastMensaje(msg);
    setTimeout(() => setToastMensaje(null), 2800);
  };

  const guardarEnListaCompras = (nuevo: Omit<ItemListaCompra, 'id' | 'fechaGuardado'>) => {
    const yaExiste = listaCompras.some(
      i => i.perfume.toLowerCase() === nuevo.perfume.toLowerCase() && i.tienda === nuevo.tienda
    );
    if (yaExiste) {
      dispararToast(`"${nuevo.perfume}" ya está en tu Lista de Compras`);
      return;
    }
    const itemCompleto: ItemListaCompra = {
      ...nuevo,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fechaGuardado: new Date().toISOString().split('T')[0],
    };
    const actualizada = [itemCompleto, ...listaCompras];
    setListaCompras(actualizada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(actualizada)); } catch {}
    registrarLogCliente('SUCCESS', 'LISTA_COMPRAS', `Guardado en lista: "${nuevo.perfume}" (${nuevo.tienda})`);
    dispararToast(`Guardado en Mi Lista: ${nuevo.perfume}`);
  };

  const eliminarDeListaCompras = (id: string) => {
    const actualizada = listaCompras.filter(i => i.id !== id);
    setListaCompras(actualizada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(actualizada)); } catch {}
  };

  const cambiarCategoriaLista = (id: string, categoria: ItemListaCompra['categoria']) => {
    const actualizada = listaCompras.map(i => (i.id === id ? { ...i, categoria } : i));
    setListaCompras(actualizada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(actualizada)); } catch {}
  };

  const cambiarNotaLista = (id: string, notaPersonal: string) => {
    const actualizada = listaCompras.map(i => (i.id === id ? { ...i, notaPersonal } : i));
    setListaCompras(actualizada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(actualizada)); } catch {}
  };

  // ── Refresco diario de precios: avance para el indicador de la barra superior ──
  const [estadoRefresco, setEstadoRefresco] = useState<{
    enCurso: boolean;
    total: number;
    procesados: number;
    ultimo: { ultimo: string; perfumes: number; reCotizados: number } | null;
  } | null>(null);

  useEffect(() => {
    let activo = true;
    let enCursoAntes = false;
    let temporizador: number | undefined;
    const consultar = async () => {
      try {
        const datos = await (await fetch(`${API_BASE}/api/refresco`)).json();
        if (!activo) return;
        setEstadoRefresco(datos);
        // Al terminar un refresco, el catálogo vuelve a pedir los precios al backend
        if (enCursoAntes && !datos.enCurso) window.dispatchEvent(new Event('catalogo-actualizado'));
        enCursoAntes = datos.enCurso;
        temporizador = window.setTimeout(consultar, datos.enCurso ? 4000 : 60000);
      } catch {
        if (activo) temporizador = window.setTimeout(consultar, 60000);
      }
    };
    consultar();
    return () => {
      activo = false;
      window.clearTimeout(temporizador);
    };
  }, []);

  // ── Consola de Logs y Telemetría (Semana 5) ──
  const [mostrarModalLogs, setMostrarModalLogs] = useState(false);
  const [logsCliente, setLogsCliente] = useState<EntradaLogSistema[]>([
    {
      id: 'init-1',
      timestamp: new Date().toISOString(),
      nivel: 'INFO',
      modulo: 'FRONTEND',
      mensaje: 'Interfaz PerfumeScan v5.0 inicializada (Editorial UI + Alergias IFRA + Lista de Compras)',
    },
  ]);
  const [ultimaLatencia, setUltimaLatencia] = useState<{ ms: number; cache: boolean } | null>(null);

  const registrarLogCliente = (
    nivel: EntradaLogSistema['nivel'],
    modulo: string,
    mensaje: string,
    duracion_ms?: number
  ) => {
    setLogsCliente(prev => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        nivel,
        modulo,
        mensaje,
        duracion_ms,
      },
      ...prev.slice(0, 60),
    ]);
  };

  // Búsquedas recientes persistentes en LocalStorage
  const [busquedasRecientes, setBusquedasRecientes] = useState<string[]>(() => {
    try {
      const guardadas = localStorage.getItem('perfumescan_recientes');
      return guardadas ? JSON.parse(guardadas) : ['Acqua Di Gio', 'Sauvage Dior', 'Good Girl'];
    } catch {
      return ['Acqua Di Gio', 'Sauvage Dior', 'Good Girl'];
    }
  });

  const registrarBusquedaReciente = (term: string) => {
    try {
      const limpia = term.trim();
      if (limpia.length < 2) return;
      const actualizadas = [limpia, ...busquedasRecientes.filter(b => b.toLowerCase() !== limpia.toLowerCase())].slice(0, 6);
      setBusquedasRecientes(actualizadas);
      localStorage.setItem('perfumescan_recientes', JSON.stringify(actualizadas));
    } catch {}
  };

  const borrarRecientes = () => {
    setBusquedasRecientes([]);
    try { localStorage.removeItem('perfumescan_recientes'); } catch {}
  };

  // Estados de Búsqueda y Resultados
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [mostrarModalFoto, setMostrarModalFoto] = useState(false);
  const [mostrarModalRango, setMostrarModalRango] = useState(false);
  const [archivoFoto, setArchivoFoto] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const [precios, setPrecios] = useState<PrecioMercado[] | null>(null);
  const [ficha, setFicha] = useState<FichaFragancia | null>(null);
  const [historial, setHistorial] = useState<RegistroHistorial[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [prodActivoIdx, setProdActivoIdx] = useState<number>(0);

  // ── Pila de Navegación (QoL: Retroceder a la búsqueda o inspección anterior) ──
  interface EstadoNavegacionPerfume {
    titulo: string;
    textoBusqueda: string;
    precios: PrecioMercado[] | null;
    ficha: FichaFragancia | null;
    historial: RegistroHistorial[];
    reviews: Review[];
    sucursales: Sucursal[];
    subPestana: 'precios' | 'ficha' | 'guia' | 'similares' | 'historial' | 'tiendas' | 'reviews';
  }
  const [pilaNavegacion, setPilaNavegacion] = useState<EstadoNavegacionPerfume[]>([]);

  const empujarVistaActualAPila = () => {
    if (precios || ficha) {
      const tituloActual = ficha?.nombre || textoBusqueda || 'Perfume anterior';
      setPilaNavegacion(prev => {
        const filtrada = prev.filter(p => p.titulo.toLowerCase() !== tituloActual.toLowerCase());
        return [
          {
            titulo: tituloActual,
            textoBusqueda,
            precios,
            ficha,
            historial,
            reviews,
            sucursales,
            subPestana,
          },
          ...filtrada,
        ].slice(0, 10);
      });
    }
  };

  const volverABusquedaAnterior = () => {
    if (pilaNavegacion.length === 0) return;
    const [anterior, ...resto] = pilaNavegacion;
    setPilaNavegacion(resto);
    setTextoBusqueda(anterior.textoBusqueda);
    setPrecios(anterior.precios);
    setFicha(anterior.ficha);
    setHistorial(anterior.historial);
    setReviews(anterior.reviews);
    setSucursales(anterior.sucursales);
    setSubPestana(anterior.subPestana);
    setMensaje('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Parámetros para comparador
  const [compP1, setCompP1] = useState<string>('');
  const [compP2, setCompP2] = useState<string>('');

  // ── Filtros Interactivos M3 ──
  const [filtroGenero, setFiltroGenero] = useState<'todos' | 'hombre' | 'mujer' | 'unisex'>('todos');
  const [filtroPrecio, setFiltroPrecio] = useState<'todos' | 'economico' | 'medio' | 'premium'>('todos');
  const [filtroTienda, setFiltroTienda] = useState<'todas' | 'Falabella' | 'DBS Beauty Store' | 'Alisha Perfumes' | 'Farmacias Ahumada'>('todas');
  const [ordenPrecios, setOrdenPrecios] = useState<'asc' | 'desc'>('asc');

  // Identifica la consulta en vivo vigente: si el usuario abre otro perfume o busca otra cosa,
  // la respuesta tardía de la consulta anterior se descarta
  const solicitudVivoRef = useRef(0);
  const [urlOfertaPreferida, setUrlOfertaPreferida] = useState<string | null>(null);

  const resetResultados = () => {
    solicitudVivoRef.current++;
    empujarVistaActualAPila();
    setPrecios(null); setFicha(null); setHistorial([]); setReviews([]); setSucursales([]); setMensaje('');
    setSubPestana('precios');
    setProdActivoIdx(0);
  };

  // ── Inspector Instantáneo de Perfume desde el Catálogo (0ms sin esperar al scraper) ──
  const [catalogoEnMemoria, setCatalogoEnMemoria] = useState<FraganciaCatalogoItem[]>(CATALOGO_FRAGANCIAS_CHILE);

  const inspeccionarPerfumeDelCatalogo = (
    item: FraganciaCatalogoItem,
    catalogoRef: FraganciaCatalogoItem[] = []
  ) => {
    empujarVistaActualAPila();
    if (catalogoRef.length > 0) {
      setCatalogoEnMemoria(catalogoRef);
    }
    setVistaPrincipal('explorar');
    setCargando(false);
    setTextoBusqueda(`${item.marca} ${item.nombre}`);
    setMensaje('');
    setProdActivoIdx(0);

    const notasTxt = `${item.familia} ${(item.notas || []).join(' ')} ${(item.notasDetalle || []).join(' ')}`.toLowerCase();
    const calcDim = (base: number, kws: string[]) =>
      Math.min(96, base + kws.reduce((acc, k) => (notasTxt.includes(k) ? acc + 18 : acc), 0));

    const radar: DatosRadar = {
      frescura: calcDim(32, ['cítric', 'citric', 'marin', 'acuát', 'bergamota', 'limón', 'menta']),
      dulzor: calcDim(28, ['dulce', 'gourmand', 'vainilla', 'tonka', 'chocolate', 'cacao', 'caramelo', 'miel']),
      amaderado: calcDim(35, ['madera', 'amaderad', 'cedro', 'sándalo', 'oud', 'vetiver', 'pachul']),
      especiado: calcDim(26, ['especia', 'pimienta', 'canela', 'cardamomo', 'tabaco', 'cuero']),
      floral: calcDim(28, ['floral', 'rosa', 'jazmín', 'iris', 'lavanda', 'azahar']),
      intensidad: item.proyeccion === 'Bestia' ? 95 : item.proyeccion === 'Alta' ? 84 : 68,
    };

    const alergenosDetectados: AlergenoDetectado[] = (item.alergenosIds || [])
      .map(id => {
        const ref = CATALOGO_ALERGIAS_IFRA.find(a => a.id === id);
        if (!ref) return null;
        return {
          id: ref.id,
          compuesto_quimico: ref.compuesto,
          nombre_comun: ref.nombre,
          presente_en: (item.notasDetalle || item.notas || []).slice(0, 2).join(', ') || ref.keywords.slice(0, 3).join(', '),
          nivel_riesgo: ref.riesgo,
          descripcion: ref.explicacion,
        };
      })
      .filter(Boolean) as AlergenoDetectado[];

    const notasBase = item.notasDetalle && item.notasDetalle.length >= 2 ? item.notasDetalle : item.notas;
    const notasSalida = notasBase.slice(0, 2);
    const notasCorazon = notasBase.slice(1, 3);
    const notasFondo = notasBase.slice(2, 5);

    // Similares olfativos y por precio extraídos inteligentemente del propio catálogo
    const otros = catalogoRef.filter(c => c.id !== item.id && c.nombre.toLowerCase() !== item.nombre.toLowerCase());
    const similaresOlf = otros
      .filter(c => c.familia === item.familia || c.notas.some(n => item.notas.includes(n)))
      .slice(0, 3)
      .map(c => ({
        nombre: c.nombre,
        marca: c.marca,
        motivo: `Comparte perfil ${c.familia.toLowerCase()} y notas de ${(c.notasDetalle || c.notas).slice(0, 2).join(' y ')}.`,
        precio_estimado: `$${c.precioReferencia.toLocaleString('es-CL')} CLP`,
      }));

    const similaresPrec = otros
      .filter(c => Math.abs(c.precioReferencia - item.precioReferencia) <= 25000)
      .slice(0, 3)
      .map(c => ({
        nombre: c.nombre,
        marca: c.marca,
        motivo: `Alternativa en el mismo rango de presupuesto${c.ml ? ` (${c.ml} ml)` : ''}.`,
        precio_estimado: `$${c.precioReferencia.toLocaleString('es-CL')} CLP`,
      }));

    const fichaInstantanea: FichaFragancia = {
      nombre: item.nombre,
      marca: item.marca,
      concentracion: item.concentracion,
      familia_olfativa: item.familia,
      acordes_principales: item.notas,
      genero: item.genero,
      notas_salida: notasSalida,
      notas_corazon: notasCorazon,
      notas_fondo: notasFondo,
      duracion_horas: item.duracionHoras,
      proyeccion: item.proyeccion,
      sillage: `Estela ${item.proyeccion.toLowerCase()} de carácter ${item.familia.toLowerCase()} (~${item.duracionHoras} horas en piel)`,
      estaciones: item.estaciones || ['Otoño', 'Primavera'],
      ocasiones: [item.ocasion || 'Uso Diario', 'Salidas Especiales'],
      mejor_momento_dia: item.ocasion.includes('Noche') ? 'Tarde / Noche' : 'Mañana / Tarde',
      publico_objetivo: `Amantes de las fragancias ${item.familia.toLowerCase()} de la casa ${item.marca}.`,
      intensidad: item.proyeccion === 'Bestia' ? 'Muy Intenso' : item.proyeccion === 'Alta' ? 'Intenso' : 'Moderado',
      presentaciones_habituales: item.ml ? [`${item.ml} ml`] : [],
      radar_olfativo: radar,
      alergenos_detectados: alergenosDetectados,
      guia_aplicacion: {
        atomizaciones: item.proyeccion === 'Bestia' ? '2 a 3 atomizaciones (alta concentración)' : '4 a 5 atomizaciones en puntos de pulso',
        puntos_pulso: ['Base del cuello', 'Detrás de las orejas', 'Interior de muñecas (sin frotar)'],
        consejo_experto: `Aplica ${item.nombre} sobre piel limpia e hidratada a 15 cm de distancia para preservar sus notas de ${(item.notasDetalle || item.notas).slice(0, 2).join(' y ')}.`,
        clima_ideal: `Óptimo para ${(item.estaciones || ['Otoño', 'Primavera']).join(' y ')}`,
      },
      descripcion: `${item.nombre} de ${item.marca} (${item.concentracion}${item.ml ? `, ${item.ml}ml` : ''}) pertenece a la familia ${item.familia}. Destaca por su combinación de ${(item.notasDetalle || item.notas).join(', ')}, ofreciendo una fijación aproximada de ${item.duracionHoras} horas y proyección ${item.proyeccion.toLowerCase()}.`,
      similares_olfativos: similaresOlf,
      similares_precio: similaresPrec,
    };

    const tiendaRef = item.tiendaMejorPrecio || 'Falabella';
    const ofertasIniciales: PrecioMercado[] = [
      {
        tienda: tiendaRef,
        // La concentración del catálogo puede ser estimada; solo se usan marca, nombre y ml
        nombre: `${item.marca} ${item.nombre}${item.ml ? ` ${item.ml}ml` : ''}`,
        precio: item.precioReferencia,
        moneda: 'CLP',
        stock: 'Sin verificar',
        url: item.urlMejorPrecio || `https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(`${item.marca} ${item.nombre}`)}`,
        imagen: item.imagen,
      },
    ];

    // Sin historial inventado: solo se muestra historial cuando el backend lo tiene registrado.
    const historialSintetico: RegistroHistorial[] = [];

    const sucursalesRef: Sucursal[] = [
      {
        tienda: 'Falabella',
        nombre: 'Falabella Parque Arauco',
        direccion: 'Av. Pdte. Kennedy 5413, Las Condes',
        horario: 'Lun a Dom: 10:00 - 20:30',
        comuna: 'Las Condes',
        region: 'Metropolitana',
        telefono: '600 380 5000',
        lat: -33.4058,
        lng: -70.5792,
      },
      {
        tienda: 'DBS Beauty Store',
        nombre: 'DBS Costanera Center',
        direccion: 'Av. Andrés Bello 2425, Local 2110, Providencia',
        horario: 'Lun a Dom: 10:00 - 21:00',
        comuna: 'Providencia',
        region: 'Metropolitana',
        telefono: '+56 2 2273 0000',
        lat: -33.4175,
        lng: -70.6063,
      },
      {
        tienda: 'Alisha Perfumes',
        nombre: 'Alisha Perfumes Providencia',
        direccion: 'Av. Andrés Bello 2447, Providencia',
        horario: 'Lun a Dom: 10:00 - 20:30',
        comuna: 'Providencia',
        region: 'Metropolitana',
        telefono: '+56 9 8765 4322',
        lat: -33.4172,
        lng: -70.6071,
      },
      {
        tienda: 'Farmacias Ahumada',
        nombre: 'Farmacias Ahumada Huérfanos',
        direccion: 'Huérfanos 1055, Santiago Centro',
        horario: 'Lun a Sab: 08:30 - 21:00',
        comuna: 'Santiago',
        region: 'Metropolitana',
        telefono: '600 222 4000',
        lat: -33.4401,
        lng: -70.6506,
      },
    ];

    // Sin reseñas inventadas: la pestaña Reseñas solo muestra las que escriban los usuarios.
    const reviewsRef: Review[] = [];

    // Sin notas conocidas no se arma ficha: el radar y la pirámide serían inventados
    setFicha((item.notas || []).length > 0 ? fichaInstantanea : null);
    setPrecios(ofertasIniciales);
    setHistorial(historialSintetico);
    setSucursales(sucursalesRef);
    setReviews(reviewsRef);
    // Abrir la ficha con Características & Radar (datos del catálogo, no inventados)
    setSubPestana('ficha');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Se muestra al instante el precio indexado y en segundo plano se consulta a las tiendas en vivo
    const ofertaCatalogo = ofertasIniciales[0];
    const fechaIndexada = item.fechaPrecio ? ` del ${item.fechaPrecio}` : '';
    setMensaje(`Precio indexado${fechaIndexada}. Actualizando en vivo en las 4 tiendas...`);
    setUrlOfertaPreferida(ofertaCatalogo.url);
    const idSolicitud = ++solicitudVivoRef.current;
    fetch(`${API_BASE}/api/buscar?q=${encodeURIComponent(`${item.marca} ${item.nombre}`)}`)
      .then(r => r.json())
      .then(data => {
        if (idSolicitud !== solicitudVivoRef.current) return;
        const vivos: PrecioMercado[] = data?.success && Array.isArray(data.precios) ? data.precios : [];
        if (vivos.length === 0) {
          setMensaje(`Sin ofertas en vivo para este perfume: se muestra el precio indexado${fechaIndexada}.`);
          return;
        }
        // Se mantiene activo el producto que el usuario abrió (mismo tamaño y tienda), no el más barato
        const incluyeOferta = vivos.some(p => mismoProductoUrl(p.url, ofertaCatalogo.url));
        setPrecios(incluyeOferta ? vivos : [...vivos, ofertaCatalogo]);
        setUrlOfertaPreferida(ofertaCatalogo.url);
        if (Array.isArray(data.historial)) setHistorial(data.historial);
        if (Array.isArray(data.sucursales)) setSucursales(data.sucursales);
        if (Array.isArray(data.reviews)) setReviews(data.reviews);
        if (data.ficha) setFicha(prev => prev ?? data.ficha);
        setMensaje(
          incluyeOferta
            ? `Precios actualizados en vivo: ${vivos.length} ofertas en tiendas chilenas.`
            : `Precios actualizados en vivo: ${vivos.length} ofertas. Este producto no apareció en la búsqueda; su precio es el indexado${fechaIndexada}.`
        );
      })
      .catch(() => {
        if (idSolicitud === solicitudVivoRef.current) {
          setMensaje(`No se pudo consultar en vivo: se muestra el precio indexado${fechaIndexada}.`);
        }
      });
  };

  // ── Búsqueda por Texto ──────────────────────
  const buscarPorNombre = async (terminoManual?: string) => {
    const termino = (terminoManual ?? textoBusqueda).trim();
    if (termino.length < 2) {
      setMensaje('Escribe al menos 2 caracteres para iniciar la búsqueda.');
      return;
    }
    if (terminoManual) setTextoBusqueda(terminoManual);
    setVistaPrincipal('explorar');
    setCargando(true);
    setMensaje(`Consultando stock en vivo en Falabella, DBS, Alisha y Ahumada para "${termino}"...`);
    resetResultados();
    const inicio = Date.now();

    try {
      const resp = await fetch(`${API_BASE}/api/buscar?q=${encodeURIComponent(termino)}`);
      const data = await resp.json();
      const duracion = data.latencia_ms ?? (Date.now() - inicio);
      if (data.success && data.es_perfume !== false) {
        setMensaje(data.mensaje);
        setPrecios(data.precios);
        setUltimaLatencia({ ms: duracion, cache: Boolean(data.desde_cache) });
        registrarBusquedaReciente(termino);
        if (data.ficha) setFicha(data.ficha);
        if (data.historial) setHistorial(data.historial);
        if (data.reviews) setReviews(data.reviews);
        if (data.sucursales) setSucursales(data.sucursales);
        // Auto-aprender la marca y fragancia buscada en el catálogo de filtros
        aprenderPerfumeEnCatalogoLocal(termino, data.precios || [], data.ficha || null);
        registrarLogCliente(
          data.desde_cache ? 'CACHE' : 'SUCCESS',
          'BUSCADOR',
          `Búsqueda "${termino}": ${data.precios?.length || 0} ofertas (${data.desde_cache ? 'Caché RAM' : 'Scraping en vivo'})`,
          duracion
        );
      } else {
        setMensaje(data.mensaje);
        registrarLogCliente('WARN', 'BUSCADOR', `Aviso en búsqueda "${termino}": ${data.mensaje}`, duracion);
      }
    } catch {
      setMensaje('No se pudo conectar con el servidor backend en el puerto 8000.');
      registrarLogCliente('ERROR', 'BUSCADOR', `Servidor backend no respondió para "${termino}"`);
    } finally {
      setCargando(false);
    }
  };

  // ── Búsqueda por Foto / Cámara ─────────────
  const analizarPorFoto = async () => {
    if (!archivoFoto) {
      setMensaje('Selecciona o captura una imagen del frasco primero.');
      return;
    }
    setCargando(true);
    setMensaje('Analizando botella con visión computacional e IA...');
    resetResultados();
    const inicio = Date.now();

    const formData = new FormData();
    formData.append('imagen', archivoFoto);

    try {
      const resp = await fetch(`${API_BASE}/api/analizar`, { method: 'POST', body: formData });
      const data = await resp.json();
      const dur = Date.now() - inicio;
      if (data.success) {
        setMensaje(data.mensaje);
        setUltimaLatencia({ ms: dur, cache: false });
        if (data.analisis?.perfume) setTextoBusqueda(data.analisis.perfume);
        if (data.precios) setPrecios(data.precios);
        if (data.ficha) setFicha(data.ficha);
        if (data.historial) setHistorial(data.historial);
        if (data.reviews) setReviews(data.reviews);
        if (data.sucursales) setSucursales(data.sucursales);
        if (data.analisis?.perfume) {
          aprenderPerfumeEnCatalogoLocal(
            `${data.analisis.marca || ''} ${data.analisis.perfume}`.trim(),
            data.precios || [],
            data.ficha || null
          );
        }
        setMostrarModalFoto(false);
        registrarLogCliente('SUCCESS', 'VISION_IA', `Foto analizada con éxito: "${data.analisis?.perfume}"`, dur);
      } else {
        setMensaje(data.mensaje);
        registrarLogCliente('ERROR', 'VISION_IA', `Error al analizar foto: ${data.mensaje}`, dur);
      }
    } catch {
      setMensaje('Error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  // ── Aplicación de Filtros en Tiempo Real ──
  const preciosFiltrados = (precios || [])
    .filter(item => {
      if (filtroTienda !== 'todas' && item.tienda !== filtroTienda) return false;
      if (filtroGenero !== 'todos') {
        const g = detectarGeneroProducto(item.nombre, ficha?.genero);
        if (g !== filtroGenero) return false;
      }
      if (filtroPrecio !== 'todos' && item.precio !== null) {
        if (filtroPrecio === 'economico' && item.precio >= 45000) return false;
        if (filtroPrecio === 'medio' && (item.precio < 45000 || item.precio > 85000)) return false;
        if (filtroPrecio === 'premium' && item.precio <= 85000) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const agotadoA = a.stock === 'Agotado' ? 1 : 0;
      const agotadoB = b.stock === 'Agotado' ? 1 : 0;
      if (agotadoA !== agotadoB) return agotadoA - agotadoB;
      const pA = a.precio ?? (ordenPrecios === 'asc' ? Infinity : -Infinity);
      const pB = b.precio ?? (ordenPrecios === 'asc' ? Infinity : -Infinity);
      return ordenPrecios === 'asc' ? pA - pB : pB - pA;
    });

  const precioMinimo = preciosFiltrados
    .filter(p => p.precio !== null && p.stock !== 'Agotado')
    .reduce((min, p) => (p.precio! < min ? p.precio! : min), Infinity);

  // Al llegar ofertas nuevas, se deja activa la del producto abierto desde el catálogo (no la más barata)
  useEffect(() => {
    if (!urlOfertaPreferida || !precios) return;
    const idx = preciosFiltrados.findIndex(p => mismoProductoUrl(p.url, urlOfertaPreferida));
    if (idx >= 0) setProdActivoIdx(idx);
    setUrlOfertaPreferida(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precios, urlOfertaPreferida]);

  const totalAlergiasConfiguradas = alergiasUsuario.length + notasAlergiaCustom.length;

  return (
    <div className="m3-app-shell">
      {/* ── Top Bar Editorial con Iluminación Ambiental y Iconografía Vectorial ── */}
      <header className="m3-top-bar">
        <div className="m3-brand-title">
          <span className="m3-brand-logo-mark">
            <Sparkles size={22} strokeWidth={2.2} />
          </span>
          <span>PerfumeScan</span>
          <span className="m3-brand-badge">Chile v5.0</span>
        </div>
        <p className="m3-brand-subtitle">
          Inteligencia olfativa y comparador multitienda en tiempo real con Radar Sensorial 6D, Alerta Dermatológica IFRA y Planificador de Compras.
        </p>

        {/* Barra de Herramientas Rápidas con Iconos Vectoriales Lucide */}
        <div className="m3-top-utility-bar">
          <button
            type="button"
            className="m3-utility-pill"
            onClick={() => setMostrarModalLista(true)}
            title="Ver mi lista de compras y perfumes guardados"
          >
            <ShoppingBag size={15} strokeWidth={2.2} style={{ color: 'var(--m3-primary)' }} />
            <span>Mi Lista de Compras</span>
            <span className="m3-badge-counter">{listaCompras.length}</span>
          </button>

          <button
            type="button"
            className="m3-utility-pill"
            onClick={() => setMostrarModalAlergias(true)}
            style={{
              borderColor: totalAlergiasConfiguradas > 0 ? 'rgba(220, 38, 38, 0.5)' : undefined,
            }}
            title="Configurar mis alergias e intolerancias dermatológicas"
          >
            <ShieldAlert size={15} strokeWidth={2.2} style={{ color: totalAlergiasConfiguradas > 0 ? '#dc2626' : 'var(--m3-text-secondary)' }} />
            <span>Mis Alergias</span>
            <span
              className="m3-badge-counter"
              style={{ background: totalAlergiasConfiguradas > 0 ? '#dc2626' : '#64748b' }}
            >
              {totalAlergiasConfiguradas}
            </span>
          </button>

          <button
            type="button"
            className="m3-utility-pill"
            onClick={() => setMostrarModalLogs(true)}
            title="Abrir consola de logs y telemetría en tiempo real"
          >
            <Terminal size={15} strokeWidth={2.2} style={{ color: 'var(--m3-primary)' }} />
            <span>Logs</span>
            {ultimaLatencia && (
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: ultimaLatencia.cache ? '#d97706' : '#15803d', fontWeight: 700 }}>
                {ultimaLatencia.cache ? `${ultimaLatencia.ms}ms` : `${(ultimaLatencia.ms / 1000).toFixed(1)}s`}
              </span>
            )}
          </button>

          {estadoRefresco && (estadoRefresco.enCurso || estadoRefresco.ultimo) && (
            <span
              className="m3-utility-pill"
              role="status"
              aria-live="polite"
              title={
                estadoRefresco.enCurso
                  ? 'Re-cotizando el catálogo en las 4 tiendas; la app se puede usar mientras tanto'
                  : `Último refresco: ${estadoRefresco.ultimo?.reCotizados} de ${estadoRefresco.ultimo?.perfumes} precios verificados en tienda`
              }
            >
              <Activity size={15} strokeWidth={2.2} style={{ color: estadoRefresco.enCurso ? '#d97706' : '#15803d' }} />
              {estadoRefresco.enCurso ? (
                <>
                  <span>Actualizando precios {estadoRefresco.procesados}/{estadoRefresco.total}</span>
                  <span style={{ width: '54px', height: '5px', borderRadius: '3px', background: 'var(--m3-surface-container-high)', overflow: 'hidden', display: 'inline-block' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${estadoRefresco.total ? Math.round((estadoRefresco.procesados / estadoRefresco.total) * 100) : 0}%`,
                        background: 'var(--m3-primary)',
                        transition: 'width 0.4s',
                      }}
                    />
                  </span>
                </>
              ) : (
                <span>
                  Precios al día ·{' '}
                  {new Date(estadoRefresco.ultimo!.ultimo).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </span>
          )}

          <button
            type="button"
            className="m3-utility-pill"
            onClick={alternarTema}
            title="Alternar entre Modo Claro y Modo Oscuro Luxury"
          >
            {temaOscuro ? (
              <><Sun size={15} strokeWidth={2.2} style={{ color: '#fbbf24' }} /> <span>Modo Claro</span></>
            ) : (
              <><Moon size={15} strokeWidth={2.2} style={{ color: 'var(--m3-primary)' }} /> <span>Modo Oscuro</span></>
            )}
          </button>
        </div>

        {/* M3 Segmented Navigation */}
        <nav className="m3-nav-segmented">
          <button
            className={`m3-nav-btn ${vistaPrincipal === 'explorar' ? 'active' : ''}`}
            onClick={() => setVistaPrincipal('explorar')}
          >
            <Search size={15} strokeWidth={2.2} /> Explorar Fragancias
          </button>
          <button
            className={`m3-nav-btn ${vistaPrincipal === 'comparar' ? 'active' : ''}`}
            onClick={() => setVistaPrincipal('comparar')}
          >
            <Scale size={15} strokeWidth={2.2} /> Comparador Frente a Frente
          </button>
          <button
            className="m3-nav-btn"
            style={{ borderLeft: '1px solid var(--m3-outline-variant)' }}
            onClick={() => setMostrarModalRango(true)}
            title="Ver alcance de búsqueda y cobertura en Chile"
          >
            <Compass size={15} strokeWidth={2.2} /> Cobertura
          </button>
        </nav>
      </header>

      {/* ── Contenido Principal ── */}
      <main className="m3-content-body">
        {/* VISTA 1: EXPLORAR Y BUSCAR PERFUMES */}
        {vistaPrincipal === 'explorar' && (
          <div>
            {/* Unified Search Bar */}
            <div className="m3-search-bar">
              <span className="m3-search-icon">
                <Search size={19} strokeWidth={2.3} />
              </span>
              <input
                type="text"
                className="m3-search-input"
                placeholder="Busca por fragancia o casa perfumista (ej: Acqua Di Gio, Sauvage, Bleu de Chanel...)"
                value={textoBusqueda}
                onChange={e => setTextoBusqueda(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !cargando && buscarPorNombre()}
              />
              {textoBusqueda && (
                <button className="m3-search-clear" onClick={() => setTextoBusqueda('')} title="Limpiar">
                  <X size={17} />
                </button>
              )}
              <button
                className={`m3-camera-trigger ${mostrarModalFoto ? 'active' : ''}`}
                onClick={() => setMostrarModalFoto(!mostrarModalFoto)}
                title="Escanear frasco con foto o cámara"
              >
                <Camera size={16} strokeWidth={2.1} />
                <span className="m3-hide-mobile">{archivoFoto ? 'Foto lista' : 'Escanear'}</span>
              </button>
              <button
                className="m3-search-submit"
                onClick={() => buscarPorNombre()}
                disabled={cargando}
              >
                <Search size={16} strokeWidth={2.4} />
                <span className="m3-hide-mobile">{cargando ? 'Consultando...' : 'Cotizar'}</span>
              </button>
            </div>

            {/* Barra rápida de navegación hacia atrás cuando se está en el catálogo */}
            {!precios && !cargando && pilaNavegacion.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={volverABusquedaAnterior}
                  className="m3-chip"
                  style={{
                    background: 'var(--m3-primary-container)',
                    color: 'var(--m3-on-primary-container)',
                    borderColor: 'var(--m3-primary)',
                    fontWeight: 700,
                  }}
                >
                  ↶ Volver a "{pilaNavegacion[0].titulo}"
                </button>
                {pilaNavegacion.length > 1 && (
                  <span style={{ fontSize: '11.5px', color: 'var(--m3-text-tertiary)' }}>
                    ({pilaNavegacion.length} inspecciones en tu historial de sesión)
                  </span>
                )}
              </div>
            )}

            {/* Expandable Photo Upload Sheet */}
            {mostrarModalFoto && (
              <div className="m3-photo-sheet">
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Camera size={17} /> Identificación Visual de Frascos con IA
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setArchivoFoto(f);
                  }}
                  style={{ fontSize: '13px', marginBottom: '10px' }}
                />
                {archivoFoto && (
                  <div style={{ marginTop: '8px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                      Archivo preparado: {archivoFoto.name}
                    </p>
                    <button
                      onClick={analizarPorFoto}
                      disabled={cargando}
                      className="m3-btn m3-btn-primary"
                    >
                      {cargando ? 'Procesando visión IA...' : 'Analizar Frasco con IA'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Shimmer Skeleton Loader mientras carga en vivo */}
            {cargando && (
              <div>
                <p style={{
                  margin: '16px 0 6px 0', fontSize: '13px', color: 'var(--m3-primary)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Sparkles size={16} /> {mensaje}
                </p>
                <div className="m3-skeleton-grid">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="m3-skeleton-card">
                      <div className="m3-skeleton-box" style={{ height: '22px', width: '45%' }} />
                      <div className="m3-skeleton-box" style={{ height: '150px', width: '100%' }} />
                      <div className="m3-skeleton-box" style={{ height: '20px', width: '85%' }} />
                      <div className="m3-skeleton-box" style={{ height: '38px', width: '100%', marginTop: 'auto' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mensaje de estado cuando terminó */}
            {!cargando && mensaje && (
              <p style={{
                margin: '14px 0 12px 0', fontSize: '12.5px', color: 'var(--m3-text-secondary)',
                background: 'var(--m3-surface-container-low)', padding: '9px 15px', borderRadius: '10px',
                border: '1px solid var(--m3-outline-variant)'
              }}>
                {mensaje}
              </p>
            )}

            {/* Semáforo de Alergias Siempre Visible al Buscar un Perfume */}
            {ficha && (
              <BannerSemaforoAlergia
                ficha={ficha}
                alergiasIds={alergiasUsuario}
                notasCustom={notasAlergiaCustom}
                onAbrirConfig={() => setMostrarModalAlergias(true)}
              />
            )}

            {/* ── VISTA DETALLE DE PRODUCTO ESTILO KNASTA (Todo en una sola página limpia y sin recortes) ── */}
            {precios && (() => {
              const ofertaActiva = preciosFiltrados[prodActivoIdx] || preciosFiltrados[0] || precios[0];
              const precioActual = ofertaActiva?.precio || precioMinimo || 0;
              const mlActivo = extraerMl(ofertaActiva?.nombre || '');
              // El título usa la concentración de la oferta elegida, no la de la ficha (que puede ser otra versión)
              const concentracionActiva = extraerConcentracion(ofertaActiva?.nombre || '');
              const nombreBase = ficha?.nombre || ofertaActiva?.nombre || textoBusqueda;
              const nombreLimpio = nombreBase
                .replace(PATRON_CONCENTRACION, '')
                .replace(/\b\d{2,3}\s*ml\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim() || nombreBase;
              const nombreTitulo = concentracionActiva ? `${nombreLimpio} ${concentracionActiva}` : nombreLimpio;
              // Solo el mismo producto en la misma tienda: otro tamaño, concentración o tienda no es un descuento
              const historialProducto = ofertaActiva
                ? historial.filter(h => h.tienda === ofertaActiva.tienda && h.nombre === ofertaActiva.nombre)
                : [];
              const preciosHistValidos = historialProducto.map(h => h.precio).filter(p => p > 0);
              // Solo hay análisis de precio si existe historial REAL registrado (mínimo 2 puntos)
              const hayHistorialReal = preciosHistValidos.length >= 2;
              const precioMaxHist = hayHistorialReal ? Math.max(...preciosHistValidos, precioActual) : precioActual;
              const precioMinHist = hayHistorialReal ? Math.min(...preciosHistValidos, precioActual) : precioActual;
              const precioHabitual = hayHistorialReal
                ? Math.round(preciosHistValidos.reduce((a, b) => a + b, 0) / preciosHistValidos.length)
                : precioActual;
              const ahorroReal = Math.max(0, precioMaxHist - precioActual);
              const pctBajoMax = precioMaxHist > 0 ? Math.round(((precioMaxHist - precioActual) / precioMaxHist) * 100) : 0;
              const yaGuardadoHero = listaCompras.some(
                l => l.perfume.toLowerCase() === (ficha?.nombre || ofertaActiva?.nombre || '').toLowerCase()
              );
              const imgHero = normalizarImagen(ofertaActiva?.imagen);
              const tiendaCorta = (ofertaActiva?.tienda || 'Falabella')
                .replace(' Beauty Store', '')
                .replace(' Perfumes', '')
                .replace('Farmacias ', '');

              // Perfumes relacionados extraídos del catálogo en memoria para la grilla inferior
              const nombreRef = (ficha?.nombre || textoBusqueda).toLowerCase();
              // La familia y las notas de la IA vienen en texto libre: se traducen a las etiquetas del catálogo
              const familiaFicha = ficha ? familiaCatalogoDesde(ficha.familia_olfativa || '') : null;
              const etiquetasFicha = ficha
                ? etiquetasDeNotas([
                    ...(ficha.notas_salida || []),
                    ...(ficha.notas_corazon || []),
                    ...(ficha.notas_fondo || []),
                    ...(ficha.acordes_principales || []),
                  ].join(' '))
                : [];
              // Se excluye el mismo perfume aunque el catálogo lo nombre distinto (ej: "Eros" vs "Versace Eros")
              const nombresActuales = [nombreRef, textoBusqueda.toLowerCase()].filter(Boolean);
              const esElMismo = (c: FraganciaCatalogoItem) => {
                const n = c.nombre.toLowerCase();
                return nombresActuales.some(a => a.includes(n) || n.includes(a));
              };
              const relacionadosCatalogo = catalogoEnMemoria
                .filter(c => !esElMismo(c))
                .map(c => {
                  const motivos: string[] = [];
                  let puntos = 0;
                  if (familiaFicha && familiaFicha !== 'Sin clasificar' && c.familia === familiaFicha) {
                    puntos += 3;
                    motivos.push('Misma familia');
                  }
                  const comunes = c.notas.filter(n => etiquetasFicha.includes(n));
                  if (comunes.length > 0) {
                    puntos += 2 * comunes.length;
                    motivos.push(`Notas: ${comunes.slice(0, 2).map(n => n.split(/ \(| \//)[0]).join(', ')}`);
                  }
                  if (ficha && c.marca.toLowerCase() === ficha.marca.toLowerCase()) {
                    puntos += 1;
                    motivos.push('Misma marca');
                  }
                  if (precioActual > 0 && Math.abs(c.precioReferencia - precioActual) / precioActual <= 0.25) {
                    puntos += 2;
                    motivos.push('Precio similar');
                  }
                  return { c, puntos, motivos };
                })
                .filter(r => r.puntos > 0)
                .sort((a, b) => b.puntos - a.puntos)
                .slice(0, 6);

              // Coordenadas SVG para el gráfico de área (solo con historial real)
              const puntosChart = hayHistorialReal ? historialProducto : [];
              const svgW = 620;
              const svgH = 220;
              const padL = 58;
              const padR = 18;
              const padT = 18;
              const padB = 32;
              const maxY = Math.round(precioMaxHist * 1.12);
              const minY = 0;
              const coords = puntosChart.map((pt, idx) => {
                const x = padL + (idx / Math.max(1, puntosChart.length - 1)) * (svgW - padL - padR);
                const y = padT + (1 - (pt.precio - minY) / Math.max(1, maxY - minY)) * (svgH - padT - padB);
                return { x, y, ...pt };
              });
              const polylinePoints = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
              const areaPath =
                coords.length > 0
                  ? `M ${coords[0].x.toFixed(1)} ${(svgH - padB).toFixed(1)} ` +
                    coords.map(c => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ') +
                    ` L ${coords[coords.length - 1].x.toFixed(1)} ${(svgH - padB).toFixed(1)} Z`
                  : '';

              return (
                <div className="knasta-detail-container">
                  {/* 1. Barra Superior de Breadcrumb + Retroceso (Con flex-wrap para que nunca se corte) */}
                  <nav className="knasta-breadcrumb-bar" aria-label="Navegación de ficha de producto">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={resetResultados}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--m3-text-primary)',
                          fontWeight: 800,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        ← Volver
                      </button>
                      <span style={{ color: 'var(--m3-outline)' }}>|</span>
                      <button
                        type="button"
                        onClick={resetResultados}
                        style={{ border: 'none', background: 'transparent', color: 'var(--m3-text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Perfumes y Fragancias
                      </button>
                      <span style={{ color: 'var(--m3-text-tertiary)' }}>›</span>
                      <span style={{ color: 'var(--m3-text-secondary)', fontSize: '12px' }}>
                        {ficha?.familia_olfativa || 'Catálogo Chile'}
                      </span>
                      <span style={{ color: 'var(--m3-text-tertiary)' }}>›</span>
                      <strong style={{ color: '#60a5fa', fontSize: '12px' }}>
                        {ficha?.marca || 'Perfumería'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {pilaNavegacion.length > 0 && (
                        <button
                          type="button"
                          onClick={volverABusquedaAnterior}
                          className="m3-chip"
                          style={{
                            padding: '5px 11px',
                            fontSize: '11.5px',
                            borderColor: 'var(--m3-primary)',
                            color: 'var(--m3-primary)',
                            fontWeight: 700,
                          }}
                        >
                          ↶ Volver a "{pilaNavegacion[0].titulo.length > 24 ? pilaNavegacion[0].titulo.slice(0, 24) + '…' : pilaNavegacion[0].titulo}"
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => buscarPorNombre(ficha ? `${ficha.marca} ${ficha.nombre}` : textoBusqueda)}
                        className="m3-chip"
                        style={{ padding: '5px 11px', fontSize: '11.5px', fontWeight: 700 }}
                        title="Buscar ofertas en vivo en Falabella, DBS, Alisha y Farmacias Ahumada"
                      >
                        <Search size={12} /> Buscar en las 4 tiendas en vivo
                      </button>
                    </div>
                  </nav>

                  {/* 2. Bloque Hero Principal 2 Columnas Estilo Knasta */}
                  <div className="knasta-hero-split">
                    {/* Columna Izquierda: Vitrina Blanca con Botones Flotantes */}
                    <div className="knasta-hero-gallery">
                      <div className="knasta-hero-floating-actions">
                        <button
                          type="button"
                          className="knasta-floating-circle-btn"
                          title={yaGuardadoHero ? 'Guardado en tu lista' : 'Guardar en mi lista de compras'}
                          onClick={() =>
                            guardarEnListaCompras({
                              perfume: ficha?.nombre || ofertaActiva?.nombre || textoBusqueda,
                              marca: ficha?.marca,
                              tienda: ofertaActiva?.tienda || 'Falabella',
                              precioGuardado: precioActual,
                              ml: extraerMl(ofertaActiva?.nombre || '') || 100,
                              url: ofertaActiva?.url || '',
                              imagen: imgHero,
                              categoria: 'comprar',
                              notaPersonal: ficha ? `${ficha.familia_olfativa} · ~${ficha.duracion_horas}h` : '',
                            })
                          }
                        >
                          <Heart size={16} fill={yaGuardadoHero ? '#ef4444' : 'none'} color={yaGuardadoHero ? '#ef4444' : '#ffffff'} />
                        </button>
                        <button
                          type="button"
                          className="knasta-floating-circle-btn"
                          title="Comparar frente a frente (VS)"
                          onClick={() => {
                            const actual = ficha ? `${ficha.marca} ${ficha.nombre}` : textoBusqueda;
                            setCompP1(actual);
                            if (!compP2 || compP2.toLowerCase() === actual.toLowerCase()) {
                              setCompP2(ficha?.similares_olfativos?.[0]?.nombre || 'Bleu de Chanel');
                            }
                            setVistaPrincipal('comparar');
                          }}
                        >
                          <Scale size={16} />
                        </button>
                        {ofertaActiva?.url && (
                          <a
                            href={ofertaActiva.url}
                            target="_blank"
                            rel="noreferrer"
                            className="knasta-floating-circle-btn"
                            title={`Abrir en ${ofertaActiva.tienda}`}
                            style={{ textDecoration: 'none' }}
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>

                      {imgHero ? (
                        <img
                          src={imgHero}
                          alt={ficha?.nombre || textoBusqueda}
                          style={{ maxWidth: '240px', maxHeight: '260px', objectFit: 'contain' }}
                        />
                      ) : (
                        <BottlePlaceholder size={120} />
                      )}

                      {/* Indicadores de ofertas disponibles */}
                      {preciosFiltrados.length > 1 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                          {preciosFiltrados.slice(0, 6).map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setProdActivoIdx(idx)}
                              style={{
                                width: idx === prodActivoIdx ? '18px' : '7px',
                                height: '7px',
                                borderRadius: '99px',
                                border: 'none',
                                background: idx === prodActivoIdx ? '#1e293b' : '#cbd5e1',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title={`Ver oferta #${idx + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Columna Derecha: Información de Precio, Ahorro y Botón Visitar Tienda */}
                    <div className="knasta-hero-info">
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--m3-text-tertiary)', fontWeight: 700 }}>
                          {ficha?.marca || 'Perfumería Original'}
                        </span>
                        <h2
                          style={{
                            margin: '3px 0 10px 0',
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: 'var(--m3-text-primary)',
                            lineHeight: 1.3,
                          }}
                        >
                          {nombreTitulo}{mlActivo ? ` ${mlActivo} ml` : ''} | {tiendaCorta}
                        </h2>

                        {/* Fila Precio Principal (+ tachado y % solo si hay historial real) */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          <span style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--m3-text-primary)', letterSpacing: '-0.02em' }}>
                            {precioActual > 0 ? `$ ${precioActual.toLocaleString('es-CL')}` : 'Precio no disponible'}
                          </span>
                          <span
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '999px',
                              background: 'var(--m3-surface-container-high)',
                              color: mlActivo ? 'var(--m3-text-primary)' : 'var(--m3-text-tertiary)',
                            }}
                          >
                            {mlActivo
                              ? `${mlActivo} ml · ${calcularPrecioPorMl(precioActual, mlActivo) ?? ''}`
                              : 'Tamaño no indicado por la tienda'}
                          </span>
                          {hayHistorialReal && pctBajoMax > 0 && (
                            <>
                              <span style={{ fontSize: '13.5px', color: 'var(--m3-text-tertiary)', textDecoration: 'line-through' }}>
                                $ {precioMaxHist.toLocaleString('es-CL')}
                              </span>
                              <span className="knasta-discount-badge" style={{ fontSize: '12px', padding: '3px 9px' }}>
                                ↘ {pctBajoMax}%
                              </span>
                            </>
                          )}
                        </div>

                        {/* Caja de Origen del Dato: de dónde sale el precio */}
                        <div
                          style={{
                            border: '1px solid var(--m3-outline-variant)',
                            background: 'var(--m3-surface-container-low)',
                            borderRadius: '12px',
                            padding: '12px 14px',
                          }}
                        >
                          <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--m3-text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Store size={14} /> Fuente del precio: {ofertaActiva?.tienda || tiendaCorta}
                          </div>
                          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--m3-text-secondary)', lineHeight: 1.45 }}>
                            Precio publicado en la ficha del producto en {ofertaActiva?.tienda || tiendaCorta}
                            {ofertaActiva?.nombre ? <> (“{ofertaActiva.nombre}”)</> : null}. Puede cambiar: confirma el valor final en la tienda.
                          </p>
                          {ofertaActiva?.url && (
                            <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--m3-text-tertiary)', wordBreak: 'break-all' }}>
                              {ofertaActiva.url.replace(/^https?:\/\//, '').split('?')[0].slice(0, 80)}
                            </p>
                          )}
                          {hayHistorialReal && ahorroReal > 0 && (
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#65a30d', fontWeight: 700 }}>
                              {pctBajoMax}% bajo el precio más alto que registramos (${precioMaxHist.toLocaleString('es-CL')}).
                            </p>
                          )}
                          {ficha && (
                            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--m3-text-tertiary)' }}>
                              {concentracionActiva || ficha.concentracion} · Familia {ficha.familia_olfativa} · Duración aprox. ~{ficha.duracion_horas}h (referencial).
                            </p>
                          )}
                        </div>

                        {/* Selector rápido si hay varias tiendas cotizadas */}
                        {preciosFiltrados.length > 1 && (
                          <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {preciosFiltrados.slice(0, 4).map((of, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setProdActivoIdx(i)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  border: i === prodActivoIdx ? '1.5px solid #84cc16' : '1px solid var(--m3-outline-variant)',
                                  background: i === prodActivoIdx ? 'rgba(132, 204, 22, 0.14)' : 'var(--m3-surface-container)',
                                  color: 'var(--m3-text-primary)',
                                }}
                              >
                                {of.tienda.replace(' Beauty Store', '').replace(' Perfumes', '')}: ${(of.precio || 0).toLocaleString('es-CL')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botones CTA Principales */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                        <a
                          href={ofertaActiva?.url || `https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(ficha?.nombre || textoBusqueda)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="knasta-cta-green"
                          style={{ padding: '12px 18px', fontSize: '13.5px', textDecoration: 'none' }}
                        >
                          Visitar {tiendaCorta} <ExternalLink size={15} />
                        </a>

                        <span style={{ textAlign: 'center', fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>
                          Guarda este perfume en tu lista personal para monitorear su precio
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            guardarEnListaCompras({
                              perfume: ficha?.nombre || ofertaActiva?.nombre || textoBusqueda,
                              marca: ficha?.marca,
                              tienda: ofertaActiva?.tienda || 'Falabella',
                              precioGuardado: precioActual,
                              ml: extraerMl(ofertaActiva?.nombre || '') || 100,
                              url: ofertaActiva?.url || '',
                              imagen: imgHero,
                              categoria: 'comprar',
                              notaPersonal: ficha ? `${ficha.familia_olfativa} · ~${ficha.duracion_horas}h` : '',
                            })
                          }
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            borderRadius: '9px',
                            border: '1px solid #60a5fa',
                            background: yaGuardadoHero ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                            color: '#60a5fa',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px',
                          }}
                        >
                          <ShoppingBag size={14} />
                          {yaGuardadoHero ? 'Guardado en mi Lista de Seguimiento' : 'Activar alerta / Guardar en mi Lista'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Pestañas Tipo Carpeta (Flex-Wrap: Nunca se cortan fuera de pantalla) */}
                  <div>
                    <div className="knasta-folder-tabs">
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'historial' ? 'active' : ''}`}
                        onClick={() => setSubPestana('historial')}
                      >
                        <TrendingUp size={15} /> Historial
                      </button>
                      {ficha && (
                        <>
                          <button
                            type="button"
                            className={`knasta-folder-tab ${subPestana === 'ficha' ? 'active' : ''}`}
                            onClick={() => setSubPestana('ficha')}
                          >
                            <Activity size={15} /> Características & Radar 6D
                          </button>
                          <button
                            type="button"
                            className={`knasta-folder-tab ${subPestana === 'guia' ? 'active' : ''}`}
                            onClick={() => setSubPestana('guia')}
                          >
                            <Wind size={15} /> Guía de Uso & ML
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'tiendas' ? 'active' : ''}`}
                        onClick={() => setSubPestana('tiendas')}
                      >
                        <MapPin size={15} /> Sucursales GPS
                      </button>
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'reviews' ? 'active' : ''}`}
                        onClick={() => setSubPestana('reviews')}
                      >
                        <Star size={15} /> Reseñas ({reviews.length})
                      </button>
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'precios' ? 'active' : ''}`}
                        onClick={() => setSubPestana('precios')}
                      >
                        <Store size={15} /> Todas las Tiendas ({preciosFiltrados.length})
                      </button>
                    </div>

                    <div className="knasta-folder-panel">
                      {/* PESTAÑA 1 (sin datos): no se inventa historial */}
                      {subPestana === 'historial' && !hayHistorialReal && (
                        <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--m3-text-secondary)' }}>
                          <TrendingUp size={28} style={{ color: 'var(--m3-text-tertiary)', marginBottom: '8px' }} />
                          <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                            Todavía no hay historial de precios para este perfume
                          </p>
                          <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', lineHeight: 1.5 }}>
                            PerfumeScan solo muestra el historial cuando ha registrado el precio en distintas fechas.
                            Usa “Buscar en las 4 tiendas en vivo” para registrar el precio de hoy.
                          </p>
                          <button
                            type="button"
                            className="m3-btn m3-btn-tonal"
                            onClick={() => buscarPorNombre(ficha ? `${ficha.marca} ${ficha.nombre}` : textoBusqueda)}
                          >
                            <Search size={13} /> Buscar en las 4 tiendas en vivo
                          </button>
                        </div>
                      )}

                      {/* PESTAÑA 1: HISTORIAL REAL + ANÁLISIS DEL PRECIO LADO A LADO */}
                      {subPestana === 'historial' && hayHistorialReal && (
                        <div className="knasta-history-split">
                          {/* Gráfico de Área Izquierdo */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '12px' }}>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>Fecha</div>
                                <strong style={{ fontSize: '14px', color: 'var(--m3-text-primary)' }}>{historialProducto[historialProducto.length - 1]?.fecha || '—'}</strong>
                              </div>
                              <div style={{ width: '1px', height: '28px', background: 'var(--m3-outline-variant)' }} />
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>Precio</div>
                                <strong style={{ fontSize: '14px', color: 'var(--m3-text-primary)' }}>
                                  $ {precioActual.toLocaleString('es-CL')}
                                </strong>
                              </div>
                            </div>

                            <div style={{ width: '100%', overflowX: 'auto' }}>
                              <svg
                                viewBox={`0 0 ${svgW} ${svgH}`}
                                style={{ width: '100%', height: 'auto', minHeight: '200px', display: 'block' }}
                              >
                                <defs>
                                  <linearGradient id="knastaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.42" />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
                                  </linearGradient>
                                </defs>

                                {[0, 0.25, 0.5, 0.75, 1].map((step, idx) => {
                                  const y = padT + step * (svgH - padT - padB);
                                  const val = Math.round(maxY * (1 - step) / 1000) * 1000;
                                  return (
                                    <g key={idx}>
                                      <line
                                        x1={padL}
                                        y1={y}
                                        x2={svgW - padR}
                                        y2={y}
                                        stroke="rgba(148, 163, 184, 0.16)"
                                        strokeWidth="1"
                                      />
                                      <text
                                        x={padL - 8}
                                        y={y + 4}
                                        textAnchor="end"
                                        fontSize="10"
                                        fill="#94a3b8"
                                      >
                                        ${val.toLocaleString('es-CL')}
                                      </text>
                                    </g>
                                  );
                                })}

                                {areaPath && <path d={areaPath} fill="url(#knastaAreaGrad)" />}
                                {polylinePoints && (
                                  <polyline
                                    fill="none"
                                    stroke="#60a5fa"
                                    strokeWidth="2.4"
                                    points={polylinePoints}
                                  />
                                )}

                                {coords.map((c, idx) => (
                                  <g key={idx}>
                                    <circle
                                      cx={c.x}
                                      cy={c.y}
                                      r={idx === coords.length - 1 ? 4.5 : 3}
                                      fill={idx === coords.length - 1 ? '#84cc16' : '#60a5fa'}
                                    />
                                    <text
                                      x={c.x}
                                      y={svgH - 8}
                                      textAnchor="middle"
                                      fontSize="10"
                                      fill="#94a3b8"
                                    >
                                      {c.fecha.slice(-5)}
                                    </text>
                                  </g>
                                ))}
                              </svg>
                            </div>
                          </div>

                          {/* Columna Derecha: Análisis del precio */}
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                              <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                                Análisis del precio
                              </h4>
                              <div className="knasta-good-moment-box">
                                <div style={{ fontSize: '12px', fontWeight: 800, color: precioActual <= precioHabitual ? '#84cc16' : '#f59e0b', marginBottom: '4px' }}>
                                  {precioActual <= precioHabitual ? '🕒 Bajo su precio promedio registrado' : '🕒 Sobre su precio promedio registrado'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                  <strong style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--m3-text-primary)' }}>
                                    $ {precioActual.toLocaleString('es-CL')}
                                  </strong>
                                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#84cc16' }}>
                                    Ahorro real: $ {ahorroReal.toLocaleString('es-CL')}
                                  </span>
                                </div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--m3-text-secondary)', lineHeight: 1.45 }}>
                                  Está <strong>{pctBajoMax}% bajo su precio máximo</strong> según los {historialProducto.length} registros guardados de este producto en {ofertaActiva?.tienda}.
                                </p>

                                <div
                                  style={{
                                    borderTop: '1px solid rgba(132, 204, 22, 0.28)',
                                    paddingTop: '10px',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '10px',
                                    fontSize: '11.5px',
                                  }}
                                >
                                  <div>
                                    <div style={{ color: 'var(--m3-text-tertiary)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                      PRECIO HABITUAL
                                    </div>
                                    <strong style={{ color: 'var(--m3-text-primary)', fontSize: '13px' }}>
                                      $ {precioHabitual.toLocaleString('es-CL')}
                                    </strong>
                                    <div style={{ color: 'var(--m3-text-tertiary)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginTop: '8px' }}>
                                      MEJOR PRECIO
                                    </div>
                                    <strong style={{ color: 'var(--m3-text-primary)', fontSize: '13px' }}>
                                      $ {precioMinHist.toLocaleString('es-CL')}
                                    </strong>
                                  </div>
                                  <div>
                                    <div style={{ color: 'var(--m3-text-tertiary)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                      ¿ESTUVO MÁS BARATO ANTES?
                                    </div>
                                    <strong style={{ color: 'var(--m3-text-primary)', fontSize: '12.5px' }}>
                                      {precioActual <= precioMinHist ? 'No, nunca' : `Sí ($${precioMinHist.toLocaleString('es-CL')})`}
                                    </strong>
                                    <div style={{ color: 'var(--m3-text-tertiary)', fontSize: '10.5px', marginTop: '2px' }}>
                                      en el período que revisamos
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <a
                              href={ofertaActiva?.url || `https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(ficha?.nombre || textoBusqueda)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="knasta-cta-green"
                              style={{ padding: '11px 16px', fontSize: '13px', textDecoration: 'none' }}
                            >
                              Visitar {tiendaCorta} <ExternalLink size={14} />
                            </a>
                          </div>
                        </div>
                      )}

                      {/* PESTAÑA 2: CARACTERÍSTICAS & RADAR 6D */}
                      {subPestana === 'ficha' && ficha && (
                        <FichaFraganciaCard
                          ficha={ficha}
                          alergiasIds={alergiasUsuario}
                          notasCustom={notasAlergiaCustom}
                          onAbrirAlergias={() => setMostrarModalAlergias(true)}
                          onVerSimilares={() => {
                            const el = document.getElementById('seccion-relacionados-knasta');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          onGuardarFicha={() => {
                            guardarEnListaCompras({
                              perfume: ficha.nombre,
                              marca: ficha.marca,
                              tienda: ofertaActiva?.tienda || 'Por definir',
                              precioGuardado: precioActual,
                              ml: extraerMl(ofertaActiva?.nombre || '') || 100,
                              url: ofertaActiva?.url || '',
                              imagen: imgHero,
                              categoria: 'favorito',
                              notaPersonal: `${ficha.familia_olfativa} · ~${ficha.duracion_horas}h`,
                            });
                          }}
                        />
                      )}

                      {/* PESTAÑA 3: GUÍA DE USO & ML */}
                      {subPestana === 'guia' && ficha && <GuiaAplicacionCard ficha={ficha} />}

                      {/* PESTAÑA 4: SUCURSALES GPS */}
                      {subPestana === 'tiendas' && <SucursalesCard sucursales={sucursales} />}

                      {/* PESTAÑA 5: RESEÑAS */}
                      {subPestana === 'reviews' && (
                        <ReviewsSection
                          perfumeNombre={ofertaActiva?.nombre || ficha?.nombre || textoBusqueda}
                          reviewsIniciales={reviews}
                        />
                      )}

                      {/* PESTAÑA 6: TODAS LAS OFERTAS EN TIENDAS */}
                      {subPestana === 'precios' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--m3-text-secondary)' }}>
                              Mostrando <strong>{preciosFiltrados.length}</strong> ofertas para <strong>"{ficha?.nombre || textoBusqueda}"</strong>
                            </p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <select
                                value={filtroTienda}
                                onChange={e => setFiltroTienda(e.target.value as any)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--m3-outline-variant)',
                                  background: 'var(--m3-surface-container-lowest)',
                                  color: 'var(--m3-text-primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <option value="todas">Tienda: Todas</option>
                                <option value="Falabella">Falabella</option>
                                <option value="DBS Beauty Store">DBS Beauty Store</option>
                                <option value="Alisha Perfumes">Alisha Perfumes</option>
                                <option value="Farmacias Ahumada">Farmacias Ahumada</option>
                              </select>
                              <select
                                value={filtroPrecio}
                                onChange={e => setFiltroPrecio(e.target.value as any)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--m3-outline-variant)',
                                  background: 'var(--m3-surface-container-lowest)',
                                  color: 'var(--m3-text-primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <option value="todos">Precio: Todos</option>
                                <option value="economico">{'< $45.000'}</option>
                                <option value="medio">$45.000 - $85.000</option>
                                <option value="premium">{'> $85.000'}</option>
                              </select>
                              <select
                                value={filtroGenero}
                                onChange={e => setFiltroGenero(e.target.value as any)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--m3-outline-variant)',
                                  background: 'var(--m3-surface-container-lowest)',
                                  color: 'var(--m3-text-primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <option value="todos">Género: Todos</option>
                                <option value="hombre">Masculino</option>
                                <option value="mujer">Femenino</option>
                                <option value="unisex">Unisex</option>
                              </select>
                              <select
                                value={ordenPrecios}
                                onChange={e => setOrdenPrecios(e.target.value as 'asc' | 'desc')}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--m3-outline-variant)',
                                  background: 'var(--m3-surface-container-lowest)',
                                  color: 'var(--m3-text-primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <option value="asc">Menor Precio</option>
                                <option value="desc">Mayor Precio</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => window.print()}
                                className="m3-btn m3-btn-tonal"
                                style={{ fontSize: '12px', padding: '7px 12px' }}
                              >
                                <Printer size={13} /> PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => buscarPorNombre(ficha ? `${ficha.marca} ${ficha.nombre}` : textoBusqueda)}
                                className="m3-btn m3-btn-primary"
                                style={{ fontSize: '12px', padding: '7px 14px' }}
                              >
                                <Search size={13} /> Escanear las 4 tiendas en vivo
                              </button>
                            </div>
                          </div>
                          <div className="precios-grid">
                            {preciosFiltrados.map((item, idx) => {
                              const yaGuardado = listaCompras.some(
                                l => l.perfume.toLowerCase() === item.nombre.toLowerCase() && l.tienda === item.tienda
                              );
                              return (
                                <TarjetaPrecio
                                  key={idx}
                                  item={item}
                                  esMenor={item.precio === precioMinimo}
                                  esSeleccionado={idx === prodActivoIdx}
                                  enListaCompras={yaGuardado}
                                  onSeleccionar={() => setProdActivoIdx(idx)}
                                  onGuardarLista={() =>
                                    guardarEnListaCompras({
                                      perfume: item.nombre,
                                      marca: ficha?.marca,
                                      tienda: item.tienda,
                                      precioGuardado: item.precio,
                                      ml: extraerMl(item.nombre),
                                      url: item.url,
                                      imagen: normalizarImagen(item.imagen),
                                      categoria: 'comprar',
                                      notaPersonal: '',
                                    })
                                  }
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Bloque de Descripción y Notas Olfativas (Siempre visible debajo del gráfico, como en Screenshot 3) */}
                  {ficha && (
                    <div
                      style={{
                        background: 'var(--m3-surface-container-low)',
                        border: '1px solid var(--m3-outline-variant)',
                        borderRadius: '14px',
                        padding: '20px 22px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                          {ficha.marca} {ficha.nombre} ({ficha.concentracion})
                        </h3>
                        {subPestana !== 'ficha' && (
                          <button
                            type="button"
                            onClick={() => setSubPestana('ficha')}
                            className="m3-btn m3-btn-tonal"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            <Activity size={13} /> Ver Radar 6D y Pirámide Completa
                          </button>
                        )}
                      </div>

                      <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: 'var(--m3-text-secondary)', lineHeight: 1.6 }}>
                        {ficha.descripcion}
                      </p>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[...(ficha.notas_salida || []), ...(ficha.notas_corazon || []), ...(ficha.notas_fondo || [])]
                          .slice(0, 6)
                          .map((nota, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '11.5px',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: 'var(--m3-surface-container)',
                                color: 'var(--m3-text-primary)',
                                fontWeight: 600,
                              }}
                            >
                              ✦ {nota}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Barra "Prueba buscando otros productos en:" (Como en Screenshot 3) */}
                  {ficha && (
                    <div
                      style={{
                        background: 'var(--m3-surface-container-low)',
                        border: '1px solid var(--m3-outline-variant)',
                        borderRadius: '12px',
                        padding: '12px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        fontSize: '12.5px',
                      }}
                    >
                      <strong style={{ color: 'var(--m3-text-primary)' }}>Prueba buscando otros perfumes en:</strong>
                      <button
                        type="button"
                        onClick={resetResultados}
                        className="m3-chip"
                        style={{ padding: '4px 10px', fontSize: '11.5px', color: '#60a5fa' }}
                      >
                        {ficha.marca}
                      </button>
                      <button
                        type="button"
                        onClick={resetResultados}
                        className="m3-chip"
                        style={{ padding: '4px 10px', fontSize: '11.5px', color: '#60a5fa' }}
                      >
                        {ficha.familia_olfativa}
                      </button>
                      {(ficha.acordes_principales || []).slice(0, 2).map(ac => (
                        <button
                          key={ac}
                          type="button"
                          onClick={resetResultados}
                          className="m3-chip"
                          style={{ padding: '4px 10px', fontSize: '11.5px', color: '#60a5fa' }}
                        >
                          {ac}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 6. Grilla Inferior "Productos relacionados" Estilo Knasta (Screenshot 3) */}
                  {relacionadosCatalogo.length > 0 && (
                    <div
                      id="seccion-relacionados-knasta"
                      style={{
                        background: 'var(--m3-surface-container-low)',
                        border: '1px solid var(--m3-outline-variant)',
                        borderRadius: '14px',
                        padding: '20px 22px',
                      }}
                    >
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                        Productos relacionados
                      </h3>
                      <div className="knasta-related-grid">
                        {relacionadosCatalogo.map(({ c: rel, motivos }) => {
                          const tiendaRel = (rel.tiendaMejorPrecio || 'Falabella')
                            .replace(' Beauty Store', '')
                            .replace(' Perfumes', '')
                            .replace('Farmacias ', '');
                          return (
                            <article
                              key={rel.id}
                              className="knasta-card"
                              onClick={() => inspeccionarPerfumeDelCatalogo(rel, catalogoEnMemoria)}
                              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                            >
                              <div className="knasta-img-stage" style={{ height: '165px', padding: '12px' }}>
                                <span className="knasta-store-pill" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                                  {tiendaRel}
                                </span>
                                {rel.imagen ? (
                                  <img
                                    src={rel.imagen}
                                    alt={rel.nombre}
                                    style={{ maxWidth: '100%', maxHeight: '130px', objectFit: 'contain' }}
                                    loading="lazy"
                                  />
                                ) : (
                                  <BottlePlaceholder size={68} />
                                )}
                              </div>
                              <div className="knasta-card-body" style={{ padding: '10px 12px' }}>
                                <div>
                                  <span className="knasta-brand-text" style={{ fontSize: '10.5px' }}>{rel.marca}</span>
                                  <h4 className="knasta-product-title" style={{ fontSize: '12.5px' }}>{rel.nombre}</h4>
                                </div>
                                <div>
                                  <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--m3-text-primary)', marginTop: '4px' }}>
                                    $ {rel.precioReferencia.toLocaleString('es-CL')}
                                  </strong>
                                  <div style={{ fontSize: '10.5px', color: 'var(--m3-text-secondary)', marginTop: '2px' }}>
                                    {motivos.join(' · ')}
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── ESTADO INICIAL HERO: ASISTENTE SOMMELIER + CATÁLOGO CURADO (siempre montado para conservar página y filtros) ── */}
            <div style={{ marginTop: '24px', display: !precios && !cargando ? 'block' : 'none' }}>
                <QuizDescubridor
                  alergiasUsuario={alergiasUsuario}
                  notasPersonalizadas={notasAlergiaCustom}
                  onBuscar={(nombre) => buscarPorNombre(nombre)}
                  onGuardarEnLista={(nombre, marca, precio, imagen) =>
                    guardarEnListaCompras({
                      perfume: nombre,
                      marca,
                      tienda: 'Referencia Chile',
                      precioGuardado: precio,
                      ml: 100,
                      url: '',
                      imagen: imagen || null,
                      categoria: 'comprar',
                      notaPersonal: 'Seleccionado desde el Sommelier Olfativo',
                    })
                  }
                />

                {/* 1. Búsquedas Recientes */}
                {busquedasRecientes.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} /> Búsquedas Recientes
                      </span>
                      <button
                        onClick={borrarRecientes}
                        style={{ border: 'none', background: 'transparent', color: 'var(--m3-text-tertiary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Limpiar historial
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {busquedasRecientes.map(q => (
                        <button
                          key={q}
                          onClick={() => buscarPorNombre(q)}
                          className="m3-chip"
                        >
                          <Search size={12} /> {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Explorador de Catálogo con Sidebar de Filtros, Paginación 30 en 30 e Inspector Instantáneo */}
                <CatalogoFiltrosSidebar
                  alergiasUsuario={alergiasUsuario}
                  notasPersonalizadas={notasAlergiaCustom}
                  listaGuardadosNombres={listaCompras.map(i => i.perfume)}
                  onCotizarEnVivo={(nombre) => buscarPorNombre(nombre)}
                  onInspeccionarPerfume={inspeccionarPerfumeDelCatalogo}
                  onCatalogoActualizado={setCatalogoEnMemoria}
                  onGuardarEnLista={(item) =>
                    guardarEnListaCompras({
                      perfume: item.nombre,
                      marca: item.marca,
                      tienda: 'Catálogo Chile',
                      precioGuardado: item.precioReferencia,
                      ml: item.ml,
                      url: '',
                      imagen: item.imagen,
                      categoria: 'comprar',
                      notaPersonal: `${item.familia} · ${item.concentracion}`,
                    })
                  }
                  onComparar={(nombre) => {
                    setCompP1(nombre);
                    if (!compP2 || compP2.toLowerCase() === nombre.toLowerCase()) {
                      setCompP2(nombre.toLowerCase().includes('sauvage') ? 'Bleu de Chanel' : 'Sauvage Dior');
                    }
                    setVistaPrincipal('comparar');
                  }}
                />
            </div>
          </div>
        )}

        {/* VISTA 2: COMPARADOR FRENTE A FRENTE */}
        {vistaPrincipal === 'comparar' && (
          <ComparadorLadoALado
            p1Inicial={compP1}
            p2Inicial={compP2}
            alergiasIds={alergiasUsuario}
            notasCustom={notasAlergiaCustom}
            listaCompras={listaCompras}
            onAbrirAlergias={() => setMostrarModalAlergias(true)}
            onGuardarEnLista={guardarEnListaCompras}
            onExplorarPerfume={(nombre) => buscarPorNombre(nombre)}
            onRegistrarLogCliente={registrarLogCliente}
          />
        )}
      </main>

      {/* Modal Informativo: Rango y Cobertura de Búsqueda */}
      <ModalRangoBusqueda
        abierto={mostrarModalRango}
        alCerrar={() => setMostrarModalRango(false)}
      />

      {/* Modal Semana 5: Perfil de Alergias e Intolerancias IFRA */}
      <ModalPerfilAlergias
        abierto={mostrarModalAlergias}
        alCerrar={() => setMostrarModalAlergias(false)}
        alergiasSeleccionadas={alergiasUsuario}
        onToggleAlergia={toggleAlergiaId}
        notasPersonalizadas={notasAlergiaCustom}
        onAgregarNotaPersonalizada={agregarNotaAlergiaCustom}
        onEliminarNotaPersonalizada={eliminarNotaAlergiaCustom}
        onLimpiarTodo={() => {
          setAlergiasUsuario([]);
          setNotasAlergiaCustom([]);
          try {
            localStorage.removeItem('perfumescan_alergias_ids');
            localStorage.removeItem('perfumescan_alergias_custom');
          } catch {}
        }}
      />

      {/* Modal Semana 5: Lista de Compras y Favoritos */}
      <ModalListaCompras
        abierto={mostrarModalLista}
        alCerrar={() => setMostrarModalLista(false)}
        items={listaCompras}
        onEliminar={eliminarDeListaCompras}
        onCambiarCategoria={cambiarCategoriaLista}
        onCambiarNota={cambiarNotaLista}
        onBuscarEnVivo={(nombre) => buscarPorNombre(nombre)}
        onCompararDos={(p1, p2) => {
          setCompP1(p1);
          setCompP2(p2);
          setVistaPrincipal('comparar');
        }}
        onVaciarLista={() => {
          setListaCompras([]);
          try { localStorage.removeItem('perfumescan_lista_compras'); } catch {}
        }}
      />

      {/* Modal Semana 5: Consola de Logs y Telemetría */}
      <ConsolaLogsModal
        abierto={mostrarModalLogs}
        alCerrar={() => setMostrarModalLogs(false)}
        apiBase={API_BASE}
        logsCliente={logsCliente}
        onLimpiarLogsCliente={() => setLogsCliente([])}
      />

      {/* Toast Flotante de Confirmación */}
      {toastMensaje && (
        <div className="m3-toast">
          <Check size={16} style={{ color: '#4ade80' }} />
          <span>{toastMensaje}</span>
        </div>
      )}
    </div>
  );
}
