// Pestaña "A qué huele": la ficha del perfume con su radar, su pirámide y de dónde sale.
import { Sparkles, ShoppingBag } from 'lucide-react';
import { RadarOlfativoChart } from './RadarOlfativoChart';
import { SignificadoEjes } from './LecturaRadar';
import { t, idioma } from '../i18n.ts';
import { type FichaFragancia } from '../tipos.ts';
import { obtenerRadarDeFicha } from '../ofertas.ts';

// Niveles de la pirámide sin notas repetidas (cada una queda en el primer nivel donde aparece) y sin niveles vacíos
function nivelesPiramide(ficha: FichaFragancia) {
  const vistas = new Set<string>();
  const unicas = (notas: string[] = []) =>
    notas.filter((n) => {
      const clave = n.trim().toLowerCase();
      if (!clave || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
  return [
    { titulo: t('Notas de Salida · Apertura (0 – 15 min)'), color: '#d97706', notas: unicas(ficha.notas_salida),
      chip: { background: 'var(--m3-gold-soft)', color: 'var(--m3-gold)', border: '1px solid var(--m3-gold-border)' } },
    { titulo: t('Notas de Corazón · Cuerpo Aromático (15 min – 3h)'), color: 'var(--m3-primary)', notas: unicas(ficha.notas_corazon),
      chip: { background: 'var(--m3-primary-container)', color: 'var(--m3-primary)' } },
    { titulo: t('Notas de Fondo · Fijación y Estela (3h+)'), color: 'var(--m3-secondary)', notas: unicas(ficha.notas_fondo),
      chip: { background: 'var(--m3-secondary-container)', color: 'var(--m3-secondary)' } },
  ].filter((nivel) => nivel.notas.length > 0);
}

// ─────────────────────────────────────────────
//  Componente: Ficha Olfativa, Radar 6D y Alergias
// ─────────────────────────────────────────────
export function FichaFraganciaCard({
  ficha,
  onVerSimilares,
  onGuardarFicha,
}: {
  ficha: FichaFragancia;
  onVerSimilares?: () => void;
  onGuardarFicha?: () => void;
}) {
  const PROYECCION_COLOR: Record<string, string> = {
    'Muy Baja': '#94a3b8', 'Baja': '#64748b', 'Media': '#2563eb', 'Alta': '#d97706', 'Bestia': '#dc2626',
  };
  const INTENSIDAD_COLOR: Record<string, string> = {
    'Ligero': '#22c55e', 'Moderado': '#2563eb', 'Intenso': '#d97706', 'Muy Intenso': '#dc2626',
  };

  const radarDatos = obtenerRadarDeFicha(ficha);

  return (
    <div className="m3-ficha-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {ficha.marca} · {ficha.concentracion}
          </span>
          <h3 className="m3-editorial-title" style={{ margin: '3px 0 0 0', fontSize: '1.65rem', color: 'var(--m3-text-primary)', fontWeight: 800 }}>
            {ficha.nombre}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onGuardarFicha && (
            <button onClick={onGuardarFicha} className="m3-btn m3-btn-tonal" style={{ fontSize: '12px' }}>
              <ShoppingBag size={14} /> {t('Guardar en Favoritos')}
            </button>
          )}
          {onVerSimilares && (
            <button onClick={onVerSimilares} className="m3-btn m3-btn-outlined" style={{ fontSize: '12px' }}>
              <Sparkles size={14} /> {t('Ver Similares')}
            </button>
          )}
        </div>
      </div>

      {/* El semáforo de alergias va arriba de la ficha, siempre visible: aquí no se repite */}
      <p style={{ fontSize: '14px', color: 'var(--m3-text-secondary)', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.6 }}>
        "{ficha.descripcion}"
      </p>
      <FuenteFicha ficha={ficha} />

      {/* Radar Olfativo Visual 6D */}
      <RadarOlfativoChart radar1={radarDatos} nombre1={ficha.nombre} />
      <div style={{ margin: '-6px 0 18px', padding: '10px 14px', background: 'var(--m3-surface-container-low)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-lg)', fontSize: '13px', color: 'var(--m3-text-secondary)', lineHeight: 1.5 }}>
        <SignificadoEjes />
      </div>

      {/* Grid de atributos M3 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
        background: 'var(--m3-surface-container-lowest)',
        padding: '18px',
        borderRadius: 'var(--m3-shape-lg)',
        border: '1px solid var(--m3-outline-variant)'
      }}>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>{t('Familia')}</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)' }}>{ficha.familia_olfativa}</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>{t('Género')}</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)' }}>{t(ficha.genero)}</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>{t('Longevidad')}</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#15803d' }}>{t('~{n} horas', { n: ficha.duracion_horas })}</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>{t('Proyección')}</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: PROYECCION_COLOR[ficha.proyeccion] ?? 'var(--m3-text-primary)' }}>{t(ficha.proyeccion)}</span>
        </div>
        {ficha.intensidad && (
          <div>
            <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>{t('Intensidad')}</span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: INTENSIDAD_COLOR[ficha.intensidad] ?? 'var(--m3-text-primary)' }}>{t(ficha.intensidad)}</span>
          </div>
        )}
        {ficha.mejor_momento_dia && (
          <div>
            <span style={{ fontSize: '10px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, display: 'block' }}>{t('Momento')}</span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)' }}>{t(ficha.mejor_momento_dia)}</span>
          </div>
        )}
      </div>

      {/* Acordes Principales */}
      {ficha.acordes_principales && ficha.acordes_principales.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>
            {t('Acordes Dominantes')}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {ficha.acordes_principales.map(a => (
              <span key={a} style={{
                background: 'var(--m3-primary-container)', color: 'var(--m3-primary)',
                borderRadius: 'var(--m3-shape-full)', padding: '5px 13px', fontSize: '12px', fontWeight: 700
              }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pirámide Olfativa Visual: cada nota en su primer nivel (la IA y el catálogo a veces la repiten) */}
      <div style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-lg)', padding: '18px', display: 'grid', gap: '14px' }}>
        {nivelesPiramide(ficha).map((nivel) => (
          <div key={nivel.titulo}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: nivel.color, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
              {nivel.titulo}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {nivel.notas.map((n) => (
                <span key={n} style={{ ...nivel.chip, borderRadius: 'var(--m3-shape-full)', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Componente: Guía de Aplicación & ML (M3)
// ─────────────────────────────────────────────
// De dónde sale cada ficha, dicho en la pantalla: la de la IA se veía igual que una pirámide oficial
function textoFuenteFicha(ficha: FichaFragancia): string {
  switch (ficha.origen) {
    case 'tiendas':
      return t('Lanzamiento reciente: las notas salen de lo que publican las tiendas, no de la pirámide oficial de la marca. La duración, la proyección y las ocasiones las estimó la IA.');
    case 'curada':
      return t('Ficha de respaldo escrita a mano (la IA no respondió). La duración y la proyección son aproximadas.');
    case 'catalogo':
      return t('Resumen guardado en el catálogo de PerfumeScan. Para la ficha completa, busca el perfume en las 4 tiendas en vivo.');
    default:
      return t('Ficha escrita por la IA (Azure OpenAI o Gemini) con lo que sabe del perfume. Suele acertar en los perfumes conocidos, pero no la verifica una fuente oficial; la duración, la proyección y las ocasiones son estimaciones.');
  }
}

export function FuenteFicha({ ficha, compacta = false }: { ficha: FichaFragancia; compacta?: boolean }) {
  return (
    <p style={{ fontSize: compacta ? '11.5px' : '12.5px', color: 'var(--m3-text-secondary)', margin: compacta ? '8px 0 0 0' : '-10px 0 20px 0', lineHeight: 1.5 }}>
      <strong>{t('Fuente:')}</strong> {textoFuenteFicha(ficha)}
      {idioma() === 'en' && !ficha.en && ficha.origen !== 'catalogo' && ` ${t('Esta ficha todavía está solo en español.')}`}
      {!compacta && ` ${t('El perfil olfativo lo calcula PerfumeScan a partir de las notas.')}`}
    </p>
  );
}
