import React, { useEffect, useState } from 'react';
import { UserRound, X, LogOut, ShoppingBag, ShieldAlert, ChevronRight, KeyRound, Trash2 } from 'lucide-react';
import { t, tn } from '../i18n.ts';

type Error = string | null;

// "Mi perfil": Mi Lista, Mis Alergias y la cuenta en un solo lugar. La cuenta es opcional.
export const ModalCuenta: React.FC<{
  abierto: boolean;
  alCerrar: () => void;
  usuario: { email: string } | null;
  cantidadLista: number;
  bajaronDePrecio: number;
  cantidadAlergias: number;
  onAbrirLista: () => void;
  onAbrirAlergias: () => void;
  // Cada una devuelve el texto del error, o null si salió bien
  onEnviar: (modo: 'entrar' | 'registro', email: string, contrasena: string) => Promise<Error>;
  onCambiarContrasena: (actual: string, nueva: string) => Promise<Error>;
  onBorrarCuenta: (contrasena: string) => Promise<Error>;
  onSalir: () => void;
}> = ({ abierto, alCerrar, usuario, cantidadLista, bajaronDePrecio, cantidadAlergias, onAbrirLista, onAbrirAlergias, onEnviar, onCambiarContrasena, onBorrarCuenta, onSalir }) => {
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const [gestion, setGestion] = useState<'nada' | 'contrasena' | 'borrar'>('nada');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<Error>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const limpiar = () => {
    setError(null);
    setContrasena('');
    setNueva('');
    setRepetida('');
  };

  // Cada vez que se abre parte en "Entrar", sin contraseñas ni mensajes de la vez anterior
  useEffect(() => {
    if (!abierto) return;
    setModo('entrar');
    setGestion('nada');
    setAviso(null);
    limpiar();
  }, [abierto]);

  if (!abierto) return null;

  const ejecutar = async (accion: () => Promise<Error>, alTerminar: () => void) => {
    setEnviando(true);
    const fallo = await accion();
    setEnviando(false);
    if (fallo) return setError(fallo);
    limpiar();
    alTerminar();
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError(t('Escribe tu correo.'));
    if (modo === 'registro' && contrasena.length < 8) return setError(t('La contraseña debe tener al menos 8 caracteres.'));
    if (modo === 'registro' && contrasena !== repetida) return setError(t('Las contraseñas no coinciden.'));
    ejecutar(() => onEnviar(modo, email, contrasena), alCerrar);
  };

  const cambiar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!contrasena) return setError(t('Escribe tu contraseña actual.'));
    if (nueva.length < 8) return setError(t('La nueva contraseña debe tener al menos 8 caracteres.'));
    if (nueva !== repetida) return setError(t('Las contraseñas nuevas no coinciden.'));
    ejecutar(() => onCambiarContrasena(contrasena, nueva), () => {
      setGestion('nada');
      setAviso(t('Contraseña cambiada. Se cerró la sesión en los demás equipos.'));
    });
  };

  const borrar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!contrasena) return setError(t('Escribe tu contraseña para confirmar.'));
    ejecutar(() => onBorrarCuenta(contrasena), alCerrar);
  };

  const campo: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: 'var(--m3-shape-sm)', marginTop: '4px',
    border: '1px solid var(--m3-outline)', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)',
  };
  const etiqueta: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: 'var(--m3-text-primary)' };
  const texto: React.CSSProperties = { margin: 0, fontSize: '13px', color: 'var(--m3-text-secondary)' };
  const subtitulo: React.CSSProperties = { margin: 0, fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--m3-text-secondary)' };
  const enlace: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--m3-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: 0 };
  const fila: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
    border: '1px solid var(--m3-outline)', borderRadius: 'var(--m3-shape-sm)', background: 'var(--m3-surface-container-lowest)', color: 'var(--m3-text-primary)',
  };

  const campoContrasena = (rotulo: string, valor: string, cambiarValor: (v: string) => void, autoComplete: string) => (
    <label style={etiqueta}>
      {rotulo}
      <input type="password" autoComplete={autoComplete} value={valor} onChange={(e) => cambiarValor(e.target.value)} style={campo} />
    </label>
  );
  const mensajeError = error && <p role="alert" style={{ margin: 0, fontSize: '13px', color: 'var(--m3-error)' }}>{error}</p>;

  return (
    <div className="m3-modal-backdrop" onClick={alCerrar}>
      <div className="m3-modal-card" role="dialog" aria-modal="true" aria-labelledby="titulo-perfil" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="m3-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserRound size={22} style={{ color: 'var(--m3-primary)' }} />
            <h3 id="titulo-perfil" className="m3-editorial-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--m3-text-primary)' }}>
              {t('Mi perfil')}
            </h3>
          </div>
          <button type="button" onClick={alCerrar} className="m3-search-clear" aria-label={t('Cerrar')}>
            <X size={20} />
          </button>
        </div>

        <div className="m3-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Lo guardado: funciona con o sin cuenta */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={subtitulo}>{t('Lo tuyo')}</h4>
            <button type="button" style={fila} onClick={onAbrirLista}>
              <ShoppingBag size={18} style={{ color: 'var(--m3-primary)' }} />
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '14px' }}>{t('Mis favoritos y listas')}</strong>
                <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                  {cantidadLista === 0 ? t('Vacía') : tn(cantidadLista, '{n} perfume', '{n} perfumes')}
                  {bajaronDePrecio > 0 && <span style={{ color: 'var(--m3-success)', fontWeight: 800 }}> · ↓ {tn(bajaronDePrecio, '{n} bajó de precio', '{n} bajaron de precio')}</span>}
                </span>
              </span>
              <ChevronRight size={16} style={{ color: 'var(--m3-text-secondary)' }} />
            </button>
            <button type="button" style={fila} onClick={onAbrirAlergias}>
              <ShieldAlert size={18} style={{ color: cantidadAlergias > 0 ? 'var(--m3-error)' : 'var(--m3-text-secondary)' }} />
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '14px' }}>{t('Mis Alergias')}</strong>
                <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                  {cantidadAlergias === 0 ? t('Sin configurar') : tn(cantidadAlergias, '{n} alergia marcada', '{n} alergias marcadas')}
                </span>
              </span>
              <ChevronRight size={16} style={{ color: 'var(--m3-text-secondary)' }} />
            </button>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--m3-outline-variant, var(--m3-outline))', paddingTop: '16px' }}>
            <h4 style={subtitulo}>{t('Cuenta')}</h4>
            {aviso && <p role="status" style={{ ...texto, color: 'var(--m3-success)', fontWeight: 700 }}>{aviso}</p>}

            {usuario ? (
              <>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--m3-text-primary)' }}>
                  {t('Entraste como {correo}', { correo: usuario.email })}.
                </p>
                <p style={texto}>{t('Tus favoritos y tus alergias se guardan en tu cuenta. Al cerrar sesión se borran de este navegador, por si el equipo es compartido.')}</p>

                {gestion === 'nada' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button type="button" className="m3-btn m3-btn-tonal" onClick={onSalir}>
                      <LogOut size={14} /> {t('Cerrar sesión')}
                    </button>
                    <button type="button" className="m3-btn m3-btn-tonal" onClick={() => { limpiar(); setAviso(null); setGestion('contrasena'); }}>
                      <KeyRound size={14} /> {t('Cambiar contraseña')}
                    </button>
                    <button type="button" style={{ ...enlace, color: 'var(--m3-error)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => { limpiar(); setAviso(null); setGestion('borrar'); }}>
                      <Trash2 size={14} /> {t('Borrar cuenta')}
                    </button>
                  </div>
                )}

                {gestion === 'contrasena' && (
                  <form onSubmit={cambiar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} noValidate>
                    {campoContrasena(t('Contraseña actual'), contrasena, setContrasena, 'current-password')}
                    {campoContrasena(t('Nueva contraseña'), nueva, setNueva, 'new-password')}
                    {campoContrasena(t('Repite la nueva contraseña'), repetida, setRepetida, 'new-password')}
                    {mensajeError}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button type="submit" className="m3-btn m3-btn-primary" disabled={enviando}>{enviando ? t('Un momento...') : t('Guardar contraseña')}</button>
                      <button type="button" style={enlace} onClick={() => { limpiar(); setGestion('nada'); }}>{t('Cancelar')}</button>
                    </div>
                  </form>
                )}

                {gestion === 'borrar' && (
                  <form onSubmit={borrar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} noValidate>
                    <p style={{ ...texto, color: 'var(--m3-error)', fontWeight: 700 }}>
                      {t('Se borran tu cuenta, tus favoritos y tus alergias del servidor y de este navegador. No se puede deshacer.')}
                    </p>
                    {campoContrasena(t('Tu contraseña, para confirmar'), contrasena, setContrasena, 'current-password')}
                    {mensajeError}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button type="submit" className="m3-btn m3-btn-primary" style={{ background: 'var(--m3-error)' }} disabled={enviando}>{enviando ? t('Un momento...') : t('Borrar mi cuenta')}</button>
                      <button type="button" style={enlace} onClick={() => { limpiar(); setGestion('nada'); }}>{t('Cancelar')}</button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} noValidate>
                <p style={texto}>{t('La cuenta es opcional: sirve para guardar tus favoritos y tus alergias, verlos desde otro equipo y publicar reseñas.')}</p>
                <label style={etiqueta}>
                  {t('Correo')}
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={campo} placeholder={t('nombre@correo.cl')} />
                </label>
                {campoContrasena(t('Contraseña'), contrasena, setContrasena, modo === 'entrar' ? 'current-password' : 'new-password')}
                {modo === 'registro' && (
                  <>
                    {campoContrasena(t('Repite la contraseña'), repetida, setRepetida, 'new-password')}
                    <span style={{ ...texto, fontSize: '12px', marginTop: '-8px' }}>{t('Al menos 8 caracteres. No hay recuperación por correo: guárdala bien.')}</span>
                  </>
                )}
                {mensajeError}
                <button type="submit" className="m3-btn m3-btn-primary" disabled={enviando}>
                  {enviando ? t('Un momento...') : modo === 'entrar' ? t('Entrar') : t('Crear cuenta')}
                </button>
                <button type="button" style={enlace} onClick={() => { setModo(modo === 'entrar' ? 'registro' : 'entrar'); setError(null); }}>
                  {modo === 'entrar' ? t('¿No tienes cuenta? Crear una') : t('¿Ya tienes cuenta? Entrar')}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
