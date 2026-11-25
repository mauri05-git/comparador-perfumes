import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { coincideFlexible } from '../busquedaFlexible';

// Campo de texto para un perfume que, al enfocarlo, muestra los guardados, las búsquedas recientes y los populares,
// para elegir uno sin escribirlo. Al escribir, filtra esa lista.

export interface OpcionPerfume {
  nombre: string; // lo que se escribe en el campo al elegirla
  detalle?: string;
  imagen?: string | null;
}
export interface GrupoPerfumes {
  titulo: string;
  opciones: OpcionPerfume[];
}

export function CampoPerfume({
  valor,
  alCambiar,
  alElegir,
  alEnter,
  grupos,
  placeholder,
  className,
  style,
}: {
  valor: string;
  alCambiar: (texto: string) => void;
  alElegir: (nombre: string) => void;
  alEnter?: () => void;
  grupos: GrupoPerfumes[];
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const idLista = useId();
  const q = valor.trim();
  const visibles = grupos
    .map((g) => ({
      ...g,
      opciones: g.opciones
        .filter((o) => !q || coincideFlexible(`${o.nombre} ${o.detalle || ''}`, q))
        .slice(0, 6),
    }))
    .filter((g) => g.opciones.length > 0);
  const planas = visibles.flatMap((g) => g.opciones);
  const mostrar = abierto && planas.length > 0;

  // La lista se dibuja fuera del marco de la app (que recorta lo que sobresale) y se ubica junto al campo,
  // hacia abajo o hacia arriba según el espacio que quede en la pantalla
  const refCampo = useRef<HTMLInputElement>(null);
  const refLista = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; alto: number } | null>(null);
  useLayoutEffect(() => {
    if (!mostrar) return;
    const ubicar = () => {
      const r = refCampo.current?.getBoundingClientRect();
      if (!r) return;
      // En pantallas grandes la página tiene zoom: el rectángulo viene en px de pantalla y la posición se aplica
      // en px de la página, así que se divide por el zoom
      const z = (refCampo.current as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom || 1;
      const abajo = window.innerHeight - r.bottom - 16;
      const arriba = r.top - 16;
      const haciaArriba = abajo < 260 * z && arriba > abajo;
      const alto = Math.min(460 * z, haciaArriba ? arriba : abajo);
      setPos({
        left: r.left / z,
        width: Math.max(r.width, 300 * z) / z,
        alto: alto / z,
        ...(haciaArriba ? { bottom: (window.innerHeight - r.top + 8) / z } : { top: (r.bottom + 8) / z }),
      });
    };
    ubicar();
    window.addEventListener('scroll', ubicar, true);
    window.addEventListener('resize', ubicar);
    return () => {
      window.removeEventListener('scroll', ubicar, true);
      window.removeEventListener('resize', ubicar);
    };
  }, [mostrar]);
  useEffect(() => {
    if (activo >= 0) document.getElementById(`${idLista}-${activo}`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, idLista]);

  const elegir = (o: OpcionPerfume) => {
    setAbierto(false);
    setActivo(-1);
    alElegir(o.nombre);
  };

  let indice = -1;
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        ref={refCampo}
        type="text"
        className={className}
        style={{ ...style, width: '100%' }}
        placeholder={placeholder}
        value={valor}
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={mostrar && activo >= 0 ? `${idLista}-${activo}` : undefined}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onChange={(e) => {
          alCambiar(e.target.value);
          setAbierto(true);
          setActivo(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setAbierto(true);
            const paso = e.key === 'ArrowDown' ? 1 : -1;
            setActivo((a) => Math.max(-1, Math.min(planas.length - 1, a + paso)));
          } else if (e.key === 'Enter') {
            if (mostrar && activo >= 0) {
              e.preventDefault();
              elegir(planas[activo]);
            } else {
              setAbierto(false);
              alEnter?.();
            }
          } else if (e.key === 'Escape') {
            setAbierto(false);
          }
        }}
      />
      {mostrar && pos && createPortal(
        <div
          ref={refLista}
          id={idLista}
          role="listbox"
          style={{
            position: 'fixed',
            left: pos.left,
            width: pos.width,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: pos.alto,
            zIndex: 1000,
            overflowY: 'auto',
            background: 'var(--m3-surface-container-lowest)',
            border: '1px solid var(--m3-outline)',
            borderRadius: '14px',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.22)',
            padding: '8px',
            textAlign: 'left',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {visibles.map((g) => (
            <div key={g.titulo} role="group" aria-label={g.titulo}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 10px 6px' }}>
                {g.titulo}
              </div>
              {g.opciones.map((o) => {
                indice += 1;
                const i = indice;
                return (
                  <div
                    key={`${g.titulo}-${o.nombre}-${i}`}
                    id={`${idLista}-${i}`}
                    role="option"
                    aria-selected={i === activo}
                    // mousedown y no click: el clic haría perder el foco y cerraría la lista antes de elegir
                    onMouseDown={(e) => {
                      e.preventDefault();
                      elegir(o);
                    }}
                    onMouseEnter={() => setActivo(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      minHeight: '48px',
                      padding: '9px 10px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: i === activo ? 'var(--m3-primary-container)' : 'transparent',
                    }}
                  >
                    {o.imagen ? (
                      <img src={o.imagen} alt="" style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '8px', background: '#fff', flexShrink: 0 }} />
                    ) : null}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--m3-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.nombre}
                      </div>
                      {o.detalle && (
                        <div style={{ fontSize: '13px', color: 'var(--m3-text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {o.detalle}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
