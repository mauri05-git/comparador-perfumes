import React, { useEffect, useState } from 'react';
import { Heart, Plus, Check, X, Trash2 } from 'lucide-react';
import type { ListaPropia } from './ListaComprasDrawer';
import { t } from '../i18n.ts';

// Menú que se abre junto al corazón: el perfume ya quedó en Favoritos ("me gusta") y aquí se elige, si se quiere,
// en qué listas propias va, o se quita.
export const MenuGuardado: React.FC<{
  x: number;
  y: number;
  perfume: string;
  recienGuardado: boolean;
  listas: ListaPropia[];
  enListas: string[];
  onAlternarLista: (listaId: string) => void;
  onCrearLista: (nombre: string) => string | null; // id de la lista nueva
  onQuitar: () => void;
  onCerrar: () => void;
}> = ({ x, y, perfume, recienGuardado, listas, enListas, onAlternarLista, onCrearLista, onQuitar, onCerrar }) => {
  const [nombreNueva, setNombreNueva] = useState<string | null>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  // Dentro de la pantalla aunque el corazón esté en un borde
  const ancho = 270;
  const izquierda = Math.max(12, Math.min(x - ancho / 2, window.innerWidth - ancho - 12));
  const arriba = Math.min(y + 14, window.innerHeight - 260);

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombreNueva === null) return;
    const id = onCrearLista(nombreNueva);
    if (id) {
      onAlternarLista(id);
      setNombreNueva(null);
    }
  };

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} aria-hidden />
      <div
        role="dialog"
        aria-label={t('Guardar {nombre}', { nombre: perfume })}
        style={{
          position: 'fixed', left: izquierda, top: Math.max(12, arriba), width: ancho, zIndex: 2000,
          background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)',
          border: '1px solid var(--m3-outline)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
          padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Heart size={16} fill="#ef4444" color="#ef4444" />
          <strong style={{ fontSize: '13px', flex: 1 }}>{recienGuardado ? t('Guardado en Favoritos') : t('Está en tus Favoritos')}</strong>
          <button type="button" onClick={onCerrar} className="m3-search-clear" aria-label={t('Cerrar')}>
            <X size={15} />
          </button>
        </div>

        <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)', fontWeight: 700 }}>
          {listas.length ? t('Agregar también a una lista:') : t('Puedes ordenarlo en una lista:')}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {listas.map((l) => {
            const dentro = enListas.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                className={`m3-chip ${dentro ? 'active' : ''}`}
                aria-pressed={dentro}
                onClick={() => onAlternarLista(l.id)}
                style={{ fontSize: '11.5px' }}
              >
                {dentro ? <Check size={12} /> : <Plus size={12} />} {l.nombre}
              </button>
            );
          })}
          {nombreNueva === null ? (
            <button type="button" className="m3-chip" onClick={() => setNombreNueva('')} style={{ fontSize: '11.5px' }}>
              <Plus size={12} /> {t('Nueva lista')}
            </button>
          ) : (
            <form onSubmit={crear} style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <input
                autoFocus
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                maxLength={60}
                placeholder={t('Ej: Verano')}
                aria-label={t('Nombre de la nueva lista')}
                style={{ flex: 1, minWidth: 0, fontSize: '12px', padding: '5px 9px', borderRadius: '8px', border: '1px solid var(--m3-outline)', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}
              />
              <button type="submit" className="m3-btn m3-btn-primary" style={{ fontSize: '11.5px', padding: '5px 10px' }} disabled={!nombreNueva.trim()}>
                {t('Crear')}
              </button>
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={onQuitar}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0 }}
        >
          <Trash2 size={12} /> {t('Quitar de Favoritos')}
        </button>
      </div>
    </>
  );
};
