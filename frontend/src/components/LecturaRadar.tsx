import React from 'react';
import { diferenciasOlfativas, loQueLoDistingue, SIGNIFICADO_EJES, type PerfilRadar } from '../lecturaRadar';
import { t } from '../i18n.ts';

// Debajo del radar del comparador: en qué se diferencian, para cuándo sirve cada uno y qué significa cada eje
export const LecturaRadar: React.FC<{ radar1: PerfilRadar; radar2: PerfilRadar; nombre1: string; nombre2: string }> = ({
  radar1,
  radar2,
  nombre1,
  nombre2,
}) => {
  const frases = diferenciasOlfativas(radar1, radar2, nombre1, nombre2);
  const caracter = (nombre: string, r: PerfilRadar, otro: PerfilRadar) => {
    const eje = SIGNIFICADO_EJES[loQueLoDistingue(r, otro)];
    return (
      <li>
        <strong>{nombre}</strong>: {t('lo que lo distingue es {eje} ({huele}); {cuando}.', { eje: t(eje.nombre).toLowerCase(), huele: t(eje.huele), cuando: t(eje.cuando) })}
      </li>
    );
  };
  return (
    <section
      aria-label={t('En palabras simples')}
      style={{ margin: '4px 0 18px', padding: '14px 16px', background: 'var(--m3-surface-container-low)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-lg)', fontSize: '13px', color: 'var(--m3-text-secondary)', lineHeight: 1.5 }}
    >
      <h5 style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--m3-text-primary)' }}>{t('En palabras simples')}</h5>
      <p style={{ margin: '0 0 8px' }}>
        {frases.length
          ? `${frases.join('; ')}.`
          : t('Huelen parecido: la diferencia está más en el precio y la duración que en el olor.')}
      </p>
      <ul style={{ margin: '0 0 8px', paddingLeft: '18px' }}>
        {caracter(nombre1, radar1, radar2)}
        {caracter(nombre2, radar2, radar1)}
      </ul>
      <SignificadoEjes />
    </section>
  );
};

// Qué significa cada eje del radar. Va bajo el radar del comparador y bajo el de la ficha de un perfume ("A qué huele")
export const SignificadoEjes = () => (
  <details>
    <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--m3-primary)' }}>{t('¿Qué significa cada eje?')}</summary>
    <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
      {Object.values(SIGNIFICADO_EJES).map((e) => (
        <li key={e.nombre}>
          <strong>{t(e.nombre)}</strong>: {t('{huele}. Alto = {cuando}.', { huele: t(e.huele), cuando: t(e.cuando) })}
        </li>
      ))}
    </ul>
    <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: 'var(--m3-text-tertiary)' }}>
      {t('Los puntajes se estiman a partir de las notas de cada perfume: sirven para comparar, no son una medición.')}
    </p>
  </details>
);
