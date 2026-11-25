// Pestaña "Guía de uso": sugerencias de la IA o consejos generales, y los tamaños que venden hoy las tiendas.
import { Droplets, Wind, Check } from 'lucide-react';
import { t } from '../i18n.ts';
import { type FichaFragancia } from '../tipos.ts';

// `tamanos`: los que de verdad venden las tiendas para este perfume (antes se mostraba siempre "50, 100 y 200 ml")
export function GuiaAplicacionCard({ ficha, tamanos = [] }: { ficha: FichaFragancia; tamanos?: number[] }) {
  // Sin la guía de la IA se muestran consejos generales, y se dice que lo son. 79 de 119 fichas guardadas copiaron tal
  // cual el ejemplo que traía el prompt ("Aplica tras la ducha…"): esas también son consejos generales.
  const deLaIA = !!ficha.guia_aplicacion;
  const guia = ficha.guia_aplicacion || {
    atomizaciones: t('3 a 4 atomizaciones (2 en lados del cuello, 1 en muñecas)'),
    puntos_pulso: [t('Cuello lateral'), t('Interior de las muñecas'), t('Detrás de las orejas'), t('Pecho')],
    consejo_experto: t('Aplica inmediatamente tras la ducha sobre piel limpia e hidratada. NUNCA frotes las muñecas entre sí, ya que la fricción destruye las moléculas de salida.'),
    clima_ideal: t('Excelente rendimiento en clima templado a cálido')
  };


  return (
    <div className="m3-app-guide-box">
      <div className="m3-guide-header">
        <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.15rem', color: 'var(--m3-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wind size={18} style={{ color: '#16a34a' }} /> {t('Protocolo de Aplicación y Fijación')}
        </h4>
        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '4px 10px', borderRadius: '99px', background: 'rgba(22, 163, 74, 0.14)', color: '#16a34a', textTransform: 'uppercase' }}>
          {deLaIA ? t('Sugerencias de la IA') : t('Consejos generales')}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--m3-text-tertiary)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
        {deLaIA
          ? t('Las escribió la IA para este perfume: son recomendaciones, no indicaciones de la marca.')
          : t('No hay sugerencias para este perfume: estos consejos sirven para cualquier perfume.')}
        {' '}{t('Los tamaños son los que venden hoy las tiendas.')}
      </p>

      <p style={{ fontSize: '13px', color: 'var(--m3-text-secondary)', margin: '6px 0 16px 0', lineHeight: 1.5 }}>
        {t('Optimiza el rendimiento de {nombre} según su concentración ({conc}) e intensidad ({int}).', { nombre: ficha.nombre, conc: ficha.concentracion, int: t(ficha.intensidad || 'Moderado') })}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div style={{ background: 'var(--m3-surface-container-lowest)', padding: '14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('Atomizaciones Ideales')}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-text-primary)' }}>
            {guia.atomizaciones}
          </p>
        </div>

        <div style={{ background: 'var(--m3-surface-container-lowest)', padding: '14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('Clima Recomendado')}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', fontWeight: 600, color: 'var(--m3-text-secondary)' }}>
            {guia.clima_ideal}
          </p>
        </div>

        <div style={{ background: 'var(--m3-surface-container-lowest)', padding: '14px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('Formatos Comerciales')}
          </span>
          {tamanos.length ? (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {tamanos.map(ml => (
                <span key={ml} className="m3-volume-badge">
                  <Droplets size={11} /> {ml} ml
                </span>
              ))}
            </div>
          ) : (
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--m3-text-secondary)' }}>
              {t('Ninguna oferta de hoy dice su tamaño.')}
            </p>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--m3-surface-container-lowest)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--m3-outline-variant)', marginBottom: '12px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
          {t('Puntos de Pulso Recomendados')}
        </span>
        <div className="m3-pulse-points-grid">
          {guia.puntos_pulso.map(pt => (
            <span key={pt} className="m3-pulse-chip">
              <Check size={12} style={{ color: '#16a34a' }} /> {pt}
            </span>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--m3-gold-soft)', border: '1px solid var(--m3-gold-border)', borderRadius: '12px', padding: '12px 16px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('Consejo del Maestro Perfumista')}
        </span>
        <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--m3-text-primary)', lineHeight: 1.5 }}>
          {guia.consejo_experto}
        </p>
      </div>
    </div>
  );
}
