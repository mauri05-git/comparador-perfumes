// Ejecutar con: node tests/fichaIdioma.test.ts
import { fichaParaMostrar } from '../src/fichaIdioma.ts';
import { usarIdioma } from '../src/i18n.ts';

function asegurar(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const guia = { atomizaciones: '3', puntos_pulso: ['Cuello'], consejo_experto: 'Rinde mejor de noche.', clima_ideal: 'Frío' };
const ficha = {
  nombre: 'Sauvage',
  familia_olfativa: 'Aromático Fougère',
  notas_salida: ['Bergamota', 'Pimienta'],
  descripcion: 'Fresco y especiado.',
  guia_aplicacion: guia,
  en: {
    familia_olfativa: 'Aromatic Fougère',
    notas_salida: ['Bergamot', 'Pepper'],
    guia_aplicacion: { atomizaciones: '3', puntos_pulso: ['Neck'], consejo_experto: 'Best at night.', clima_ideal: 'Cold' },
  },
};

// En español se muestra tal cual
usarIdioma('es');
asegurar(fichaParaMostrar(ficha).notas_salida[0] === 'Bergamota', 'en español, las notas en español');

// En inglés, los textos traducidos; lo que no se tradujo queda en español
usarIdioma('en');
const en = fichaParaMostrar(ficha);
asegurar(en.familia_olfativa === 'Aromatic Fougère' && en.notas_salida[1] === 'Pepper', 'en inglés, familia y notas traducidas');
asegurar(en.descripcion === 'Fresco y especiado.', 'sin traducción de la descripción, queda la de español');
asegurar(en.guia_aplicacion?.consejo_experto === 'Best at night.', 'la guía en inglés');
asegurar(en.nombre === 'Sauvage', 'el nombre no cambia');
asegurar(ficha.notas_salida[0] === 'Bergamota', 'no modifica la ficha original');

// Sin traducción, el español
asegurar(fichaParaMostrar({ ...ficha, en: undefined }).notas_salida[0] === 'Bergamota', 'sin en, el español');
asegurar(fichaParaMostrar(null) === null, 'sin ficha, nada');

// La guía que copió el ejemplo del prompt no se muestra como guía del perfume, en ningún idioma
const copiada = { ...ficha, guia_aplicacion: { ...guia, consejo_experto: 'Aplica tras la ducha sobre piel limpia e hidratada. No frotes las muñecas.' } };
asegurar(fichaParaMostrar(copiada).guia_aplicacion === undefined, 'en inglés, la guía copiada se descarta');
usarIdioma('es');
asegurar(fichaParaMostrar(copiada).guia_aplicacion === undefined, 'en español, la guía copiada se descarta');

console.log('ok: fichaIdioma');
