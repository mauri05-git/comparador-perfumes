// Ventana "Cobertura": de dónde salen los datos y qué cubre la búsqueda.
import { ShieldCheck, Store, MapPin, Droplets, Compass, X } from 'lucide-react';
import { t } from '../i18n.ts';

// ─────────────────────────────────────────────
//  Componente: Modal de Rango y Alcance de Búsqueda (M3)
// ─────────────────────────────────────────────
export function ModalRangoBusqueda({
  abierto,
  alCerrar,
}: {
  abierto: boolean;
  alCerrar: () => void;
}) {
  if (!abierto) return null;

  return (
    <div className="m3-modal-backdrop" onClick={alCerrar}>
      <div className="m3-modal-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Compass size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
                {t('Alcance y cobertura en Chile')}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {t('De dónde salen los datos y qué cubre la búsqueda')}
              </span>
            </div>
          </div>
          <button onClick={alCerrar} className="m3-search-clear" title={t('Cerrar')}>
            <X size={20} />
          </button>
        </div>

        <div className="m3-modal-body">
          <div className="m3-range-grid">
            <div className="m3-range-item">
              <Store size={20} style={{ color: 'var(--m3-primary)' }} />
              <strong style={{ display: 'block', margin: '6px 0 3px 0', fontSize: '13px' }}>{t('4 tiendas consultadas en vivo')}</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {t('Falabella, DBS Beauty Store, Alisha Perfumes y Farmacias Ahumada, al mismo tiempo: cada tienda aparece apenas responde.')}
              </p>
            </div>

            <div className="m3-range-item">
              <MapPin size={20} style={{ color: 'var(--m3-primary)' }} />
              <strong style={{ display: 'block', margin: '6px 0 3px 0', fontSize: '13px' }}>{t('261 locales con ubicación')}</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {t('229 de Farmacias Ahumada, 23 de DBS, 5 de Alisha y 4 de Falabella, en la Región Metropolitana. La distancia se calcula con la fórmula de Haversine.')}
              </p>
            </div>

            <div className="m3-range-item">
              <ShieldCheck size={20} style={{ color: '#16a34a' }} />
              <strong style={{ display: 'block', margin: '6px 0 3px 0', fontSize: '13px' }}>{t('Alérgenos según la norma europea')}</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {t('Los 26 alérgenos que el fabricante debe declarar en el envase. Con la lista de ingredientes son los declarados; sin ella, el resultado es "Sin verificar".')}
              </p>
            </div>

            <div className="m3-range-item">
              <Droplets size={20} style={{ color: '#0284c7' }} />
              <strong style={{ display: 'block', margin: '6px 0 3px 0', fontSize: '13px' }}>{t('Precio por mililitro')}</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {t('El tamaño sale del nombre de la oferta o de la tienda, y con él el precio por ml para comparar frascos distintos.')}
              </p>
            </div>
          </div>
        </div>

        <div className="m3-modal-footer">
          <button onClick={alCerrar} className="m3-btn m3-btn-primary">
            {t('Entendido')}
          </button>
        </div>
      </div>
    </div>
  );
}
