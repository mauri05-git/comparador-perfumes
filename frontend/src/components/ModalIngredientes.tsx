// Ventana "¿Qué contiene este perfume?": la lista del envase, su composición aproximada y los alérgenos declarados.
import { type ReactNode, type CSSProperties } from 'react';
import { Droplets, X } from 'lucide-react';
import { esListaResumida, leerIngredientes, type TipoIngrediente } from '../ingredientes';
import { t } from '../i18n.ts';
import { type PrecioMercado } from '../tipos.ts';

const COLOR_INGREDIENTE: Record<TipoIngrediente, string> = {
  solvente: '#94a3b8', fragancia: 'var(--m3-primary)', agua: '#38bdf8', alergeno: '#d97706',
  filtro_uv: '#8b5cf6', colorante: '#ec4899', estabilizante: '#14b8a6', otro: '#a3a3a3',
};

const NOMBRE_PRINCIPAL: Partial<Record<TipoIngrediente, string>> = { solvente: 'Alcohol', fragancia: 'Aroma (fragancia)', agua: 'Agua' };

const ETIQUETA_TIPO: Partial<Record<TipoIngrediente, string>> = { filtro_uv: 'Filtro UV', colorante: 'Colorante', estabilizante: 'Estabilizante', otro: 'Otro' };

function TituloSeccion({ children }: { children: ReactNode }) {
  return <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--m3-text-secondary)' }}>{children}</h4>;
}

// Ventana con la lista del envase: composición aproximada, alérgenos declarados y el resto
export function ModalIngredientes({ oferta, concentracion, alCerrar }: { oferta: PrecioMercado; concentracion?: string | null; alCerrar: () => void }) {
  const lectura = leerIngredientes(oferta.ingredientes, concentracion);
  // Solo se abre con una lista real; algunas tiendas ponen notas ("Limón Siciliano, Cedro") en el campo de ingredientes
  if (!lectura) return null;
  const principales = lectura.items.filter((i) => NOMBRE_PRINCIPAL[i.tipo]);
  const alergenos = lectura.items.filter((i) => i.tipo === 'alergeno');
  const otros = lectura.items.filter((i) => !NOMBRE_PRINCIPAL[i.tipo] && i.tipo !== 'alergeno');
  const resto = Math.max(2, 100 - principales.reduce((s, i) => s + i.aprox, 0));
  const total = principales.reduce((s, i) => s + i.aprox, 0) + resto;
  const chip = (color: string): CSSProperties => ({ padding: '5px 10px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, border: `1px solid ${color}`, color: 'var(--m3-text-primary)', background: 'var(--m3-surface-container-low)' });

  return (
    <div className="m3-modal-backdrop" onClick={alCerrar}>
      <div className="m3-modal-card" role="dialog" aria-modal="true" aria-labelledby="titulo-ingredientes" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '11px', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Droplets size={20} strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 id="titulo-ingredientes" className="m3-editorial-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
                {t('¿Qué contiene este perfume?')}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                {oferta.ingredientesOrigen ? (
                  <>
                    {t('{tienda} no publica la lista de este producto. Es la del envase de “{nombre}” ({otra}): el mismo perfume y concentración en otra presentación, misma fórmula.', { tienda: oferta.tienda, nombre: oferta.ingredientesOrigen.nombre, otra: oferta.ingredientesOrigen.tienda })}
                  </>
                ) : (
                  <>{t('Lista del envase publicada por {tienda} para “{nombre}”', { tienda: oferta.tienda, nombre: oferta.nombre })}</>
                )}
              </span>
            </div>
          </div>
          <button onClick={alCerrar} className="m3-search-clear" title={t('Cerrar')} aria-label={t('Cerrar')}>
            <X size={20} />
          </button>
        </div>

        <div className="m3-modal-body" style={{ display: 'grid', gap: '22px', fontSize: '13px', color: 'var(--m3-text-secondary)' }}>
          <>
              <section>
                <TituloSeccion>{t('Composición aproximada')}</TituloSeccion>
                <div aria-hidden="true" style={{ display: 'flex', height: '18px', borderRadius: '9px', overflow: 'hidden', background: 'var(--m3-surface-container-high)' }}>
                  {principales.map((i) => <span key={i.tipo} style={{ width: `${(i.aprox / total) * 100}%`, background: COLOR_INGREDIENTE[i.tipo] }} />)}
                  <span style={{ width: `${(resto / total) * 100}%`, background: COLOR_INGREDIENTE.alergeno }} />
                </div>
                <ul style={{ listStyle: 'none', margin: '10px 0 0 0', padding: 0, display: 'grid', gap: '6px' }}>
                  {[...principales, null].map((i) => (
                    <li key={i?.tipo ?? 'resto'} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0,1fr) auto', gap: '8px', alignItems: 'baseline' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: COLOR_INGREDIENTE[i?.tipo ?? 'alergeno'] }} />
                      <span>
                        <strong style={{ color: 'var(--m3-text-primary)' }}>{i ? t(NOMBRE_PRINCIPAL[i.tipo] ?? '') : t('Todo lo demás')}</strong>
                        {' · '}{i ? t(i.funcion) : t('alérgenos, filtros y colorantes, cada uno bajo 1 %')}
                      </span>
                      <strong style={{ color: 'var(--m3-text-primary)', whiteSpace: 'nowrap' }}>{i ? t(i.cantidad) : '< 2 %'}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              {esListaResumida(lectura) && (
                <p style={{ margin: 0, padding: '10px 12px', borderRadius: '10px', border: '1px dashed #d97706', color: 'var(--m3-text-primary)', lineHeight: 1.45 }}>
                  <strong>{t('Lista resumida por la tienda:')}</strong> {t('solo copió alcohol, aroma y agua. El envase real casi siempre declara alérgenos (linalool, limonene…), así que esta lista no sirve para descartarlos: revisa la caja antes de comprar.')}
                </p>
              )}

              {alergenos.length > 0 && (
                <section>
                  <TituloSeccion>{t('Alérgenos declarados ({n})', { n: alergenos.length })}</TituloSeccion>
                  <p style={{ margin: '0 0 8px 0', lineHeight: 1.45 }}>
                    {t('Moléculas del aroma que la ley obliga a declarar cuando superan 0,001 %. Son trazas, normalmente bajo 1 %, pero pueden causar reacción en pieles sensibles.')}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {alergenos.map((i) => <span key={i.nombre} style={chip(COLOR_INGREDIENTE.alergeno)}>{i.nombre}</span>)}
                  </div>
                </section>
              )}

              {otros.length > 0 && (
                <section>
                  <TituloSeccion>{t('Otros componentes (menos de 1 % cada uno)')}</TituloSeccion>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {otros.map((i) => (
                      <span key={i.nombre} title={t(i.funcion)} style={chip(COLOR_INGREDIENTE[i.tipo])}>
                        {i.nombre} <span style={{ color: 'var(--m3-text-tertiary)', fontWeight: 500 }}>· {t(ETIQUETA_TIPO[i.tipo] ?? '')}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: 'var(--m3-text-tertiary)' }}>
                {lectura.concentracion
                  ? t('El envase no indica porcentajes. Los ingredientes van de mayor a menor cantidad, así que los rangos son los típicos de un {tipo}, no valores medidos.', { tipo: lectura.concentracion })
                  : t('El envase no indica porcentajes. Los ingredientes van de mayor a menor cantidad, así que los rangos son los típicos de un perfume, no valores medidos.')}
              </p>
            </>
        </div>
      </div>
    </div>
  );
}
