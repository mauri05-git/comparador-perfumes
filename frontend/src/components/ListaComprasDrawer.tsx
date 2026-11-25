import React, { useEffect, useState } from 'react';
import {
  Heart,
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
  Plus,
  Pencil,
  ListPlus,
} from 'lucide-react';
import { t, tn } from '../i18n.ts';

// Lista con nombre que crea el usuario
export interface ListaPropia {
  id: string;
  nombre: string;
}

export interface ItemListaCompra {
  id: string;
  perfume: string;
  marca?: string;
  tienda: string;
  precioGuardado: number | null;
  ml: number | null;
  concentracion?: string; // "Eau de Toilette (EDT)", "Eau de Parfum"...
  url: string;
  imagen: string | null;
  // Ya no se usa: antes cada perfume iba en una sola de "Por comprar", "Favorito" o "Para regalar". Todo lo guardado
  // es un favorito y se ordena en listas propias; se conserva para leer listas guardadas antes (ver migrarCategorias)
  categoria?: 'comprar' | 'regalo' | 'favorito';
  // Ids de las listas propias en que está (puede estar en varias)
  listas?: string[];
  notaPersonal: string;
  fechaGuardado: string;
  // Precio de hoy en la misma página de la tienda (se re-cotiza una vez al día)
  precioActual?: number | null;
  fechaPrecioActual?: string;
  // Primer precio verificado en la tienda: contra este se avisan las bajas
  precioBase?: number | null;
  fechaBase?: string;
}

// "Eau de Toilette (EDT)" o "Eau de Toilette" -> "EDT"
const SIGLAS: Record<string, string> = { 'eau de toilette': 'EDT', 'eau de parfum': 'EDP', 'eau de cologne': 'EDC', parfum: 'Parfum', 'extrait de parfum': 'Extrait' };
const siglaConcentracion = (c?: string) => (c ? c.match(/\(([^)]+)\)/)?.[1] || SIGLAS[c.trim().toLowerCase()] || c : null);

