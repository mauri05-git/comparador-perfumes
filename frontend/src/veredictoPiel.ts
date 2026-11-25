// Veredicto "Para tu piel" del comparador. Antes ganaba el que tenía menos compuestos regulados ("es más suave"),
// lo que premiaba al que no declara su lista. Ahora se habla de los alérgenos del usuario y de qué está verificado.
import { t } from './i18n.ts';


export interface LadoPiel {
  nombre: string;
  declara: boolean; // los alérgenos vienen de la lista del envase (si no, se estimaron por las notas)
  choques: string[]; // alérgenos del usuario encontrados
  total: number; // compuestos regulados encontrados
}

function lista(nombres: string[]): string {
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')}${t(' y ')}${nombres[nombres.length - 1]}`;
}

function tiene(l: LadoPiel): string {
  return l.declara
    ? t('{nombre} declara {lista}', { nombre: l.nombre, lista: lista(l.choques) })
    : t('{nombre} podría contener (según sus notas) {lista}', { nombre: l.nombre, lista: lista(l.choques) });
}

export function veredictoPiel(a: LadoPiel, b: LadoPiel, tienePerfil: boolean): { titulo: string; detalle: string } {
  if (!tienePerfil) {
    const cuenta = (l: LadoPiel) => l.declara
      ? t('{nombre}: {n} en su envase', { nombre: l.nombre, n: l.total })
      : t('{nombre}: {n} estimados por notas', { nombre: l.nombre, n: l.total });
    return { titulo: t('Configura tus alergias'), detalle: t('Compuestos regulados: {a}; {b}.', { a: cuenta(a), b: cuenta(b) }) };
  }
  if (a.choques.length && b.choques.length) {
    return { titulo: t('Ambos tienen tus alérgenos'), detalle: `${tiene(a)}; ${tiene(b)}.` };
  }
  if (a.choques.length || b.choques.length) {
    const [malo, bueno] = a.choques.length ? [a, b] : [b, a];
    // Sin la lista del envase del otro no se puede decir que sea mejor, solo que no se le encontraron
    return bueno.declara
      ? { titulo: t('{nombre} es mejor para tu piel', { nombre: bueno.nombre }), detalle: t('{tiene}; {nombre} no los declara en su envase.', { tiene: tiene(malo), nombre: bueno.nombre }) }
      : {
          titulo: t('{nombre} tiene tus alérgenos', { nombre: malo.nombre }),
          detalle: t('{tiene}. {nombre} no los muestra en sus notas, pero sin la lista de su envase no está verificado.', { tiene: tiene(malo), nombre: bueno.nombre }),
        };
  }
  const sinLista = [a, b].filter((l) => !l.declara).map((l) => l.nombre);
  return sinLista.length
    ? { titulo: t('Sin verificar'), detalle: t('Falta la lista del envase de {lista}: revisa la caja antes de comprar.', { lista: lista(sinLista) }) }
    : { titulo: t('Ninguno tiene tus alérgenos'), detalle: t('Según la lista del envase de ambos.') };
}
