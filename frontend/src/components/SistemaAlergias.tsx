import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FlaskConical,
  Plus,
  X,
  SlidersHorizontal,
} from 'lucide-react';

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
}

export const CATALOGO_ALERGIAS_IFRA: DefinicionAlergiaUsuario[] = [
  {
    id: 'limonene',
    compuesto: 'D-Limonene',
    nombre: 'Cítricos / Bergamota / Limón',
    keywords: ['bergamota', 'limón', 'limon', 'naranja', 'mandarina', 'pomelo', 'toronja', 'cítrico', 'citrico', 'cítricos', 'citricos', 'yuzu', 'lima', 'neroli'],
    riesgo: 'Moderado',
    explicacion: 'Presente en cáscaras de cítricos. Al oxidarse en pieles sensibles puede causar enrojecimiento o fotosensibilidad.',
  },
  {
    id: 'linalool',
    compuesto: 'Linalool',
    nombre: 'Lavanda / Neroli / Flores Blancas',
    keywords: ['lavanda', 'neroli', 'cilantro', 'albahaca', 'jazmín', 'jazmin', 'flor de azahar', 'azahar', 'salvia', 'geranio'],
    riesgo: 'Moderado',
    explicacion: 'Terpeno floral muy común en aguas de colonia y fougères. Regulado por la directiva europea de cosméticos.',
  },
  {
    id: 'cinnamal',
    compuesto: 'Cinnamal (Cinamaldehído)',
    nombre: 'Canela / Especias Cálidas',
    keywords: ['canela', 'cassia', 'especias cálidas', 'cardamomo', 'nuez moscada'],
    riesgo: 'Alto',
    explicacion: 'Uno de los alérgenos de contacto más reactivos en perfumería oriental e invernal según normas IFRA.',
  },
  {
    id: 'eugenol',
    compuesto: 'Eugenol / Isoeugenol',
    nombre: 'Clavo de Olor / Pimienta Picante',
    keywords: ['clavo', 'pimienta', 'pimienta rosa', 'pimienta negra', 'sichuan', 'nuez moscada', 'especias'],
    riesgo: 'Alto',
    explicacion: 'Compuesto aromático presente en especias intensas. Puede desencadenar irritación local en cuello y muñecas.',
  },
  {
    id: 'coumarin',
    compuesto: 'Coumarin (Cumarina)',
    nombre: 'Haba Tonka / Vainilla / Almendra',
    keywords: ['haba tonka', 'tonka', 'vainilla', 'almendra', 'cacao', 'praliné', 'praline', 'caramelo'],
    riesgo: 'Moderado',
    explicacion: 'Clásico fijador dulce en perfumes gourmand y nocturnos.',
  },
  {
    id: 'oakmoss',
    compuesto: 'Evernia Prunastri',
    nombre: 'Musgo de Roble / Pachulí / Tierra',
    keywords: ['musgo', 'musgo de roble', 'roble', 'liquen', 'chipre', 'fougère', 'fougere', 'vetiver', 'pachulí', 'pachuli'],
    riesgo: 'Alto',
    explicacion: 'Extracto botánico fuertemente restringido por IFRA debido a su contenido de atranol y cloroatranol.',
  },
  {
    id: 'citral',
    compuesto: 'Citral (Geranial)',
    nombre: 'Verbena / Hierba Limón / Jengibre',
    keywords: ['verbena', 'lemongrass', 'hierba limón', 'jengibre', 'cidra', 'petitgrain'],
    riesgo: 'Moderado',
    explicacion: 'Aldehído cítrico de gran potencia fresca que puede irritar pieles con dermatitis atópica.',
  },
  {
    id: 'geraniol',
    compuesto: 'Geraniol / Citronellol',
    nombre: 'Rosa / Peonía / Geranio',
    keywords: ['rosa', 'geranio', 'peonía', 'peonia', 'magnolia', 'lirio', 'tuberosa', 'nardo'],
    riesgo: 'Bajo',
    explicacion: 'Componente primario de aceites esenciales de rosas y buqués florales.',
  },
];

export interface ResultadoEvaluacionAlergia {
  estado: 'sin_configurar' | 'seguro' | 'precaucion' | 'peligro';
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