export const ModalListaCompras: React.FC<{
  abierto: boolean;
  alCerrar: () => void;
  items: ItemListaCompra[];
  listasPropias: ListaPropia[];
  onCrearLista: (nombre: string) => string | null;
  onRenombrarLista: (id: string, nombre: string) => void;
  onBorrarLista: (id: string) => void;
  onAlternarEnLista: (itemId: string, listaId: string) => void;
  onEliminar: (id: string) => void;
  // Varios a la vez: quitarlos de Favoritos (de Mi Lista) o solo sacarlos de una lista propia
  onEliminarVarios: (ids: string[]) => void;
  onQuitarDeLista: (ids: string[], listaId: string) => void;
  onAgregarALista: (ids: string[], listaId: string) => void;
  onCambiarNota: (id: string, nota: string) => void;
  onActualizarPrecios: () => void;
  actualizando: boolean;
  onBuscarEnVivo: (nombre: string, url?: string) => void;
  onCompararDos: (p1: string, p2: string) => void;
  onVaciarLista: () => void;
}> = ({
  abierto,
  alCerrar,
  items,
  listasPropias,
  onCrearLista,
  onRenombrarLista,
  onBorrarLista,
  onAlternarEnLista,
  onEliminar,
  onEliminarVarios,
  onQuitarDeLista,
  onAgregarALista,
  onCambiarNota,
  onActualizarPrecios,
  actualizando,
  onBuscarEnVivo,
  onCompararDos,
  onVaciarLista,
}) => {
  // 'todos' (Favoritos: todo lo guardado) o el id de una lista propia
  const [filtroCat, setFiltroCat] = useState<string>('todos');
  const [seleccionadosComp, setSeleccionadosComp] = useState<string[]>([]);
  const [copiadoExito, setCopiadoExito] = useState(false);
  const [nombreNueva, setNombreNueva] = useState<string | null>(null); // null: formulario cerrado
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [itemEligiendoListas, setItemEligiendoListas] = useState<string | null>(null);
  // Elegir varios perfumes para quitarlos de una vez (con cientos guardados, de a uno no sirve). null: sin elegir
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  // Elegidos: a qué lista agregarlos (se abre bajo la barra) y el aviso de lo que se hizo
  const [eligiendoDestino, setEligiendoDestino] = useState(false);
  const [nombreDestino, setNombreDestino] = useState('');
  const [avisoSeleccion, setAvisoSeleccion] = useState<string | null>(null);
  // Lo que no se puede deshacer pide confirmación en la app (vaciar, borrar una lista, quitar varios)
  const [confirmacion, setConfirmacion] = useState<{ titulo: string; detalle: string; boton: string; accion: () => void } | null>(null);
  // Con la confirmación abierta, Escape la cierra solo a ella: el atajo de la app cerraría también Mi Lista
  useEffect(() => {
    if (!confirmacion) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setConfirmacion(null);
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, [confirmacion]);

  if (!abierto) return null;

  const listaActiva = listasPropias.find((l) => l.id === filtroCat) || null;
  // Si la lista elegida se borró (por ejemplo desde otro equipo), se vuelve a Favoritos
  const filtro = listaActiva ? filtroCat : 'todos';
  const itemsFiltrados = listaActiva ? items.filter((i) => i.listas?.includes(listaActiva.id)) : items;
  // Solo cuentan los elegidos que se ven: al cambiar de pestaña no se quita algo que no está a la vista
  const elegidos = seleccion ? seleccion.filter((id) => itemsFiltrados.some((i) => i.id === id)) : [];
  const alternarElegido = (id: string) => {
    setAvisoSeleccion(null);
    setSeleccion((prev) => (prev ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id]));
  };
  const perfumes = (n: number) => tn(n, '{n} perfume', '{n} perfumes');

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombreNueva !== null && onCrearLista(nombreNueva)) setNombreNueva(null);
  };

  // El presupuesto usa el precio de hoy cuando se conoce
  const totalPresupuesto = itemsFiltrados.reduce(
    (acc, item) => acc + (item.precioActual || item.precioGuardado || 0),
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
    const lineas = itemsFiltrados.map(
      (i, idx) =>
        `${idx + 1}. ${i.perfume} (${i.tienda}) - ${
          i.precioGuardado ? `$${i.precioGuardado.toLocaleString('es-CL')} CLP` : t('Consultar')
        }${i.notaPersonal ? ` [${i.notaPersonal}]` : ''}`
    );
    const texto = `${listaActiva ? listaActiva.nombre : t('Mis favoritos')} (PerfumeScan Chile)\n${lineas.join(
      '\n'
    )}\n${t('Total estimado: ${total} CLP', { total: totalPresupuesto.toLocaleString('es-CL') })}`;
    navigator.clipboard?.writeText(texto);
    setCopiadoExito(true);
    setTimeout(() => setCopiadoExito(false), 2500);
  };

  return (
    <div className="m3-modal-backdrop" onClick={alCerrar}>
      <div className="m3-modal-card" role="dialog" aria-modal="true" style={{ maxWidth: '740px' }} onClick={(e) => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
                {t('Mis favoritos y listas')}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {t('Los perfumes que guardaste, con su precio y su tienda.')}
              </span>
            </div>
          </div>
          <button onClick={alCerrar} className="m3-search-clear" title={t('Cerrar')}>
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
                {tn(itemsFiltrados.length, 'Total estimado ({n} perfume)', 'Total estimado ({n} perfumes)')}
              </span>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--m3-primary)', fontFamily: 'var(--font-mono)' }}>
                ${totalPresupuesto.toLocaleString('es-CL')} CLP
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {items.some((i) => i.url) && (
                <button
                  onClick={onActualizarPrecios}
                  disabled={actualizando}
                  className="m3-btn m3-btn-tonal"
                  style={{ fontSize: '11.5px', padding: '7px 13px' }}
                  title={t('Volver a consultar el precio de cada perfume en su tienda')}
                >
                  <RefreshCw size={14} /> {actualizando ? t('Actualizando...') : t('Actualizar precios')}
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={copiarResumenPortapapeles}
                  className="m3-btn m3-btn-tonal"
                  style={{ fontSize: '11.5px', padding: '7px 13px' }}
                >
                  {copiadoExito ? <><Check size={14} /> {t('Copiado')}</> : <><Copy size={14} /> {t('Copiar Resumen')}</>}
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={() =>
                    setConfirmacion({
                      titulo: t('¿Vaciar Favoritos?'),
                      detalle: t('Se quitan los {perfumes} guardados y sus listas quedan vacías. No se puede deshacer.', { perfumes: perfumes(items.length) }),
                      boton: t('Vaciar'),
                      accion: onVaciarLista,
                    })
                  }
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
                  {t('Vaciar lista')}
                </button>
              )}
            </div>
          </div>

          {/* Filtros por categoría de lista */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {/* Todo lo guardado con el corazón es un favorito; las listas propias lo ordenan (un perfume puede estar en varias) */}
            <button
              className={`m3-chip ${filtro === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroCat('todos')}
              title={t('Todo lo que guardaste con el corazón')}
            >
              <Heart size={13} /> {t('Favoritos ({n})', { n: items.length })}
            </button>
            {listasPropias.map((l) => (
              <button
                key={l.id}
                className={`m3-chip ${filtro === l.id ? 'active' : ''}`}
                onClick={() => setFiltroCat(l.id)}
                title={t('Tu lista "{nombre}"', { nombre: l.nombre })}
              >
                {l.nombre} ({items.filter((i) => i.listas?.includes(l.id)).length})
              </button>
            ))}
            {nombreNueva === null ? (
              <button type="button" className="m3-chip" onClick={() => setNombreNueva('')} title={t('Crear una lista con nombre')}>
                <Plus size={13} /> {t('Nueva lista')}
              </button>
            ) : (
              <form onSubmit={crear} style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                <input
                  autoFocus
                  value={nombreNueva}
                  onChange={(e) => setNombreNueva(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setNombreNueva(null)}
                  maxLength={60}
                  placeholder={t('Ej: Verano, Para mamá')}
                  aria-label={t('Nombre de la nueva lista')}
                  style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--m3-outline)', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)', width: '170px' }}
                />
                <button type="submit" className="m3-btn m3-btn-primary" style={{ fontSize: '11.5px', padding: '5px 11px' }} disabled={!nombreNueva.trim()}>
                  {t('Crear')}
                </button>
                <button type="button" className="m3-search-clear" onClick={() => setNombreNueva(null)} aria-label={t('Cancelar')}>
                  <X size={15} />
                </button>
              </form>
            )}
          </div>

          {/* Lista propia elegida: renombrar o borrar */}
          {listaActiva && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
              {renombrando === listaActiva.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const valor = (e.currentTarget.elements.namedItem('nombre') as HTMLInputElement).value;
                    onRenombrarLista(listaActiva.id, valor);
                    setRenombrando(null);
                  }}
                  style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                >
                  <input
                    name="nombre"
                    autoFocus
                    defaultValue={listaActiva.nombre}
                    maxLength={60}
                    aria-label={t('Nuevo nombre de la lista')}
                    onKeyDown={(e) => e.key === 'Escape' && setRenombrando(null)}
                    style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--m3-outline)', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)', width: '170px' }}
                  />
                  <button type="submit" className="m3-btn m3-btn-tonal" style={{ fontSize: '11.5px', padding: '5px 11px' }}>Guardar</button>
                  <button type="button" className="m3-search-clear" onClick={() => setRenombrando(null)} aria-label={t('Cancelar')}>
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <span>Lista <strong style={{ color: 'var(--m3-text-primary)' }}>{listaActiva.nombre}</strong>. Un perfume puede estar en varias listas.</span>
                  <button type="button" onClick={() => setRenombrando(listaActiva.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--m3-primary)', fontWeight: 700, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Pencil size={12} /> {t('Renombrar')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmacion({
                        titulo: t('¿Borrar la lista "{nombre}"?', { nombre: listaActiva.nombre }),
                        detalle: t('Se borra solo la lista: sus perfumes siguen en Favoritos.'),
                        boton: t('Borrar lista'),
                        accion: () => {
                          onBorrarLista(listaActiva.id);
                          setFiltroCat('todos');
                        },
                      })
                    }
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={12} /> {t('Borrar lista')}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Elegir varios para quitarlos de una vez */}
          {itemsFiltrados.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px' }}>
              {seleccion === null ? (
                <button type="button" className="m3-btn m3-btn-tonal" style={{ fontSize: '11.5px', padding: '5px 11px' }} onClick={() => { setSeleccion([]); setAvisoSeleccion(null); }}>
                  <Check size={13} /> {t('Seleccionar varios')}
                </button>
              ) : (
                <>
                  <strong role="status" style={{ color: 'var(--m3-text-primary)' }}>{elegidos.length ? tn(elegidos.length, '{n} perfume elegido', '{n} perfumes elegidos') : t('Marca los perfumes que quieres quitar')}</strong>
                  <button
                    type="button"
                    className="m3-btn m3-btn-tonal"
                    style={{ fontSize: '11.5px', padding: '5px 11px' }}
                    onClick={() => setSeleccion(elegidos.length === itemsFiltrados.length ? [] : itemsFiltrados.map((i) => i.id))}
                  >
                    {elegidos.length === itemsFiltrados.length ? t('Desmarcar todos') : t('Marcar todos ({n})', { n: itemsFiltrados.length })}
                  </button>
                  <button
                    type="button"
                    className="m3-btn m3-btn-tonal"
                    style={{ fontSize: '11.5px', padding: '5px 11px' }}
                    disabled={!elegidos.length}
                    aria-expanded={eligiendoDestino}
                    onClick={() => setEligiendoDestino(!eligiendoDestino)}
                  >
                    <ListPlus size={13} /> {t('Agregar a una lista')}
                  </button>
                  {listaActiva && (
                    <button
                      type="button"
                      className="m3-btn m3-btn-tonal"
                      style={{ fontSize: '11.5px', padding: '5px 11px' }}
                      disabled={!elegidos.length}
                      onClick={() => {
                        onQuitarDeLista(elegidos, listaActiva.id);
                        setSeleccion(null);
                      }}
                      title={t('Siguen en Favoritos')}
                    >
                      <X size={13} /> {t('Sacar de "{nombre}"', { nombre: listaActiva.nombre })}
                    </button>
                  )}
                  <button
                    type="button"
                    className="m3-btn m3-btn-tonal"
                    style={{ fontSize: '11.5px', padding: '5px 11px', color: '#dc2626' }}
                    disabled={!elegidos.length}
                    onClick={() => {
                      const ids = elegidos;
                      setConfirmacion({
                        titulo: t('¿Quitar {perfumes} de Favoritos?', { perfumes: perfumes(ids.length) }),
                        detalle: t('Se quitan de Favoritos y de todas tus listas. No se puede deshacer.'),
                        boton: t('Quitar'),
                        accion: () => {
                          onEliminarVarios(ids);
                          setSeleccion(null);
                        },
                      });
                    }}
                  >
                    <Trash2 size={13} /> {t('Quitar de Favoritos')}
                  </button>
                  <button type="button" onClick={() => { setSeleccion(null); setEligiendoDestino(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--m3-text-secondary)', fontWeight: 700, fontSize: '12px' }}>
                    {avisoSeleccion ? t('Listo') : t('Cancelar')}
                  </button>
                </>
              )}
            </div>
          )}
          {seleccion !== null && avisoSeleccion && (
            <span role="status" style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
              <Check size={12} style={{ verticalAlign: '-2px' }} /> {avisoSeleccion}
            </span>
          )}
          {/* A qué lista agregar los elegidos: una de las propias o una nueva con ellos */}
          {seleccion !== null && eligiendoDestino && elegidos.length > 0 && (() => {
            const agregar = (listaId: string, nombre: string) => {
              onAgregarALista(elegidos, listaId);
              setAvisoSeleccion(t('{perfumes} en "{nombre}"', { perfumes: perfumes(elegidos.length), nombre }));
              setEligiendoDestino(false);
              setSeleccion([]);
            };
            const destinos = listasPropias.filter((l) => l.id !== listaActiva?.id);
            return (
              <div role="group" aria-label={t('Agregar los elegidos a una lista')} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: 'var(--m3-text-secondary)', fontWeight: 700 }}>{t('Agregar {perfumes} a:', { perfumes: perfumes(elegidos.length) })}</span>
                {destinos.map((l) => {
                  const yaEstan = elegidos.every((id) => items.find((i) => i.id === id)?.listas?.includes(l.id));
                  return (
                    <button key={l.id} type="button" className="m3-chip" style={{ fontSize: '11.5px' }} disabled={yaEstan} title={yaEstan ? t('Ya están todos en esta lista') : undefined} onClick={() => agregar(l.id, l.nombre)}>
                      {yaEstan ? <Check size={12} /> : <Plus size={12} />} {l.nombre}
                    </button>
                  );
                })}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const id = onCrearLista(nombreDestino);
                    if (id) {
                      agregar(id, nombreDestino.trim());
                      setNombreDestino('');
                    }
                  }}
                  style={{ display: 'inline-flex', gap: '6px' }}
                >
                  <input
                    value={nombreDestino}
                    onChange={(e) => setNombreDestino(e.target.value)}
                    maxLength={60}
                    placeholder={t('Nueva lista con ellos')}
                    aria-label={t('Nombre de una lista nueva con los elegidos')}
                    style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--m3-outline)', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)', width: '160px' }}
                  />
                  <button type="submit" className="m3-btn m3-btn-primary" style={{ fontSize: '11.5px', padding: '5px 11px' }} disabled={!nombreDestino.trim()}>
                    {t('Crear')}
                  </button>
                </form>
              </div>
            );
          })()}

          {/* Lista de items */}
          {itemsFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--m3-text-tertiary)' }}>
              <ShoppingBag size={36} strokeWidth={1.5} style={{ margin: '0 auto 10px auto', display: 'block', opacity: 0.5 }} />
              <strong style={{ fontSize: '14.5px', color: 'var(--m3-text-primary)', display: 'block' }}>
                {listaActiva ? t('"{nombre}" todavía no tiene perfumes', { nombre: listaActiva.nombre }) : t('Todavía no tienes favoritos')}
              </strong>
              <p style={{ fontSize: '12.5px', margin: '4px 0 0 0' }}>
                {listaActiva ? (
                  <>{t('Ve a Favoritos y usa "Listas" en cada perfume para agregarlo aquí.')}</>
                ) : (
                  <>{t('Pulsa el corazón o "Guardar" en cualquier oferta o ficha para guardarla aquí.')}</>
                )}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {itemsFiltrados.map((item) => {
                const marcadoComp = seleccionadosComp.includes(item.perfume);
                const elegido = elegidos.includes(item.id);
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--m3-surface-container-low)',
                      border: elegido ? '1.5px solid #dc2626' : marcadoComp ? '1.5px solid var(--m3-primary)' : '1px solid var(--m3-outline-variant)',
                      borderRadius: 'var(--m3-shape-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {seleccion !== null && (
                      <input
                        type="checkbox"
                        checked={elegido}
                        onChange={() => alternarElegido(item.id)}
                        aria-label={t('Elegir {nombre}', { nombre: item.perfume })}
                        style={{ width: '18px', height: '18px', accentColor: '#dc2626', cursor: 'pointer', flexShrink: 0 }}
                      />
                    )}
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
                        {siglaConcentracion(item.concentracion) && (
                          <span className="m3-volume-badge" title={item.concentracion}>
                            {siglaConcentracion(item.concentracion)}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)', display: 'block', marginTop: '3px' }}>
                        {t('Guardado el {fecha}', { fecha: item.fechaGuardado })}
                      </span>

                      <strong className="m3-editorial-title" style={{ fontSize: '15px', color: 'var(--m3-text-primary)', display: 'block', margin: '3px 0' }}>
                        {item.perfume}
                      </strong>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (listasPropias.length === 0) setNombreNueva('');
                            else setItemEligiendoListas(itemEligiendoListas === item.id ? null : item.id);
                          }}
                          aria-expanded={itemEligiendoListas === item.id}
                          className="m3-btn m3-btn-tonal"
                          style={{ fontSize: '11.5px', padding: '4px 9px' }}
                          title={listasPropias.length === 0 ? t('Crea una lista para agregar este perfume') : t('Agregar o quitar de tus listas')}
                        >
                          <ListPlus size={13} /> {t('Listas')}{item.listas?.length ? ` (${item.listas.filter((id) => listasPropias.some((l) => l.id === id)).length})` : ''}
                        </button>

                        <input
                          type="text"
                          placeholder={t('Nota personal (ej: esperar descuento)...')}
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

                      {itemEligiendoListas === item.id && (
                        <div role="group" aria-label={t('Listas de {nombre}', { nombre: item.perfume })} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {listasPropias.map((l) => {
                            const dentro = !!item.listas?.includes(l.id);
                            return (
                              <button
                                key={l.id}
                                type="button"
                                className={`m3-chip ${dentro ? 'active' : ''}`}
                                aria-pressed={dentro}
                                onClick={() => onAlternarEnLista(item.id, l.id)}
                                style={{ fontSize: '11.5px' }}
                              >
                                {dentro ? <Check size={12} /> : <Plus size={12} />} {l.nombre}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--m3-primary)', fontFamily: 'var(--font-mono)' }}>
                        {(item.precioActual || item.precioGuardado)
                          ? `$${(item.precioActual || item.precioGuardado)!.toLocaleString('es-CL')} CLP`
                          : t('Ver en tienda')}
                      </span>
                      <CambioDePrecio item={item} />

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
                          title={t('Seleccionar para comparar frente a frente')}
                        >
                          <Scale size={13} /> {marcadoComp ? 'Marcado' : ''}
                        </button>

                        <button
                          onClick={() => {
                            onBuscarEnVivo(item.perfume, item.url);
                            alCerrar();
                          }}
                          className="m3-btn m3-btn-tonal"
                          style={{ padding: '5px 10px', fontSize: '11px' }}
                          title={t('Ver los precios de hoy en las 4 tiendas, con este mismo producto abierto')}
                        >
                          <RefreshCw size={12} /> {t('Cotizar')}
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
                          title={t('Quitar de Favoritos')}
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

        <div className="m3-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span role="status" style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', flex: '1 1 220px' }}>
            {items.length >= 2 && seleccionadosComp.length === 0 && <>{t('Marca dos perfumes con')} <Scale size={12} style={{ verticalAlign: '-2px' }} /> {t('para compararlos frente a frente.')}</>}
            {seleccionadosComp.length === 1 && <>{t('Marcaste {nombre}. Marca otro para compararlos.', { nombre: seleccionadosComp[0] })}</>}
            {seleccionadosComp.length === 2 && <><strong>{seleccionadosComp[0]}</strong> vs <strong>{seleccionadosComp[1]}</strong></>}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {seleccionadosComp.length === 2 && (
              <button
                type="button"
                onClick={() => {
                  onCompararDos(seleccionadosComp[0], seleccionadosComp[1]);
                  alCerrar();
                }}
                className="m3-btn m3-btn-primary"
              >
                <Scale size={14} /> {t('Comparar los dos')}
              </button>
            )}
            <button type="button" onClick={alCerrar} className={`m3-btn ${seleccionadosComp.length === 2 ? 'm3-btn-tonal' : 'm3-btn-primary'}`}>
              {t('Cerrar')}
            </button>
          </div>
        </div>
      </div>
      {confirmacion && (
        <div
          onClick={(e) => { e.stopPropagation(); setConfirmacion(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmacion-titulo"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)', border: '1px solid var(--m3-outline)', borderRadius: '14px', padding: '18px 20px', maxWidth: '380px', width: '100%', boxShadow: '0 12px 34px rgba(0,0,0,0.25)' }}
          >
            <strong id="confirmacion-titulo" style={{ fontSize: '15px', display: 'block', marginBottom: '6px' }}>{confirmacion.titulo}</strong>
            <p style={{ fontSize: '12.5px', color: 'var(--m3-text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>{confirmacion.detalle}</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" autoFocus className="m3-btn m3-btn-tonal" style={{ fontSize: '12px', padding: '6px 14px' }} onClick={() => setConfirmacion(null)}>
                {t('Cancelar')}
              </button>
              <button
                type="button"
                className="m3-btn m3-btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px', background: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => { confirmacion.accion(); setConfirmacion(null); }}
              >
                {confirmacion.boton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Diferencia entre el precio de hoy y el primero que se verificó en la tienda
function CambioDePrecio({ item }: { item: ItemListaCompra }) {
  const { precioActual: hoy, precioBase: antes } = item;
  if (!item.url) {
    return <span style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>{t('Sin enlace a la tienda: no se sigue su precio')}</span>;
  }
  if (!hoy || !antes) return null;
  const esHoy = item.fechaBase === item.fechaPrecioActual;
  const desde = esHoy ? t('hoy') : t('el {fecha}', { fecha: item.fechaBase?.split('-').reverse().slice(0, 2).join('-') ?? '' });
  const diferencia = antes - hoy;
  const estilo = { fontSize: '11.5px', fontWeight: 700 } as const;
  if (diferencia === 0) {
    return <span style={{ ...estilo, color: 'var(--m3-text-secondary)' }}>{esHoy ? t('Te avisaremos si baja') : t('Mismo precio que {desde}', { desde })}</span>;
  }
  const pct = Math.round((Math.abs(diferencia) / antes) * 100);
  return diferencia > 0 ? (
    <span style={{ ...estilo, color: 'var(--m3-success)' }}>
      ↓ {t('Bajó ${dif} ({pct} %) desde {desde}', { dif: diferencia.toLocaleString('es-CL'), pct, desde })}
    </span>
  ) : (
    <span style={{ ...estilo, color: 'var(--m3-error)' }}>
      ↑ {t('Subió ${dif} ({pct} %) desde {desde}', { dif: (-diferencia).toLocaleString('es-CL'), pct, desde })}
    </span>
  );
}
