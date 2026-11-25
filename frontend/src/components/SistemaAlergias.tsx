import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FlaskConical,
  Plus,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { ALERGENOS_UE } from '../alergenos.ts';
import { t, tn } from '../i18n.ts';
import { API_BASE } from '../api.ts';

export interface AlergenoDetectado {
  id: string;
  compuesto_quimico: string;
  nombre_comun: string;
  presente_en: string;
  nivel_riesgo: 'Alto' | 'Moderado' | 'Bajo';
  descripcion: string;
}

export interface DefinicionAlergiaUsuario {
  id: string;
  compuesto: string;
  nombre: string;
  keywords: string[];
  riesgo: 'Alto' | 'Moderado' | 'Bajo';
  explicacion: string;
  // Aparece en la mayoría de los perfumes: se muestra primero al configurar
  frecuente?: boolean;
}

// Los 26 alérgenos de la norma europea, desde la lista única (src/alergenos.ts)
export const CATALOGO_ALERGIAS_IFRA: DefinicionAlergiaUsuario[] = ALERGENOS_UE.map((a) => ({
  id: a.id,
  compuesto: a.compuesto,
  nombre: a.nombre,
  keywords: a.keywords,
  riesgo: a.riesgo,
  explicacion: a.explicacion,
  frecuente: a.frecuente,
}));

export interface ResultadoEvaluacionAlergia {
  // no_verificado: sin coincidencias, pero solo se miraron las notas (sin lista del envase no se puede decir "seguro")
  estado: 'sin_configurar' | 'seguro' | 'no_verificado' | 'precaucion' | 'peligro';
  coincidencias: {
    nombre: string;
    compuesto: string;
    origen: string;
    riesgo: 'Alto' | 'Moderado' | 'Bajo';
  }[];
  todosLosAlergenosDelPerfume: AlergenoDetectado[];
}

export function evaluarRiesgoAlergia(
  ficha: any,
  alergiasSeleccionadasIds: string[],
  notasPersonalizadas: string[]
): ResultadoEvaluacionAlergia {
  if (!ficha) {
    return { estado: 'sin_configurar', coincidencias: [], todosLosAlergenosDelPerfume: [] };
  }

  const notasPerfume = [
    ...(ficha.notas_salida || []),
    ...(ficha.notas_corazon || []),
    ...(ficha.notas_fondo || []),
    ...(ficha.acordes_principales || []),
    ficha.familia_olfativa || '',
    ficha.descripcion || '',
  ]
    .join(' | ')
    .toLowerCase();

  // Con la lista de ingredientes del envase no se estima nada a partir de las notas
  const declarados = ficha.alergenos_fuente === 'ingredientes';
  const todosMap = new Map<string, AlergenoDetectado>();
  if (Array.isArray(ficha.alergenos_detectados)) {
    for (const a of ficha.alergenos_detectados) {
      if (a && a.id) todosMap.set(a.id, a);
    }
  }
  for (const cat of declarados ? [] : CATALOGO_ALERGIAS_IFRA) {
    const halladas = cat.keywords.filter((kw) => notasPerfume.includes(kw));
    if (halladas.length > 0 && !todosMap.has(cat.id)) {
      todosMap.set(cat.id, {
        id: cat.id,
        compuesto_quimico: cat.compuesto,
        nombre_comun: cat.nombre,
        presente_en: halladas.slice(0, 3).join(', '),
        nivel_riesgo: cat.riesgo,
        descripcion: cat.explicacion,
      });
    }
  }

  const todosLosAlergenosDelPerfume = Array.from(todosMap.values());

  if (alergiasSeleccionadasIds.length === 0 && notasPersonalizadas.length === 0) {
    return {
      estado: 'sin_configurar',
      coincidencias: [],
      todosLosAlergenosDelPerfume,
    };
  }

  const coincidencias: ResultadoEvaluacionAlergia['coincidencias'] = [];

  for (const idAlergia of alergiasSeleccionadasIds) {
    const def = CATALOGO_ALERGIAS_IFRA.find((c) => c.id === idAlergia);
    if (!def) continue;

    const detectadoDirecto = todosMap.get(idAlergia);
    const matchesKeywords = declarados ? [] : def.keywords.filter((kw) => notasPerfume.includes(kw));

    if (detectadoDirecto || matchesKeywords.length > 0) {
      coincidencias.push({
        nombre: def.nombre,
        compuesto: def.compuesto,
        origen: detectadoDirecto?.presente_en || matchesKeywords.slice(0, 3).join(', '),
        riesgo: def.riesgo,
      });
    }
  }

  for (const custom of notasPersonalizadas) {
    const limpia = custom.trim().toLowerCase();
    if (limpia.length < 2) continue;
    if (notasPerfume.includes(limpia)) {
      coincidencias.push({
        nombre: t('Sensibilidad a "{nota}"', { nota: custom }),
        compuesto: t('Ingrediente / Nota directa'),
        origen: custom,
        riesgo: 'Alto',
      });
    }
  }

  if (coincidencias.length === 0) {
    return {
      estado: declarados ? 'seguro' : 'no_verificado',
      coincidencias: [],
      todosLosAlergenosDelPerfume,
    };
  }

  const tieneRiesgoAlto = coincidencias.some((c) => c.riesgo === 'Alto') || coincidencias.length >= 2;
  return {
    estado: tieneRiesgoAlto ? 'peligro' : 'precaucion',
    coincidencias,
    todosLosAlergenosDelPerfume,
  };
}