  const todosMap = new Map<string, AlergenoDetectado>();
  if (Array.isArray(ficha.alergenos_detectados)) {
    for (const a of ficha.alergenos_detectados) {
      if (a && a.id) todosMap.set(a.id, a);
    }
  }
  for (const cat of CATALOGO_ALERGIAS_IFRA) {
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
    const matchesKeywords = def.keywords.filter((kw) => notasPerfume.includes(kw));

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
        nombre: `Sensibilidad a "${custom}"`,
        compuesto: 'Ingrediente / Nota directa',
        origen: custom,
        riesgo: 'Alto',
      });
    }
  }

  if (coincidencias.length === 0) {
    return {
      estado: 'seguro',
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
  if (!ficha) return null;
  const evalResult = evaluarRiesgoAlergia(ficha, alergiasIds, notasCustom);
  const totalConfiguradas = alergiasIds.length + notasCustom.length;

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
            <strong>Seguridad Dermatológica IFRA:</strong> Se identificaron{' '}
            <strong>{evalResult.todosLosAlergenosDelPerfume.length}</strong> compuestos regulados ({evalResult.todosLosAlergenosDelPerfume.map(a => a.compuesto_quimico.split(' ')[0]).slice(0, 3).join(', ') || 'ninguno crítico'}). Configura tu perfil para recibir alertas.
          </span>
        </div>
        <button onClick={onAbrirConfig} className="m3-btn m3-btn-tonal" style={{ fontSize: '11.5px', padding: '6px 13px' }}>
          <SlidersHorizontal size={13} /> Configurar alergias
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
              Compatible con tu Perfil Dermatológico ({totalConfiguradas} filtro{totalConfiguradas !== 1 ? 's' : ''} activo{totalConfiguradas !== 1 ? 's' : ''})
            </strong>
            {!compacto && (
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Libre de tus alérgenos y notas restringidas en la pirámide olfativa de {ficha.nombre}.
              </span>
            )}
          </div>
        </div>
        <button onClick={onAbrirConfig} className="m3-btn m3-btn-tonal" style={{ fontSize: '11px', padding: '5px 11px' }}>
          <SlidersHorizontal size={12} /> Perfil
        </button>
      </div>
    );
  }

  const esPeligro = evalResult.estado === 'peligro';
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
                ? `Alerta de Alergia: ${ficha.nombre} contiene compuestos incompatibles con tu piel`
                : `Precaución Dermatológica: Detectamos compuestos sensibles para tu perfil`}
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
                  <strong>{c.nombre}</strong> ({c.compuesto}) · Presente en: <em>{c.origen}</em>
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
          <SlidersHorizontal size={12} /> Mis Alergias
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
      <div className="m3-modal-card" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FlaskConical size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
                Perfil de Alergias y Sensibilidad Cutánea
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Monitoreo automático de alérgenos IFRA y notas olfativas que te provoquen irritación o migraña.
              </span>
            </div>
          </div>
          <button
            onClick={alCerrar}
            className="m3-search-clear"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="m3-modal-body">
          {/* 1. Catálogo IFRA */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                1. Compuestos Químicos Regulados (Estándar IFRA / UE)
              </strong>
              {(alergiasSeleccionadas.length > 0 || notasPersonalizadas.length > 0) && (
                <button
                  onClick={onLimpiarTodo}
                  style={{ border: 'none', background: 'transparent', color: '#dc2626', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Restablecer todo
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '10px' }}>
              {CATALOGO_ALERGIAS_IFRA.map((item) => {
                const activo = alergiasSeleccionadas.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onToggleAlergia(item.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--m3-shape-md)',
                      border: activo ? '1.5px solid #dc2626' : '1px solid var(--m3-outline-variant)',
                      background: activo ? 'rgba(220, 38, 38, 0.08)' : 'var(--m3-surface-container-low)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: activo ? '#dc2626' : 'var(--m3-text-primary)' }}>
                        {item.nombre}
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
                        {activo ? 'ACTIVO' : `Riesgo ${item.riesgo}`}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--m3-primary)', display: 'block', marginBottom: '4px' }}>
                      {item.compuesto}
                    </span>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--m3-text-secondary)', lineHeight: 1.4 }}>
                      {item.explicacion}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Notas o ingredientes personalizados */}
          <div style={{ background: 'var(--m3-surface-container-low)', padding: '16px', borderRadius: 'var(--m3-shape-md)', border: '1px solid var(--m3-outline-variant)' }}>
            <strong style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
              2. Notas o Ingredientes Personalizados
            </strong>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
              Añade cualquier nota específica que no toleres (ej: <em>Jazmín, Miel, Coco, Tabaco, Cuero, Oud</em>):
            </p>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Escribe una nota (ej: Jazmín, Pachulí, Miel)..."
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
                <Plus size={15} /> Añadir
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
            {alergiasSeleccionadas.length + notasPersonalizadas.length} filtro(s) dermatológico(s) activo(s)
          </span>
          <button onClick={alCerrar} className="m3-btn m3-btn-primary">
            Guardar Preferencias
          </button>
        </div>
      </div>
    </div>
  );
};
