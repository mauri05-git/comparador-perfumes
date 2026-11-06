import React, { useState, useEffect } from 'react';
import {
  Terminal,
  RefreshCw,
  Trash2,
  X,
  Search,
  Zap,
  Cpu,
  Clock,
} from 'lucide-react';

export interface EntradaLogSistema {
  id: string;
  timestamp: string;
  nivel: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'CACHE';
  modulo: string;
  mensaje: string;
  duracion_ms?: number;
  detalles?: Record<string, any>;
}

export interface EstadisticasBackend {
  inicio_servidor?: string;
  total_busquedas: number;
  total_comparaciones: number;
  total_escaneos_foto: number;
  cache_hits: number;
  cache_misses: number;
  llamadas_ia_exitosas: number;
  errores_ia: number;
  ultimo_modelo_ia: string;
  entradas_en_cache?: number;
}

export const ConsolaLogsModal: React.FC<{
  abierto: boolean;
  alCerrar: () => void;
  apiBase: string;
  logsCliente: EntradaLogSistema[];
  onLimpiarLogsCliente: () => void;
}> = ({ abierto, alCerrar, apiBase, logsCliente, onLimpiarLogsCliente }) => {
  const [logsBackend, setLogsBackend] = useState<EntradaLogSistema[]>([]);
  const [stats, setStats] = useState<EstadisticasBackend | null>(null);
  const [filtroNivel, setFiltroNivel] = useState<string>('TODOS');
  const [cargando, setCargando] = useState(false);

  const cargarLogsServidor = async () => {
    setCargando(true);
    try {
      const resp = await fetch(`${apiBase}/api/logs`);
      const data = await resp.json();
      if (data.success) {
        setLogsBackend(data.logs || []);
        setStats(data.estadisticas || null);
      }
    } catch {
      // Fallback: logs de cliente
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto) {
      cargarLogsServidor();
    }
  }, [abierto]);

  if (!abierto) return null;

  const todosLosLogs = [...logsCliente, ...logsBackend].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const logsFiltrados =
    filtroNivel === 'TODOS'
      ? todosLosLogs
      : todosLosLogs.filter((l) => l.nivel === filtroNivel);

  const limpiarTodo = async () => {
    onLimpiarLogsCliente();
    try {
      await fetch(`${apiBase}/api/logs`, { method: 'DELETE' });
      await cargarLogsServidor();
    } catch {
      setLogsBackend([]);
    }
  };

  const COLOR_NIVEL: Record<string, { bg: string; color: string }> = {
    SUCCESS: { bg: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' },
    INFO: { bg: 'rgba(99, 102, 241, 0.25)', color: '#818cf8' },
    CACHE: { bg: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24' },
    WARN: { bg: 'rgba(249, 115, 22, 0.25)', color: '#fb923c' },
    ERROR: { bg: 'rgba(239, 68, 68, 0.25)', color: '#f87171' },
  };

  return (
    <div className="m3-modal-backdrop" onClick={alCerrar}>
      <div className="m3-modal-card" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Terminal size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
                Consola de Logs y Telemetría del Sistema
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                Trazabilidad en milisegundos (ms) de scraping paralelo, motor Gemini/Azure y caché en memoria.
              </span>
            </div>
          </div>
          <button onClick={alCerrar} className="m3-search-clear" title="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="m3-modal-body">
          {/* Métricas KPI del Servidor */}
          {stats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                gap: '10px',
              }}
            >
              <div style={{ background: 'var(--m3-surface-container-low)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Search size={12} /> Consultas
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--m3-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {stats.total_busquedas + stats.total_comparaciones}
                </div>
              </div>

              <div style={{ background: 'var(--m3-surface-container-low)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Zap size={12} /> Cache Hits
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {stats.cache_hits} <span style={{ fontSize: '11px', fontWeight: 600 }}>({stats.entradas_en_cache || 0} RAM)</span>
                </div>
              </div>

              <div style={{ background: 'var(--m3-surface-container-low)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Cpu size={12} /> Inferencias IA
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {stats.llamadas_ia_exitosas}
                </div>
              </div>

              <div style={{ background: 'var(--m3-surface-container-low)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={12} /> Modelo Activo
                </span>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--m3-text-primary)', fontFamily: 'var(--font-mono)', marginTop: '5px', wordBreak: 'break-all' }}>
                  {stats.ultimo_modelo_ia}
                </div>
              </div>
            </div>
          )}

          {/* Barra de herramientas y filtros */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['TODOS', 'SUCCESS', 'CACHE', 'INFO', 'WARN', 'ERROR'].map((niv) => (
                <button
                  key={niv}
                  onClick={() => setFiltroNivel(niv)}
                  className={`m3-chip ${filtroNivel === niv ? 'active' : ''}`}
                  style={{ fontSize: '11px', padding: '5px 11px', fontFamily: 'var(--font-mono)' }}
                >
                  {niv}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={cargarLogsServidor}
                disabled={cargando}
                className="m3-btn m3-btn-tonal"
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                <RefreshCw size={13} /> {cargando ? 'Actualizando...' : 'Refrescar'}
              </button>
              <button
                onClick={limpiarTodo}
                className="m3-btn m3-btn-tonal"
                style={{ fontSize: '11px', padding: '6px 12px', color: '#dc2626' }}
              >
                <Trash2 size={13} /> Limpiar
              </button>
            </div>
          </div>

          {/* Terminal de eventos */}
          <div
            style={{
              background: '#090d16',
              color: '#e2e8f0',
              borderRadius: '14px',
              padding: '16px',
              maxHeight: '340px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              border: '1px solid #1e293b',
            }}
          >
            {logsFiltrados.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '28px' }}>
                Sin eventos registrados para este filtro. Ejecuta una búsqueda o comparación para observar la telemetría.
              </div>
            ) : (
              logsFiltrados.map((log) => {
                const badge = COLOR_NIVEL[log.nivel] || COLOR_NIVEL.INFO;
                const hora = new Date(log.timestamp).toLocaleTimeString('es-CL', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                return (
                  <div
                    key={log.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      paddingBottom: '7px',
                      lineHeight: 1.45,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>{hora}</span>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          padding: '1px 7px',
                          borderRadius: '5px',
                          fontSize: '10px',
                          fontWeight: 700,
                        }}
                      >
                        {log.nivel}
                      </span>
                      <span
                        style={{
                          background: '#1e293b',
                          color: '#38bdf8',
                          padding: '1px 7px',
                          borderRadius: '5px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                        }}
                      >
                        {log.modulo}
                      </span>
                      {log.duracion_ms !== undefined && (
                        <span style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 700 }}>
                          {log.duracion_ms}ms
                        </span>
                      )}
                      <span style={{ color: '#f1f5f9', flex: 1 }}>{log.mensaje}</span>
                    </div>
                    {log.detalles && Object.keys(log.detalles).length > 0 && (
                      <div style={{ marginTop: '4px', paddingLeft: '14px', color: '#94a3b8', fontSize: '11px' }}>
                        ↳ {JSON.stringify(log.detalles)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="m3-modal-footer">
          <button onClick={alCerrar} className="m3-btn m3-btn-primary">
            Cerrar Consola
          </button>
        </div>
      </div>
    </div>
  );
};