// En cuántos perfumes con lista del envase conocida aparece cada alérgeno. Se pide una vez y la comparten todos los
// semáforos; da contexto cuando un perfume no declara su lista (sin conexión, el semáforo funciona sin este dato).
interface FrecuenciasAlergenos { total: number; conteo: Record<string, number> }
let pedidoFrecuencias: Promise<FrecuenciasAlergenos | null> | null = null;
function useFrecuenciasAlergenos(): FrecuenciasAlergenos | null {
  const [frecuencias, setFrecuencias] = useState<FrecuenciasAlergenos | null>(null);
  useEffect(() => {
    pedidoFrecuencias ??= fetch(`${API_BASE}/api/ingredientes/frecuencias`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    let vigente = true;
    pedidoFrecuencias.then((f) => vigente && setFrecuencias(f));
    return () => { vigente = false; };
  }, []);
  return frecuencias;
}

// ─────────────────────────────────────────────
//  Banner Semáforo Dermatológico (M3 + Vector SVG)
// ─────────────────────────────────────────────
export const BannerSemaforoAlergia: React.FC<{
  ficha: any;
  alergiasIds: string[];
  notasCustom: string[];
  onAbrirConfig: () => void;
  compacto?: boolean;
}> = ({ ficha, alergiasIds, notasCustom, onAbrirConfig, compacto = false }) => {
  const frecuencias = useFrecuenciasAlergenos();
  if (!ficha) return null;
  const evalResult = evaluarRiesgoAlergia(ficha, alergiasIds, notasCustom);
  const totalConfiguradas = alergiasIds.length + notasCustom.length;
  // Lista tomada de otra presentación del mismo perfume (mismo nombre y concentración, otro tamaño o tienda)
  const deOtraPresentacion = ficha.alergenos_origen ? ` ${t('(tomada de “{nombre}”, el mismo perfume en otra presentación)', { nombre: ficha.alergenos_origen })}` : '';

  if (evalResult.estado === 'sin_configurar') {
    return (
      <div
        style={{
          background: 'var(--m3-surface-container-low)',
          border: '1px solid var(--m3-outline-variant)',
          borderRadius: 'var(--m3-shape-md)',
          padding: compacto ? '10px 14px' : '12px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>
          <FlaskConical size={18} strokeWidth={2} style={{ color: 'var(--m3-primary)', flexShrink: 0 }} />
          <span>
            <strong>{t('Seguridad Dermatológica IFRA:')}</strong>{' '}
            {tn(evalResult.todosLosAlergenosDelPerfume.length, '{n} compuesto regulado', '{n} compuestos regulados')}{' '}
            {ficha.alergenos_fuente === 'ingredientes'
              ? `${t('declarados en la lista de ingredientes del envase')}${deOtraPresentacion}`
              : ficha.sin_notas ? t('en {nombre} (sin lista del envase ni notas)', { nombre: ficha.nombre }) : t('estimados a partir de las notas')}{' '}
            ({evalResult.todosLosAlergenosDelPerfume.map(a => a.compuesto_quimico.split(' ')[0]).slice(0, 3).join(', ') || t('ninguno')}). {t('Configura tu perfil para recibir alertas.')}
          </span>
        </div>
        <button onClick={onAbrirConfig} className="m3-btn m3-btn-tonal" style={{ fontSize: '11.5px', padding: '6px 13px' }}>
          <SlidersHorizontal size={13} /> {t('Configurar alergias')}
        </button>
      </div>
    );
  }

  if (evalResult.estado === 'seguro') {
    return (
      <div
        style={{
          background: 'rgba(22, 163, 74, 0.08)',
          border: '1.5px solid rgba(34, 197, 94, 0.45)',
          borderRadius: 'var(--m3-shape-md)',
          padding: compacto ? '10px 14px' : '13px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <ShieldCheck size={22} strokeWidth={2.2} style={{ color: '#16a34a', flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '13px', color: '#15803d', display: 'block' }}>
              {tn(totalConfiguradas, 'Compatible con tu Perfil Dermatológico ({n} filtro activo)', 'Compatible con tu Perfil Dermatológico ({n} filtros activos)')}
            </strong>
            {!compacto && (
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {ficha.alergenos_fuente === 'ingredientes'
                  ? t('Libre de tus alérgenos y notas restringidas en la lista de ingredientes del envase de {nombre}', { nombre: ficha.nombre })
                  : t('Libre de tus alérgenos y notas restringidas en la pirámide olfativa de {nombre}', { nombre: ficha.nombre })}{deOtraPresentacion}.
              </span>
            )}
          </div>
        </div>
        <button onClick={onAbrirConfig} className="m3-btn m3-btn-tonal" style={{ fontSize: '11px', padding: '5px 11px' }}>
          <SlidersHorizontal size={12} /> {t('Perfil')}
        </button>
      </div>
    );
  }

  if (evalResult.estado === 'no_verificado') {
    return (
      <div
        style={{
          background: 'rgba(217, 119, 6, 0.07)',
          border: '1.5px dashed rgba(245, 158, 11, 0.6)',
          borderRadius: 'var(--m3-shape-md)',
          padding: compacto ? '10px 14px' : '13px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <AlertTriangle size={22} strokeWidth={2.2} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '13px', color: '#b45309', display: 'block' }}>
              {tn(totalConfiguradas, 'Sin verificar para tu perfil ({n} filtro activo)', 'Sin verificar para tu perfil ({n} filtros activos)')}
            </strong>
            {!compacto && (
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {ficha.sin_notas
                  ? t('No tenemos la lista de ingredientes del envase ni las notas de {nombre}: revisa la caja antes de comprar.', { nombre: ficha.nombre })
                  : t('No tenemos la lista de ingredientes del envase de {nombre}. Tus alérgenos no aparecen en sus notas, pero compuestos como linalool o limonene no se notan en la pirámide olfativa: revisa la caja antes de comprar.', { nombre: ficha.nombre })}
              </span>
            )}
            {!compacto && frecuencias && frecuencias.total >= 3 && alergiasIds.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', display: 'block', marginTop: '4px' }}>
                {t('En los {n} perfumes cuya lista conocemos:', { n: frecuencias.total })}{' '}
                {alergiasIds
                  .map((id) => CATALOGO_ALERGIAS_IFRA.find((c) => c.id === id))
                  .filter((def): def is DefinicionAlergiaUsuario => !!def)
                  .map((def) => {
                    const n = frecuencias.conteo[def.id] || 0;
                    return t('{compuesto} aparece en {n} ({pct} %)', { compuesto: def.compuesto, n, pct: Math.round((n / frecuencias.total) * 100) });
                  })
                  .join(', ')}
                .
              </span>
            )}
          </div>
        </div>
        <button onClick={onAbrirConfig} className="m3-btn m3-btn-tonal" style={{ fontSize: '11px', padding: '5px 11px' }}>
          <SlidersHorizontal size={12} /> {t('Perfil')}
        </button>
      </div>
    );
  }

  const esPeligro = evalResult.estado === 'peligro';
  const declarados = ficha.alergenos_fuente === 'ingredientes';
  return (
    <div
      style={{
        background: esPeligro ? 'rgba(220, 38, 38, 0.08)' : 'rgba(217, 119, 6, 0.09)',
        border: `1.5px solid ${esPeligro ? 'rgba(239, 68, 68, 0.55)' : 'rgba(245, 158, 11, 0.55)'}`,
        borderRadius: 'var(--m3-shape-md)',
        padding: compacto ? '11px 14px' : '14px 18px',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {esPeligro ? (
            <ShieldAlert size={24} strokeWidth={2.2} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <AlertTriangle size={22} strokeWidth={2.2} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
          )}
          <div>
            <strong style={{ fontSize: '13.5px', color: esPeligro ? '#dc2626' : '#d97706', display: 'block' }}>
              {esPeligro
                ? declarados
                  ? t('Alerta de Alergia: {nombre} contiene compuestos incompatibles con tu piel', { nombre: ficha.nombre })
                  : t('Alerta de Alergia: según sus notas, {nombre} probablemente contiene compuestos incompatibles con tu piel', { nombre: ficha.nombre })
                : declarados
                  ? t('Precaución Dermatológica: el envase declara compuestos sensibles para tu perfil')
                  : t('Precaución Dermatológica: según sus notas, podría contener compuestos sensibles para tu perfil')}
            </strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {evalResult.coincidencias.map((c, idx) => (
                <span
                  key={idx}
                  style={{
                    background: esPeligro ? 'rgba(220, 38, 38, 0.14)' : 'rgba(217, 119, 6, 0.15)',
                    color: 'var(--m3-text-primary)',
                    border: `1px solid ${esPeligro ? 'rgba(220, 38, 38, 0.35)' : 'rgba(217, 119, 6, 0.35)'}`,
                    padding: '4px 11px',
                    borderRadius: '99px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                  }}
                >
                  <strong>{t(c.nombre)}</strong> ({c.compuesto}) · {t('Presente en:')} <em>{t(c.origen)}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={onAbrirConfig}
          className="m3-btn m3-btn-tonal"
          style={{ fontSize: '11px', padding: '5px 11px', flexShrink: 0 }}
        >
          <SlidersHorizontal size={12} /> {t('Mis Alergias')}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Modal Configurador de Alergias y Piel (M3)
// ─────────────────────────────────────────────
export const ModalPerfilAlergias: React.FC<{
  abierto: boolean;
  alCerrar: () => void;
  alergiasSeleccionadas: string[];
  onToggleAlergia: (id: string) => void;
  notasPersonalizadas: string[];
  onAgregarNotaPersonalizada: (nota: string) => void;
  onEliminarNotaPersonalizada: (nota: string) => void;
  onLimpiarTodo: () => void;
}> = ({
  abierto,
  alCerrar,
  alergiasSeleccionadas,
  onToggleAlergia,
  notasPersonalizadas,
  onAgregarNotaPersonalizada,
  onEliminarNotaPersonalizada,
  onLimpiarTodo,
}) => {
  const [inputCustom, setInputCustom] = useState('');

  if (!abierto) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCustom.trim()) return;
    onAgregarNotaPersonalizada(inputCustom.trim());
    setInputCustom('');
  };

  return (
    <div className="m3-modal-backdrop" onClick={alCerrar}>
      <div className="m3-modal-card" role="dialog" aria-modal="true" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FlaskConical size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
                {t('Perfil de Alergias y Sensibilidad Cutánea')}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {t('Monitoreo automático de alérgenos IFRA y notas olfativas que te provoquen irritación o migraña.')}
              </span>
            </div>
          </div>
          <button
            onClick={alCerrar}
            className="m3-search-clear"
            title={t('Cerrar')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="m3-modal-body">
          {/* 1. Catálogo IFRA */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('1. Compuestos Químicos Regulados (Estándar IFRA / UE)')}
              </strong>
              {(alergiasSeleccionadas.length > 0 || notasPersonalizadas.length > 0) && (
                <button
                  onClick={onLimpiarTodo}
                  style={{ border: 'none', background: 'transparent', color: '#dc2626', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('Restablecer todo')}
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '10px' }}>
              {CATALOGO_ALERGIAS_IFRA.filter((item) => item.frecuente).map((item) => {
                const activo = alergiasSeleccionadas.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={activo}
                    onClick={() => onToggleAlergia(item.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--m3-shape-md)',
                      border: activo ? '1.5px solid #dc2626' : '1px solid var(--m3-outline-variant)',
                      background: activo ? 'rgba(220, 38, 38, 0.08)' : 'var(--m3-surface-container-low)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      textAlign: 'left',
                      font: 'inherit',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: activo ? '#dc2626' : 'var(--m3-text-primary)' }}>
                        {t(item.nombre)}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '99px',
                          background: activo ? '#dc2626' : 'var(--m3-surface-container-high)',
                          color: activo ? '#fff' : 'var(--m3-text-secondary)',
                        }}
                      >
                        {activo ? t('ACTIVO') : t('Riesgo {nivel}', { nivel: t(item.riesgo) })}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--m3-primary)', display: 'block', marginBottom: '4px' }}>
                      {item.compuesto}
                    </span>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--m3-text-secondary)', lineHeight: 1.4 }}>
                      {t(item.explicacion)}
                    </p>
                  </button>
                );
              })}
            </div>

            <strong style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', display: 'block', margin: '16px 0 4px 0' }}>
              {t('Otros alérgenos que el envase debe declarar')}
            </strong>
            <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', color: 'var(--m3-text-tertiary)', lineHeight: 1.4 }}>
              {t('Aparecen en menos perfumes. Solo se pueden detectar con la lista de ingredientes del envase; pasa el cursor para ver de qué se trata.')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CATALOGO_ALERGIAS_IFRA.filter((item) => !item.frecuente).map((item) => {
                const activo = alergiasSeleccionadas.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={activo}
                    title={`${item.compuesto} · ${t('Riesgo {nivel}', { nivel: t(item.riesgo) })}. ${t(item.explicacion)}`}
                    onClick={() => onToggleAlergia(item.id)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '99px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: activo ? '1.5px solid #dc2626' : '1px solid var(--m3-outline-variant)',
                      background: activo ? 'rgba(220, 38, 38, 0.1)' : 'var(--m3-surface-container-low)',
                      color: activo ? '#dc2626' : 'var(--m3-text-primary)',
                    }}
                  >
                    {activo ? '✓ ' : ''}{t(item.nombre)}
                    <span style={{ fontWeight: 500, color: 'var(--m3-text-tertiary)' }}> · {t(item.riesgo)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Notas o ingredientes personalizados */}
          <div style={{ background: 'var(--m3-surface-container-low)', padding: '16px', borderRadius: 'var(--m3-shape-md)', border: '1px solid var(--m3-outline-variant)' }}>
            <strong style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
              {t('2. Notas o Ingredientes Personalizados')}
            </strong>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
              {t('Añade cualquier nota específica que no toleres (ej: Jazmín, Miel, Coco, Tabaco, Cuero, Oud):')}
            </p>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder={t('Escribe una nota (ej: Jazmín, Pachulí, Miel)...')}
                value={inputCustom}
                onChange={(e) => setInputCustom(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 13px',
                  borderRadius: '10px',
                  border: '1px solid var(--m3-outline)',
                  fontSize: '13px',
                  background: 'var(--m3-surface-container-lowest)',
                  color: 'var(--m3-text-primary)',
                }}
              />
              <button type="submit" className="m3-btn m3-btn-primary" style={{ fontSize: '12px' }}>
                <Plus size={15} /> {t('Añadir')}
              </button>
            </form>

            {notasPersonalizadas.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                {notasPersonalizadas.map((n) => (
                  <span
                    key={n}
                    style={{
                      background: 'rgba(220, 38, 38, 0.12)',
                      color: '#dc2626',
                      border: '1px solid rgba(220, 38, 38, 0.35)',
                      borderRadius: '99px',
                      padding: '4px 11px',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {n}
                    <button
                      type="button"
                      onClick={() => onEliminarNotaPersonalizada(n)}
                      style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', display: 'flex', padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="m3-modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', fontWeight: 600 }}>
            {tn(alergiasSeleccionadas.length + notasPersonalizadas.length, '{n} filtro activo', '{n} filtros activos')}
          </span>
          <button onClick={alCerrar} className="m3-btn m3-btn-primary">
            {t('Guardar Preferencias')}
          </button>
        </div>
      </div>
    </div>
  );
};
