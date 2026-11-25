// La ficha en el idioma de la interfaz. La IA escribe la ficha en español y el backend guarda su versión en inglés
// en `ficha.en` (solo los campos que calzaron con el español). Solo para mostrarla: los alérgenos, las etiquetas y el
// reconocimiento del perfume siguen usando la ficha en español.
import { idioma } from './i18n.ts';

interface Guia {
  atomizaciones: string;
  puntos_pulso: string[];
  consejo_experto: string;
  clima_ideal: string;
}
interface FichaConTraduccion {
  guia_aplicacion?: Guia;
  en?: { guia_aplicacion?: Guia } & Record<string, unknown>;
}

// En inglés si se eligió inglés y existe la traducción; si no, en español.
// La guía que copió tal cual el ejemplo del prompt ("Aplica tras la ducha…") no se muestra como guía del perfume.
const GUIA_COPIADA = /^aplica tras la ducha sobre piel limpia e hidratada\. no frotes/i;
export function fichaParaMostrar<T extends FichaConTraduccion | null | undefined>(f: T): T {
  if (!f) return f;
  const copiada = GUIA_COPIADA.test(f.guia_aplicacion?.consejo_experto || '');
  const base = copiada ? { ...f, guia_aplicacion: undefined } : f;
  if (idioma() !== 'en' || !f.en) return base as T;
  const { guia_aplicacion, ...textos } = f.en;
  return { ...base, ...textos, guia_aplicacion: copiada ? undefined : guia_aplicacion ?? base.guia_aplicacion } as T;
}
