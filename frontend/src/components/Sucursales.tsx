// Pestaña "Dónde conseguirlo": una tarjeta por tienda que lo vende, el mapa y los locales con horario.
import { useState } from 'react';
import { MapPin, ExternalLink, Navigation, Clock, Phone } from 'lucide-react';
import { abiertoAhora } from '../horarios';
import { MapaSucursales } from './MapaSucursales';
import { t } from '../i18n.ts';
import { type PrecioMercado, type Sucursal } from '../tipos.ts';
import { calcularDistanciaKm } from '../ofertas.ts';

const MAX_SUCURSALES_VISIBLES = 12;

// ─────────────────────────────────────────────
//  Componente: Sucursales Físicas y GPS (M3)
// ─────────────────────────────────────────────
// Color de cada cadena en el mapa y en las tarjetas
const COLOR_CADENA: Record<string, string> = {
  Falabella: '#3f6b4a',
  'DBS Beauty Store': '#9c2b1b',
  'Alisha Perfumes': '#c77d1f',
  'Farmacias Ahumada': '#2f5d8a',
};

// Sucursales, empezando por dónde conseguir este perfume cerca. Antes se listaban los locales más cercanos de todas
// las cadenas: 229 de 237 son de Ahumada, que muchas veces no vende el perfume buscado.
export function SucursalesCard({ sucursales, ofertas }: { sucursales: Sucursal[]; ofertas: PrecioMercado[] }) {
  const [comunaFiltro, setComunaFiltro] = useState<string>('todas');
  const [coordsUsuario, setCoordsUsuario] = useState<{ lat: number; lng: number } | null>(null);
  const [estadoGPS, setEstadoGPS] = useState<'inactivo' | 'cargando' | 'ok' | 'error'>('inactivo');
  const [soloQueLoVenden, setSoloQueLoVenden] = useState(true);

  const activarGPS = () => {
    if (!navigator.geolocation) {
      setEstadoGPS('error');
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

  // La oferta más barata con stock de cada cadena que vende el perfume
  const venden = new Map<string, PrecioMercado>();
  for (const o of ofertas) {
    if (o.stock === 'Agotado' || !o.precio) continue;
    const previa = venden.get(o.tienda);
    if (!previa || o.precio < (previa.precio ?? Infinity)) venden.set(o.tienda, o);
  }
  const filtrarPorCadena = soloQueLoVenden && venden.size > 0;

  const conDistancia = sucursales.map(s => ({
    ...s,
    distancia: coordsUsuario && s.lat && s.lng ? calcularDistanciaKm(coordsUsuario.lat, coordsUsuario.lng, s.lat, s.lng) : Infinity,
  }));
  const deCadenas = filtrarPorCadena ? conDistancia.filter(s => venden.has(s.tienda)) : conDistancia;
  const comunas = ['todas', ...Array.from(new Set(deCadenas.map(s => s.comuna))).sort((a, b) => a.localeCompare(b, 'es'))];
  const filtradas = (comunaFiltro === 'todas' ? deCadenas : deCadenas.filter(s => s.comuna === comunaFiltro))
    .sort((a, b) => a.distancia - b.distancia);
  const visibles = filtradas.slice(0, MAX_SUCURSALES_VISIBLES);

  // Resumen: el local más cercano de cada cadena que lo vende (o "solo en línea" si no hay locales registrados)
  const resumen = [...venden.entries()]
    .map(([tienda, oferta]) => ({ tienda, oferta, local: conDistancia.filter(s => s.tienda === tienda).sort((a, b) => a.distancia - b.distancia)[0] }))
    .sort((a, b) => (a.local?.distancia ?? Infinity) - (b.local?.distancia ?? Infinity) || (a.oferta.precio ?? 0) - (b.oferta.precio ?? 0));

  const puntos = visibles
    .filter(s => s.lat && s.lng)
    .map(s => ({
      lat: s.lat!,
      lng: s.lng!,
      titulo: s.nombre,
      detalle: `${s.direccion} (${s.comuna}) · ${s.horario}${venden.get(s.tienda)?.precio ? ` · ${t('desde ${precio}', { precio: venden.get(s.tienda)!.precio!.toLocaleString('es-CL') })}` : ''}`,
      color: COLOR_CADENA[s.tienda] || '#6b5637',
    }));

  // Solo con el horario que publica la tienda: con uno referencial no se afirma si está abierto
  const EstadoAbierto = ({ horario, fuente }: { horario: string; fuente?: Sucursal['fuente'] }) => {
    if (fuente !== 'scraping') {
      return <span style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>{t('Horario referencial')}</span>;
    }
    const abierto = abiertoAhora(horario);
    if (abierto === null) return null;
    return (
      <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: abierto ? 'var(--m3-success-container)' : 'var(--m3-surface-container-high)', color: abierto ? 'var(--m3-success)' : 'var(--m3-text-secondary)' }}>
        {abierto ? t('Abierto ahora') : t('Cerrado ahora')}
      </span>
    );
  };

  return (
    <div style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-xl)', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--m3-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} style={{ color: 'var(--m3-primary)' }} /> {t('Dónde conseguirlo cerca')}
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
            {venden.size > 0
              ? t('Lo venden hoy {tiendas}. Las tiendas no publican el stock de cada local: confírmalo antes de ir.', { tiendas: [...venden.keys()].join(', ') })
              : t('Ninguna tienda lo tiene con stock hoy: se muestran todos los locales.')}
          </span>
        </div>
        <button onClick={activarGPS} className="m3-btn m3-btn-tonal" style={{ fontSize: '12px', padding: '8px 14px' }}>
          <Navigation size={14} /> {estadoGPS === 'cargando' ? t('Buscando tu ubicación...') : estadoGPS === 'ok' ? t('Ordenado por cercanía') : t('Usar mi ubicación')}
        </button>
      </div>
      {estadoGPS === 'error' && (
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--m3-error)' }}>
          {t('No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador o elige una comuna.')}
        </p>
      )}

      {/* Lo más cercano de cada cadena que lo vende */}
      {resumen.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
          {resumen.map(({ tienda, oferta, local }) => (
            <div key={tienda} style={{ border: '1px solid var(--m3-outline)', borderLeft: `5px solid ${COLOR_CADENA[tienda] || '#6b5637'}`, borderRadius: '0', padding: '12px 14px', background: 'var(--m3-surface-container-low)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                <strong style={{ fontSize: '13.5px', color: 'var(--m3-text-primary)' }}>{tienda}</strong>
                <strong style={{ fontSize: '15px', color: 'var(--m3-primary)' }}>${oferta.precio!.toLocaleString('es-CL')}</strong>
              </div>
              {local ? (
                <>
                  <span style={{ fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>
                    {local.nombre}
                    {local.distancia !== Infinity ? ` · ${t('a {km} km', { km: local.distancia.toFixed(1) })}` : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                    <EstadoAbierto horario={local.horario} fuente={local.fuente} />
                    {local.lat && local.lng && (
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${local.lat},${local.lng}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--m3-primary)' }}>
                        {t('Cómo llegar')}
                      </a>
                    )}
                    {oferta.url && (
                      <a href={oferta.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--m3-text-secondary)' }}>
                        {t('Comprar en línea')}
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <span style={{ fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>
                  {t('Sin locales registrados:')} {oferta.url ? <a href={oferta.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: 'var(--m3-primary)' }}>{t('comprar en línea')}</a> : t('solo en línea')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {puntos.length > 0 && <MapaSucursales puntos={puntos} usuario={coordsUsuario} />}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {venden.size > 0 && (
          <label style={{ fontSize: '12.5px', color: 'var(--m3-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloQueLoVenden} onChange={e => setSoloQueLoVenden(e.target.checked)} />
            {t('Solo locales de tiendas que lo venden')}
          </label>
        )}
        <select
          value={comunaFiltro}
          onChange={e => setComunaFiltro(e.target.value)}
          aria-label={t('Filtrar por comuna')}
          style={{ fontSize: '12px', padding: '7px 12px', borderRadius: '10px', border: '1px solid var(--m3-outline)', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}
        >
          {comunas.map(c => <option key={c} value={c}>{c === 'todas' ? t('Todas las comunas') : c}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {visibles.map((s, idx) => (
          <div key={idx} style={{ background: 'var(--m3-surface-container-low)', padding: '14px 16px', borderRadius: 'var(--m3-shape-md)', border: '1px solid var(--m3-outline-variant)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span aria-hidden="true" style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLOR_CADENA[s.tienda] || '#6b5637', display: 'inline-block' }} />
                {s.nombre}
              </p>
              <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                <EstadoAbierto horario={s.horario} fuente={s.fuente} />
                {s.distancia !== Infinity && (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', background: 'var(--m3-surface-container-high)', color: 'var(--m3-text-primary)' }}>
                    {s.distancia.toFixed(1)} km
                  </span>
                )}
              </span>
            </div>
            <p style={{ margin: '0 0 6px 0', fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>{s.direccion} ({s.comuna})</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--m3-text-tertiary)', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {s.horario}
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: s.fuente === 'scraping' ? 'var(--m3-success)' : 'var(--m3-text-tertiary)' }}>
                  ({s.fuente === 'scraping' ? t('publicado por la tienda') : t('referencial')})
                </span>
              </span>
              {/* Solo el teléfono que publica la tienda: los de los horarios referenciales no están verificados */}
              {s.fuente === 'scraping' && s.telefono && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {s.telefono}</span>
              )}
            </div>
            {s.lat && s.lng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11.5px', color: 'var(--m3-primary)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}
              >
                {t('Cómo llegar en Google Maps')} <ExternalLink size={12} />
              </a>
            )}
          </div>
        ))}
        {filtradas.length > visibles.length && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)', textAlign: 'center' }}>
            {t('Mostrando {a} de {b} locales. Usa tu ubicación o elige una comuna para ver los más cercanos.', { a: visibles.length, b: filtradas.length })}
          </p>
        )}
      </div>
    </div>
  );
}
