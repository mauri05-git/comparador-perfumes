// Tarjeta de una oferta (tienda, tamaño, precio y stock) y el frasco de reemplazo cuando no hay foto.
import { Store, Droplets, Heart, ExternalLink, Check, Award } from 'lucide-react';
import { t } from '../i18n.ts';
import { type PrecioMercado } from '../tipos.ts';
import { calcularPrecioPorMl, extraerMl, haceCuanto, normalizarImagen } from '../ofertas.ts';

const ESTILO_TIENDA: Record<string, { color: string; bg: string }> = {
  "Falabella":          { color: "#15803d", bg: "rgba(22, 163, 74, 0.12)" },
  "DBS Beauty Store":   { color: "#be185d", bg: "rgba(219, 39, 119, 0.12)" },
  "Alisha Perfumes":    { color: "#b45309", bg: "rgba(217, 119, 6, 0.12)" },
  "Farmacias Ahumada":  { color: "#0369a1", bg: "rgba(2, 132, 199, 0.12)" },
};

export function BottlePlaceholder({ size = 96 }: { size?: number }) {
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
export function TarjetaPrecio({
  item,
  esMenor = false,
  esSeleccionado = false,
  enListaCompras = false,
  onSeleccionar,
  onGuardarLista,
  precioAnterior,
}: {
  item: PrecioMercado;
  esMenor?: boolean;
  esSeleccionado?: boolean;
  enListaCompras?: boolean;
  precioAnterior?: number;
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
              <Award size={11} /> {t('Mejor Precio')}
            </span>
          )}
          {onGuardarLista && (
            <button
              type="button"
              onClick={onGuardarLista}
              title={enListaCompras ? t('Guardado en tus Favoritos') : t('Guardar en Favoritos')}
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
              {enListaCompras ? t('Guardado') : t('Guardar')}
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
            {item.precio !== null ? `$${item.precio.toLocaleString('es-CL')}` : t('Consultar')}
          </span>
          {item.sinConfirmarDesde ? (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--m3-text-tertiary)' }} title={t('Las tiendas no respondieron: es el precio de la búsqueda anterior y puede haber cambiado')}>
              ⚠ {t('Precio de {cuando}', { cuando: haceCuanto(item.sinConfirmarDesde) })}
            </span>
          ) : item.deMemoria ? (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--m3-text-tertiary)' }} title={t('Precio de la búsqueda anterior: se está consultando la tienda')}>
              ↻ {t('Verificando...')}
            </span>
          ) : (
            <span style={{ fontSize: '11px', fontWeight: 700, color: item.stock === 'En Stock' ? '#16a34a' : item.stock === 'Agotado' ? '#dc2626' : '#94a3b8' }}>
              ● {t(item.stock)}
            </span>
          )}
        </div>
        {precioAnterior !== undefined && item.precio !== null && precioAnterior !== item.precio && (
          <div style={{ fontSize: '11.5px', fontWeight: 800, marginTop: '-8px', marginBottom: '10px', color: item.precio < precioAnterior ? 'var(--m3-success)' : 'var(--m3-error)' }}>
            {t(item.precio < precioAnterior ? '↓ Bajó ${dif} · antes ${antes}' : '↑ Subió ${dif} · antes ${antes}', { dif: Math.abs(precioAnterior - item.precio).toLocaleString('es-CL'), antes: precioAnterior.toLocaleString('es-CL') })}
          </div>
        )}

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
              {esSeleccionado ? <><Check size={13} /> {t('Activo')}</> : t('Seleccionar')}
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
              {t('Tienda')} <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
