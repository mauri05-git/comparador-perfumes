// Pestaña "Reseñas": las de la comunidad y el formulario para publicar, editar o borrar la propia.
import { useState } from 'react';
import { Star } from 'lucide-react';
import { t, tn, tServidor } from '../i18n.ts';
import { type Review } from '../tipos.ts';
import { API_BASE } from '../api.ts';

// ─────────────────────────────────────────────
//  Componente: Reseñas de la Comunidad (M3)
// ─────────────────────────────────────────────
export function ReviewsSection({
  perfumeNombre,
  reviews,
  mias,
  cuenta,
  onEntrar,
  onCambio,
}: {
  perfumeNombre: string;
  reviews: Review[];
  mias: string[];
  cuenta: { email: string } | null;
  onEntrar: () => void;
  onCambio: (reviews: Review[], mias: string[]) => void;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [rating, setRating] = useState(5);
  const [duracion, setDuracion] = useState(8);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const yaOpine = reviews.some(r => mias.includes(r.id));

  const promedio = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "Sin valoraciones";

  const enviarReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfume: perfumeNombre, usuario, rating, duracion_horas: duracion, comentario }),
      });
      const data = await resp.json();
      if (!data.success) {
        setError(tServidor(data.mensaje) || t('No se pudo publicar la reseña.'));
        return;
      }
      // Publicar otra vez reemplaza la reseña anterior de la misma cuenta
      onCambio([data.review, ...reviews.filter(r => !mias.includes(r.id))], [data.review.id]);
      setComentario('');
      setMostrarForm(false);
    } catch {
      setError(t('No se pudo conectar con el servidor.'));
    } finally {
      setEnviando(false);
    }
  };

  const borrarReview = async (id: string) => {
    if (!window.confirm(t('¿Borrar tu reseña?'))) return;
    try {
      const resp = await fetch(`${API_BASE}/api/reviews/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      if (resp.ok) onCambio(reviews.filter(r => r.id !== id), mias.filter(m => m !== id));
    } catch {
      setError(t('No se pudo conectar con el servidor.'));
    }
  };

  return (
    <div style={{ background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 'var(--m3-shape-xl)', padding: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--m3-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={18} style={{ color: '#eab308' }} fill="#eab308" /> {t('Opiniones de la Comunidad')}
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
            {reviews.length > 0
              ? <>{t('Valoración global:')} <strong style={{ color: '#d97706' }}>{promedio} / 5</strong> ({tn(reviews.length, '{n} reseña', '{n} reseñas')})</>
              : t('Sin valoraciones todavía')}
          </span>
        </div>
        <button
          onClick={() => {
            if (!cuenta) return onEntrar();
            // Editar abre el formulario con la reseña que ya publicó
            const mia = reviews.find(r => mias.includes(r.id));
            if (!mostrarForm && mia) {
              setUsuario(mia.usuario);
              setRating(mia.rating);
              setDuracion(mia.duracion_horas);
              setComentario(mia.comentario);
            }
            setMostrarForm(!mostrarForm);
          }}
          className="m3-btn m3-btn-primary"
          style={{ fontSize: '12px' }}
          title={cuenta ? undefined : t('Las reseñas se publican con una cuenta, para que cada persona opine una vez por perfume')}
        >
          {mostrarForm ? t('Cerrar') : !cuenta ? t('Entra para opinar') : yaOpine ? t('Editar mi reseña') : t('+ Publicar Reseña')}
        </button>
      </div>

      <p style={{ margin: '0 0 14px', fontSize: '11.5px', color: 'var(--m3-text-tertiary)' }}>
        {t('Reseñas de {nombre}. Las escriben usuarios con cuenta, una por persona; no hay reseñas de ejemplo.', { nombre: perfumeNombre })}
      </p>

      {error && (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--m3-error, #b3261e)' }}>{error}</p>
      )}

      {mostrarForm && cuenta && (
        <form onSubmit={enviarReview} style={{ background: 'var(--m3-surface-container-low)', padding: '16px', borderRadius: 'var(--m3-shape-lg)', marginBottom: '16px', border: '1px solid var(--m3-outline-variant)' }}>
          <input
            type="text" placeholder={t('Tu apodo (se muestra en la reseña; tu correo no)')} required minLength={2} maxLength={40} value={usuario}
            aria-label={t('Apodo')}
            onChange={e => setUsuario(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '10px', border: '1px solid var(--m3-outline)', fontSize: '13px', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}
          />
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--m3-text-secondary)', fontWeight: 600 }}>{t('Calificación:')}</label>
              <select value={rating} onChange={e => setRating(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--m3-outline)', fontSize: '12px', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}>
                <option value={5}>5 / 5 {t('Excelente')}</option>
                <option value={4}>4 / 5 {t('Muy bueno')}</option>
                <option value={3}>3 / 5 {t('Regular')}</option>
                <option value={2}>2 / 5 {t('Flojo')}</option>
                <option value={1}>1 / 5 {t('Malo')}</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--m3-text-secondary)', fontWeight: 600 }}>{t('Duración en piel:')}</label>
              <select value={duracion} onChange={e => setDuracion(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--m3-outline)', fontSize: '12px', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}>
                <option value={4}>{t('~{n} horas', { n: 4 })}</option>
                <option value={6}>{t('~{n} horas', { n: 6 })}</option>
                <option value={8}>{t('~{n} horas', { n: 8 })}</option>
                <option value={10}>{t('~{n} horas', { n: '10+' })}</option>
              </select>
            </div>
          </div>
          <textarea
            placeholder={t('Describe el secado, proyección o cumplidos recibidos...')}
            required minLength={10} maxLength={800} rows={3} value={comentario} onChange={e => setComentario(e.target.value)}
            aria-label={t('Tu reseña')}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '10px', border: '1px solid var(--m3-outline)', fontSize: '13px', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)' }}
          />
          <button type="submit" disabled={enviando} className="m3-btn m3-btn-primary" style={{ width: '100%' }}>
            {enviando ? t('Publicando...') : t('Publicar reseña')}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {reviews.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: 'var(--m3-text-tertiary)', margin: 0 }}>{t('Aún no hay reseñas registradas. ¡Sé el primero en opinar!')}</p>
        ) : (
          reviews.map(r => (
            <div key={r.id} style={{ borderBottom: '1px solid var(--m3-outline-variant)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <strong>{r.usuario}{mias.includes(r.id) && <span style={{ fontWeight: 600, color: 'var(--m3-primary)' }}> {t('(tú)')}</span>}</strong>
                <span style={{ color: '#eab308', letterSpacing: '1px' }} aria-label={t('{n} de 5 estrellas', { n: r.rating })}>{'★'.repeat(r.rating)}</span>
              </div>
              <p style={{ margin: '5px 0', fontSize: '13px', color: 'var(--m3-text-secondary)', lineHeight: 1.45 }}>"{r.comentario}"</p>
              <span style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>{t('Fijación: ~{h}h', { h: r.duracion_horas })} · {r.fecha}</span>
              {mias.includes(r.id) && (
                <button
                  type="button"
                  onClick={() => borrarReview(r.id)}
                  style={{ marginLeft: '10px', background: 'none', border: 'none', padding: 0, fontSize: '11px', color: 'var(--m3-error, #b3261e)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {t('Borrar')}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
