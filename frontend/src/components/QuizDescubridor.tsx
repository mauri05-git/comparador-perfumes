import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  Search,
  Heart,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RecomendacionQuiz {
  nombre: string;
  marca: string;
  ocasion: 'oficina' | 'cita' | 'verano' | 'fiesta';
  estilo: 'fresco' | 'amaderado' | 'dulce';
  presupuesto: 'economico' | 'medio' | 'premium';
  precioRef: string;
  precioNumerico: number;
  notasPrincipales: string[];
  alergenosIds: string[];
  motivo: string;
  imagen?: string;
}

const BASE_RECOMENDACIONES: RecomendacionQuiz[] = [
  {
    nombre: 'Acqua Di Gio',
    marca: 'Giorgio Armani',
    ocasion: 'verano',
    estilo: 'fresco',
    presupuesto: 'premium',
    precioRef: '~$99.990 CLP',
    precioNumerico: 99990,
    notasPrincipales: ['Bergamota', 'Notas Marinas', 'Cedro', 'Jazmín'],
    alergenosIds: ['limonene', 'linalool'],
    motivo: 'El estándar de oro en frescura marina mediterránea; versátil y limpio.',
    imagen: '/perfumes/acqua-di-gio.jpg',
  },
  {
    nombre: 'Nautica Voyage',
    marca: 'Nautica',
    ocasion: 'verano',
    estilo: 'fresco',
    presupuesto: 'economico',
    precioRef: '~$24.990 CLP',
    precioNumerico: 24990,
    notasPrincipales: ['Manzana Verde', 'Flor de Loto', 'Almizcle', 'Cedro'],
    alergenosIds: [],
    motivo: 'Imbatible en calidad/precio para días calurosos, gimnasio o uso diario.',
    imagen: '/perfumes/nautica-voyage.jpg',
  },
  {
    nombre: 'Bleu de Chanel',
    marca: 'Chanel',
    ocasion: 'oficina',
    estilo: 'amaderado',
    presupuesto: 'premium',
    precioRef: '~$125.000 CLP',
    precioNumerico: 125000,
    notasPrincipales: ['Pomelo', 'Incienso', 'Sándalo', 'Jengibre'],
    alergenosIds: ['limonene', 'citral'],
    motivo: 'Sofisticación profesional absoluta; proyecta elegancia sin invadir.',
    imagen: '/perfumes/bleu-de-chanel.jpg',
  },
  {
    nombre: 'Sauvage Dior',
    marca: 'Dior',
    ocasion: 'oficina',
    estilo: 'amaderado',
    presupuesto: 'premium',
    precioRef: '~$109.990 CLP',
    precioNumerico: 109990,
    notasPrincipales: ['Bergamota de Calabria', 'Pimienta de Sichuan', 'Ambroxan'],
    alergenosIds: ['limonene', 'eugenol'],
    motivo: 'Fijación extrema y gran estela; funciona de día o de noche en cualquier estación.',
    imagen: '/perfumes/sauvage-dior.jpg',
  },
  {
    nombre: 'Good Girl',
    marca: 'Carolina Herrera',
    ocasion: 'cita',
    estilo: 'dulce',
    presupuesto: 'medio',
    precioRef: '~$78.990 CLP',
    precioNumerico: 78990,
    notasPrincipales: ['Almendra', 'Café', 'Haba Tonka', 'Cacao', 'Nardo'],
    alergenosIds: ['coumarin', 'linalool'],
    motivo: 'Seductor, envolvente y nocturno con contraste de flores blancas y cacao.',
    imagen: '/perfumes/good-girl.jpg',
  },
  {
    nombre: 'Versace Eros',
    marca: 'Versace',
    ocasion: 'fiesta',
    estilo: 'dulce',
    presupuesto: 'medio',
    precioRef: '~$64.990 CLP',
    precioNumerico: 64990,
    notasPrincipales: ['Menta', 'Manzana Verde', 'Vainilla', 'Haba Tonka'],
    alergenosIds: ['coumarin', 'limonene'],
    motivo: 'Potente, juvenil y magnético para salidas nocturnas y eventos sociales.',
    imagen: '/perfumes/versace-eros.jpg',
  },
  {
    nombre: 'Montblanc Explorer',
    marca: 'Montblanc',
    ocasion: 'oficina',
    estilo: 'amaderado',
    presupuesto: 'medio',
    precioRef: '~$54.990 CLP',
    precioNumerico: 54990,
    notasPrincipales: ['Bergamota', 'Vetiver de Haití', 'Pachulí', 'Ambroxan'],
    alergenosIds: ['limonene', 'oakmoss'],
    motivo: 'Aroma ejecutivo moderno con excelente relación precio-rendimiento.',
  },
  {
    nombre: 'Calvin Klein CK One',
    marca: 'Calvin Klein',
    ocasion: 'verano',
    estilo: 'fresco',
    presupuesto: 'economico',
    precioRef: '~$32.990 CLP',
    precioNumerico: 32990,
    notasPrincipales: ['Té Verde', 'Papaya', 'Bergamota', 'Almizcle Blanco'],
    alergenosIds: ['limonene', 'linalool'],
    motivo: 'Clásico unisex limpio y relajado, perfecto para uso cotidiano sin saturar.',
  },
  {
    nombre: 'Paco Rabanne 1 Million',
    marca: 'Paco Rabanne',
    ocasion: 'fiesta',
    estilo: 'dulce',
    presupuesto: 'medio',
    precioRef: '~$74.990 CLP',
    precioNumerico: 74990,
    notasPrincipales: ['Mandarina Roja', 'Canela', 'Cuero', 'Ámbar'],
    alergenosIds: ['cinnamal', 'limonene', 'coumarin'],
    motivo: 'Especiado cálido e inconfundible para climas fríos y noches de fiesta.',
  },
];

