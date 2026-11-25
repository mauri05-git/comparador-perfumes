// El radar olfativo explicado en palabras simples, para quien no sabe de perfumes.
// Los puntajes se estiman contando notas (cada nota típica suma 18), así que solo se nombran diferencias de una nota o más.
import { t } from './i18n.ts';


export interface PerfilRadar {
  frescura: number;
  dulzor: number;
  amaderado: number;
  especiado: number;
  floral: number;
  intensidad: number;
}

type Eje = keyof PerfilRadar;

export const SIGNIFICADO_EJES: Record<Eje, { nombre: string; masX: string; huele: string; cuando: string }> = {
  frescura: { nombre: 'Frescura', masX: 'más fresco', huele: 'cítricos, notas marinas, menta', cuando: 'liviano y limpio: para el día, el calor y la oficina' },
  dulzor: { nombre: 'Dulzor', masX: 'más dulce', huele: 'vainilla, ámbar, frutas, caramelo', cuando: 'cálido y envolvente: para la noche y el frío' },
  amaderado: { nombre: 'Amaderado', masX: 'más amaderado', huele: 'cedro, sándalo, vetiver', cuando: 'seco y elegante: sirve todo el año' },
  especiado: { nombre: 'Especiado', masX: 'más especiado', huele: 'pimienta, canela, cardamomo, cuero', cuando: 'cálido y con carácter: para el otoño, el invierno y la noche' },
  floral: { nombre: 'Floral', masX: 'más floral', huele: 'rosa, jazmín, lavanda, azahar', cuando: 'suave y romántico: para el día y la primavera' },
  // Sale sobre todo de la proyección; la duración tiene su propio veredicto en el comparador
  intensidad: { nombre: 'Intensidad', masX: 'más intenso (se nota más a su alrededor)', huele: 'cuánto proyecta', cuando: 'se siente a más distancia' },
};

const UMBRAL = 15;
const EJES_DE_OLOR: Eje[] = ['frescura', 'dulzor', 'amaderado', 'especiado', 'floral'];

/** Lo que más lo define (sin contar la intensidad, que no es un olor). */
export function caracterPrincipal(r: PerfilRadar): Eje {
  return EJES_DE_OLOR.reduce((mejor, eje) => (r[eje] > r[mejor] ? eje : mejor), EJES_DE_OLOR[0]);
}

/**
 * Frente a otro perfume, el olor en que más lo supera; si no lo supera en ninguno, lo que más lo define.
 * (Eros tiene tanta frescura como dulzor, pero frente a Acqua di Giò lo que lo distingue es lo dulce.)
 */
export function loQueLoDistingue(r: PerfilRadar, otro: PerfilRadar): Eje {
  const eje = EJES_DE_OLOR.reduce((mejor, e) => (r[e] - otro[e] > r[mejor] - otro[mejor] ? e : mejor), EJES_DE_OLOR[0]);
  return r[eje] - otro[eje] >= UMBRAL ? eje : caracterPrincipal(r);
}

/** Frases del tipo "Acqua di Giò es más fresco", ordenadas de la diferencia más grande a la más chica. */
export function diferenciasOlfativas(r1: PerfilRadar, r2: PerfilRadar, nombre1: string, nombre2: string): string[] {
  return (Object.keys(SIGNIFICADO_EJES) as Eje[])
    .map((eje) => ({ eje, dif: r1[eje] - r2[eje] }))
    .filter(({ dif }) => Math.abs(dif) >= UMBRAL)
    .sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))
    .map(({ eje, dif }) => t('{nombre} es {mas}', { nombre: dif > 0 ? nombre1 : nombre2, mas: t(SIGNIFICADO_EJES[eje].masX) }));
}
