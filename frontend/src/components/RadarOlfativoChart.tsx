import React from 'react';
import { Activity, Waves, Sparkles, Trees, Flame, Flower2, Zap } from 'lucide-react';

export interface DatosRadar {
  frescura: number;
  dulzor: number;
  amaderado: number;
  especiado: number;
  floral: number;
  intensidad: number;
}

interface RadarProps {
  radar1: DatosRadar;
  nombre1: string;
  radar2?: DatosRadar | null;
  nombre2?: string;
  size?: number;
}

const EJES: { key: keyof DatosRadar; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number }> }[] = [
  { key: 'frescura', label: 'Frescura', Icon: Waves },
  { key: 'dulzor', label: 'Dulzor', Icon: Sparkles },
  { key: 'amaderado', label: 'Amaderado', Icon: Trees },
  { key: 'especiado', label: 'Especiado', Icon: Flame },
  { key: 'floral', label: 'Floral', Icon: Flower2 },
  { key: 'intensidad', label: 'Fijación', Icon: Zap },
];

export const RadarOlfativoChart: React.FC<RadarProps> = ({
  radar1,
  nombre1,
  radar2,
  nombre2,
  size = 270,
}) => {
  const center = size / 2;
  const radius = size * 0.34;
  const niveles = [0.25, 0.5, 0.75, 1];

  const getCoords = (valor: number, index: number, total: number) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const r = (Math.max(10, Math.min(100, valor)) / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const getPolygonPoints = (datos: DatosRadar) =>
    EJES.map((eje, idx) => {
      const pt = getCoords(datos[eje.key] || 30, idx, EJES.length);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    }).join(' ');

  return (
    <div className="m3-radar-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} strokeWidth={2.2} /> Mapa Sensorial 6D
          </span>
          <h4 className="m3-editorial-title" style={{ margin: '2px 0 0 0', fontSize: '1.1rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
            Arquitectura de Acordes e Intensidad
          </h4>
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '14px', fontSize: '12px', fontWeight: 700 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#4f46e5' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4f46e5', display: 'inline-block', boxShadow: '0 0 8px rgba(79,70,229,0.5)' }} />
            {nombre1}
          </span>
          {radar2 && nombre2 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0d9488' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0d9488', display: 'inline-block', boxShadow: '0 0 8px rgba(13,148,136,0.5)' }} />
              {nombre2}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '24px' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', maxWidth: '100%' }}>
          <defs>
            <radialGradient id="radarGrad1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#3730a3" stopOpacity="0.14" />
            </radialGradient>
            <radialGradient id="radarGrad2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.12" />
            </radialGradient>
          </defs>

          {/* Anillos hexagonales de referencia */}
          {niveles.map((nivel, nIdx) => {
            const pts = EJES.map((_, idx) => {
              const pt = getCoords(nivel * 100, idx, EJES.length);
              return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
            }).join(' ');
            return (
              <polygon
                key={nIdx}
                points={pts}
                fill={nIdx === niveles.length - 1 ? 'rgba(99, 102, 241, 0.03)' : 'none'}
                stroke="var(--m3-outline-variant)"
                strokeWidth="1"
                strokeDasharray={nIdx < niveles.length - 1 ? '3 3' : undefined}
              />
            );
          })}

          {/* Ejes radiales */}
          {EJES.map((_, idx) => {
            const end = getCoords(100, idx, EJES.length);
            return (
              <line
                key={idx}
                x1={center}
                y1={center}
                x2={end.x}
                y2={end.y}
                stroke="var(--m3-outline-variant)"
                strokeWidth="1"
              />
            );
          })}

          {/* Polígono Perfume 2 */}
          {radar2 && (
            <>
              <polygon
                points={getPolygonPoints(radar2)}
                fill="url(#radarGrad2)"
                stroke="#0d9488"
                strokeWidth="2.5"
              />
              {EJES.map((eje, idx) => {
                const pt = getCoords(radar2[eje.key] || 30, idx, EJES.length);
                return <circle key={idx} cx={pt.x} cy={pt.y} r="4" fill="#0d9488" stroke="#ffffff" strokeWidth="1.2" />;
              })}
            </>
          )}

          {/* Polígono Perfume 1 */}
          <polygon
            points={getPolygonPoints(radar1)}
            fill="url(#radarGrad1)"
            stroke="#4f46e5"
            strokeWidth="2.5"
          />
          {EJES.map((eje, idx) => {
            const pt = getCoords(radar1[eje.key] || 30, idx, EJES.length);
            return <circle key={idx} cx={pt.x} cy={pt.y} r="4.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />;
          })}

          {/* Etiquetas de cada vértice */}
          {EJES.map((eje, idx) => {
            const angle = (Math.PI * 2 * idx) / EJES.length - Math.PI / 2;
            const labelRadius = radius + 28;
            const lx = center + labelRadius * Math.cos(angle);
            const ly = center + labelRadius * Math.sin(angle);
            return (
              <text
                key={eje.key}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  fill: 'var(--m3-text-primary)',
                  letterSpacing: '0.02em',
                }}
              >
                {eje.label}
              </text>
            );
          })}
        </svg>

        {/* Barras comparativas numéricas al costado */}
        <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '9px', minWidth: '210px' }}>
          {EJES.map((eje) => {
            const Icon = eje.Icon;
            const v1 = radar1[eje.key] || 30;
            const v2 = radar2 ? (radar2[eje.key] || 30) : null;
            return (
              <div key={eje.key} style={{ fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 700, color: 'var(--m3-text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Icon size={13} strokeWidth={2.2} /> {eje.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    <strong style={{ color: '#4f46e5' }}>{v1}%</strong>
                    {v2 !== null && <strong style={{ color: '#0d9488', marginLeft: '6px' }}>vs {v2}%</strong>}
                  </span>
                </div>
                <div style={{ height: '6px', background: 'var(--m3-surface-container-high)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${v1}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #6366f1, #3730a3)',
                      borderRadius: '99px',
                      transition: 'width 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </div>
                {v2 !== null && (
                  <div style={{ height: '5px', background: 'var(--m3-surface-container-high)', borderRadius: '99px', overflow: 'hidden', marginTop: '3px' }}>
                    <div
                      style={{
                        width: `${v2}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #2dd4bf, #0d9488)',
                        borderRadius: '99px',
                        transition: 'width 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