export const QuizDescubridor: React.FC<{
  alergiasUsuario: string[];
  notasPersonalizadas: string[];
  onBuscar: (nombre: string) => void;
  onGuardarEnLista: (nombre: string, marca: string, precio: number, imagen?: string) => void;
}> = ({ alergiasUsuario, notasPersonalizadas, onBuscar, onGuardarEnLista }) => {
  const [abierto, setAbierto] = useState(false);
  const [ocasion, setOcasion] = useState<string>('todas');
  const [estilo, setEstilo] = useState<string>('todos');
  const [presupuesto, setPresupuesto] = useState<string>('todos');
  const [ocultarConAlergia, setOcultarConAlergia] = useState(true);

  const evaluarItemAlergia = (item: RecomendacionQuiz) => {
    const chocaId = item.alergenosIds.some((id) => alergiasUsuario.includes(id));
    const textoNotas = item.notasPrincipales.join(' ').toLowerCase();
    const chocaCustom = notasPersonalizadas.some(
      (n) => n.trim().length > 1 && textoNotas.includes(n.trim().toLowerCase())
    );
    return chocaId || chocaCustom;
  };

  const candidatos = BASE_RECOMENDACIONES.filter((item) => {
    if (ocasion !== 'todas' && item.ocasion !== ocasion) return false;
    if (estilo !== 'todos' && item.estilo !== estilo) return false;
    if (presupuesto !== 'todos' && item.presupuesto !== presupuesto) return false;
    if (ocultarConAlergia && (alergiasUsuario.length > 0 || notasPersonalizadas.length > 0)) {
      if (evaluarItemAlergia(item)) return false;
    }
    return true;
  });

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--m3-primary-container) 0%, var(--m3-surface-container-low) 100%)',
        border: '1px solid var(--m3-outline-variant)',
        borderRadius: 'var(--m3-shape-xl)',
        padding: '20px 24px',
        marginBottom: '26px',
        boxShadow: 'var(--m3-elev-1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--m3-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Compass size={22} strokeWidth={2} />
          </div>
          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Asistente Sommelier Olfativo
            </span>
            <h4 className="m3-editorial-title" style={{ margin: '2px 0 0 0', fontSize: '1.15rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
              ¿No sabes qué perfume elegir? Encuentra tu fragancia en 3 pasos
            </h4>
          </div>
        </div>
        <button
          onClick={() => setAbierto(!abierto)}
          className="m3-btn m3-btn-primary"
          style={{ fontSize: '12px', padding: '9px 18px' }}
        >
          {abierto ? (
            <>Minimizar <ChevronUp size={15} /></>
          ) : (
            <><Sparkles size={15} /> Abrir Recomendador <ChevronDown size={15} /></>
          )}
        </button>
      </div>

      {abierto && (
        <div style={{ marginTop: '18px', borderTop: '1px solid var(--m3-outline-variant)', paddingTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '7px' }}>
                1. Ocasión Principal
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'todas', label: 'Todas' },
                  { id: 'oficina', label: 'Oficina' },
                  { id: 'cita', label: 'Cita Nocturna' },
                  { id: 'verano', label: 'Verano / Día' },
                  { id: 'fiesta', label: 'Eventos' },
                ].map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOcasion(o.id)}
                    className={`m3-chip ${ocasion === o.id ? 'active' : ''}`}
                    style={{ fontSize: '11.5px', padding: '5px 11px' }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '7px' }}>
                2. Carácter Olfativo
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'todos', label: 'Cualquiera' },
                  { id: 'fresco', label: 'Fresco / Marino' },
                  { id: 'amaderado', label: 'Amaderado / Elegante' },
                  { id: 'dulce', label: 'Dulce / Seductor' },
                ].map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEstilo(e.id)}
                    className={`m3-chip ${estilo === e.id ? 'active' : ''}`}
                    style={{ fontSize: '11.5px', padding: '5px 11px' }}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '7px' }}>
                3. Presupuesto
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'economico', label: '< $40.000' },
                  { id: 'medio', label: '$45k - $85k' },
                  { id: 'premium', label: 'Alta Gama' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPresupuesto(p.id)}
                    className={`m3-chip ${presupuesto === p.id ? 'active' : ''}`}
                    style={{ fontSize: '11.5px', padding: '5px 11px' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(alergiasUsuario.length > 0 || notasPersonalizadas.length > 0) && (
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
              <input
                type="checkbox"
                id="chk-alergia-quiz"
                checked={ocultarConAlergia}
                onChange={(e) => setOcultarConAlergia(e.target.checked)}
              />
              <label htmlFor="chk-alergia-quiz" style={{ cursor: 'pointer', fontWeight: 600 }}>
                Ocultar automáticamente perfumes que contengan mis {alergiasUsuario.length + notasPersonalizadas.length} alergias registradas
              </label>
            </div>
          )}

          {/* Tarjetas resultado del Quiz */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))', gap: '12px' }}>
            {candidatos.map((c, idx) => {
              const tieneAlergia = evaluarItemAlergia(c);
              return (
                <div
                  key={idx}
                  className="m3-hero-perfume-card"
                  style={{
                    borderColor: tieneAlergia ? 'rgba(239, 68, 68, 0.5)' : undefined,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {c.marca}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', fontFamily: 'var(--font-mono)' }}>{c.precioRef}</span>
                    </div>
                    <strong className="m3-editorial-title" style={{ fontSize: '15.5px', color: 'var(--m3-text-primary)', display: 'block' }}>
                      {c.nombre}
                    </strong>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '99px',
                        marginTop: '5px',
                        background: tieneAlergia ? 'rgba(220, 38, 38, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                        color: tieneAlergia ? '#dc2626' : '#15803d',
                      }}
                    >
                      {tieneAlergia ? <><AlertTriangle size={11} /> Contiene tu alérgeno</> : <><ShieldCheck size={11} /> Compatible con tu piel</>}
                    </span>
                    <p style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)', margin: '7px 0', lineHeight: 1.4 }}>
                      {c.motivo}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                      {c.notasPrincipales.map((n) => (
                        <span
                          key={n}
                          style={{
                            fontSize: '10px',
                            background: 'var(--m3-surface-container)',
                            color: 'var(--m3-text-secondary)',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            fontWeight: 600,
                          }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => onBuscar(c.nombre)}
                      className="m3-btn m3-btn-primary"
                      style={{ flex: 1, fontSize: '11.5px', padding: '7px 10px' }}
                    >
                      <Search size={13} /> Cotizar
                    </button>
                    <button
                      onClick={() => onGuardarEnLista(c.nombre, c.marca, c.precioNumerico, c.imagen)}
                      className="m3-btn m3-btn-tonal"
                      style={{ fontSize: '11.5px', padding: '7px 10px' }}
                      title="Guardar en mi lista de compras"
                    >
                      <Heart size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
