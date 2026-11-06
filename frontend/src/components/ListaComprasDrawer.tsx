import React, { useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Scale,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  X,
  Droplets,
  Store,
} from 'lucide-react';

export interface ItemListaCompra {
  id: string;
  perfume: string;
  marca?: string;
  tienda: string;
  precioGuardado: number | null;
  ml: number | null;
  url: string;
  imagen: string | null;
  categoria: 'comprar' | 'regalo' | 'favorito';
  notaPersonal: string;
  fechaGuardado: string;
}

export const ModalListaCompras: React.FC<{
  abierto: boolean;
  alCerrar: () => void;
  items: ItemListaCompra[];
  onEliminar: (id: string) => void;
  onCambiarCategoria: (id: string, cat: ItemListaCompra['categoria']) => void;
  onCambiarNota: (id: string, nota: string) => void;
  onBuscarEnVivo: (nombre: string) => void;
  onCompararDos: (p1: string, p2: string) => void;
  onVaciarLista: () => void;
}> = ({
  abierto,
  alCerrar,
  items,
  onEliminar,
  onCambiarCategoria,
  onCambiarNota,
  onBuscarEnVivo,
  onCompararDos,
  onVaciarLista,
}) => {
  const [filtroCat, setFiltroCat] = useState<'todos' | 'comprar' | 'regalo' | 'favorito'>('todos');
  const [seleccionadosComp, setSeleccionadosComp] = useState<string[]>([]);
  const [copiadoExito, setCopiadoExito] = useState(false);

  if (!abierto) return null;

  const itemsFiltrados =
    filtroCat === 'todos' ? items : items.filter((i) => i.categoria === filtroCat);

  const totalPresupuesto = itemsFiltrados.reduce(
    (acc, item) => acc + (item.precioGuardado || 0),
    0
  );

  const toggleSeleccionComp = (nombre: string) => {
    if (seleccionadosComp.includes(nombre)) {
      setSeleccionadosComp(seleccionadosComp.filter((n) => n !== nombre));
    } else if (seleccionadosComp.length < 2) {
      setSeleccionadosComp([...seleccionadosComp, nombre]);
    } else {
      setSeleccionadosComp([seleccionadosComp[1], nombre]);
    }
  };

  const copiarResumenPortapapeles = () => {
    const lineas = items.map(
      (i, idx) =>
        `${idx + 1}. ${i.perfume} (${i.tienda}) - ${
          i.precioGuardado ? `$${i.precioGuardado.toLocaleString('es-CL')} CLP` : 'Consultar'
        }${i.notaPersonal ? ` [${i.notaPersonal}]` : ''}`
    );
    const texto = `Mi Lista de Perfumes (PerfumeScan Chile)\n${lineas.join(
      '\n'
    )}\nTotal estimado: $${totalPresupuesto.toLocaleString('es-CL')} CLP`;
    navigator.clipboard?.writeText(texto);
    setCopiadoExito(true);
    setTimeout(() => setCopiadoExito(false), 2500);
  };

  return (
    <div className="m3-modal-backdrop" onClick={alCerrar}>
      <div className="m3-modal-card" style={{ maxWidth: '740px' }} onClick={(e) => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
                Mi Lista de Compras y Colección
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Planificador personal de fragancias y seguimiento de presupuesto en tiendas oficiales.
              </span>
            </div>
          </div>
          <button onClick={alCerrar} className="m3-search-clear" title="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="m3-modal-body">
          {/* Resumen Financiero y Acciones */}
          <div
            style={{
              background: 'linear-gradient(135deg, var(--m3-primary-container) 0%, var(--m3-surface-container-low) 100%)',
              borderRadius: 'var(--m3-shape-lg)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              border: '1px solid var(--m3-outline-variant)',
            }}
          >
            <div>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Presupuesto Total Estimado ({itemsFiltrados.length} {itemsFiltrados.length === 1 ? 'ítem' : 'ítems'})
              </span>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--m3-primary)', fontFamily: 'var(--font-mono)' }}>
                ${totalPresupuesto.toLocaleString('es-CL')} CLP
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {seleccionadosComp.length === 2 && (
                <button
                  onClick={() => {
                    onCompararDos(seleccionadosComp[0], seleccionadosComp[1]);
                    alCerrar();
                  }}
                  className="m3-btn m3-btn-primary"
                  style={{ fontSize: '11.5px', padding: '7px 13px' }}
                >
                  <Scale size={14} /> Comparar seleccionados
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={copiarResumenPortapapeles}
                  className="m3-btn m3-btn-tonal"
                  style={{ fontSize: '11.5px', padding: '7px 13px' }}
                >
                  {copiadoExito ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar Resumen</>}
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={onVaciarLista}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#dc2626',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                >
                  Vaciar lista
                </button>
              )}
            </div>
          </div>

          {/* Filtros por categoría de lista */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              className={`m3-chip ${filtroCat === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroCat('todos')}
            >
              Todos ({items.length})
            </button>
            <button
              className={`m3-chip ${filtroCat === 'comprar' ? 'active' : ''}`}
              onClick={() => setFiltroCat('comprar')}
            >
              Por Comprar ({items.filter((i) => i.categoria === 'comprar').length})
            </button>
            <button
              className={`m3-chip ${filtroCat === 'favorito' ? 'active' : ''}`}
              onClick={() => setFiltroCat('favorito')}
            >
              Favoritos ({items.filter((i) => i.categoria === 'favorito').length})
            </button>
            <button
              className={`m3-chip ${filtroCat === 'regalo' ? 'active' : ''}`}
              onClick={() => setFiltroCat('regalo')}
            >
              Para Regalar ({items.filter((i) => i.categoria === 'regalo').length})
            </button>
          </div>

          {/* Lista de items */}
          {itemsFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--m3-text-tertiary)' }}>
              <ShoppingBag size={36} strokeWidth={1.5} style={{ margin: '0 auto 10px auto', display: 'block', opacity: 0.5 }} />
              <strong style={{ fontSize: '14.5px', color: 'var(--m3-text-primary)', display: 'block' }}>
                Tu lista de compras está vacía en esta categoría
              </strong>
              <p style={{ fontSize: '12.5px', margin: '4px 0 0 0' }}>
                Pulsa el botón <strong>"Guardar"</strong> en cualquier oferta o ficha para organizar tus próximas compras.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {itemsFiltrados.map((item) => {
                const marcadoComp = seleccionadosComp.includes(item.perfume);
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--m3-surface-container-low)',
                      border: marcadoComp ? '1.5px solid var(--m3-primary)' : '1px solid var(--m3-outline-variant)',
                      borderRadius: 'var(--m3-shape-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {item.imagen && (
                      <img
                        src={item.imagen}
                        alt={item.perfume}
                        style={{
                          width: '60px',
                          height: '60px',
                          objectFit: 'contain',
                          background: '#fff',
                          borderRadius: '10px',
                          padding: '5px',
                          border: '1px solid var(--m3-outline-variant)',
                        }}
                      />
                    )}

                    <div style={{ flex: '1 1 220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Store size={12} /> {item.tienda}
                        </span>
                        {item.ml && (
                          <span className="m3-volume-badge">
                            <Droplets size={11} /> {item.ml} ml
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>
                          · Guardado el {item.fechaGuardado}
                        </span>
                      </div>

                      <strong className="m3-editorial-title" style={{ fontSize: '15px', color: 'var(--m3-text-primary)', display: 'block', margin: '3px 0' }}>
                        {item.perfume}
                      </strong>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                        <select
                          value={item.categoria}
                          onChange={(e) => onCambiarCategoria(item.id, e.target.value as ItemListaCompra['categoria'])}
                          style={{
                            fontSize: '11.5px',
                            padding: '4px 9px',
                            borderRadius: '8px',
                            border: '1px solid var(--m3-outline)',
                            background: 'var(--m3-surface-container-lowest)',
                            color: 'var(--m3-text-primary)',
                            fontWeight: 600,
                          }}
                        >
                          <option value="comprar">Por Comprar</option>
                          <option value="favorito">Favorito</option>
                          <option value="regalo">Para Regalo</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Nota personal (ej: esperar descuento)..."
                          value={item.notaPersonal}
                          onChange={(e) => onCambiarNota(item.id, e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: '150px',
                            fontSize: '11.5px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--m3-outline-variant)',
                            background: 'var(--m3-surface-container-lowest)',
                            color: 'var(--m3-text-secondary)',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--m3-primary)', fontFamily: 'var(--font-mono)' }}>
                        {item.precioGuardado ? `$${item.precioGuardado.toLocaleString('es-CL')} CLP` : 'Ver en tienda'}
                      </span>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => toggleSeleccionComp(item.perfume)}
                          className="m3-btn m3-btn-tonal"
                          style={{
                            padding: '5px 9px',
                            fontSize: '11px',
                            background: marcadoComp ? 'var(--m3-primary)' : undefined,
                            color: marcadoComp ? '#fff' : undefined,
                          }}
                          title="Seleccionar para comparar frente a frente"
                        >
                          <Scale size={13} /> {marcadoComp ? 'Marcado' : ''}
                        </button>

                        <button
                          onClick={() => {
                            onBuscarEnVivo(item.perfume);
                            alCerrar();
                          }}
                          className="m3-btn m3-btn-tonal"
                          style={{ padding: '5px 10px', fontSize: '11px' }}
                          title="Actualizar precios en tiempo real"
                        >
                          <RefreshCw size={12} /> Cotizar
                        </button>

                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="m3-btn m3-btn-outlined"
                            style={{ padding: '5px 10px', fontSize: '11px', textDecoration: 'none' }}
                          >
                            Tienda <ExternalLink size={12} />
                          </a>
                        )}

                        <button
                          onClick={() => onEliminar(item.id)}
                          className="m3-btn m3-btn-tonal"
                          style={{
                            color: '#dc2626',
                            padding: '5px 8px',
                          }}
                          title="Quitar de mi lista"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="m3-modal-footer">
          <button onClick={alCerrar} className="m3-btn m3-btn-primary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
