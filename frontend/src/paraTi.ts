import type { FraganciaCatalogoItem } from './components/CatalogoFiltrosSidebar';
import { t } from './i18n.ts';

// Un perfume que al usuario le interesa (de su lista o de sus búsquedas) y cuánto pesa esa señal
export interface SenalGusto {
  nombre: string;
  peso: number;
}

export interface Recomendacion {
  item: FraganciaCatalogoItem;
  motivo: string;
  puntos: number;
}

function etiquetaCorta(nota: string): string {
  return nota.split(/ \(| \//)[0].toLowerCase();
}

function coincide(item: FraganciaCatalogoItem, texto: string): boolean {
  const n = item.nombre.toLowerCase();
  const t = texto.toLowerCase();
  return n.length >= 3 && (t.includes(n) || (t.length >= 4 && n.includes(t)));
}

// Recomienda perfumes del catálogo según las familias, notas y rango de precio de los que le gustan al
// usuario. Excluye sus alergias y lo que ya le gusta. Solo recomienda si comparte familia o notas.
export function recomendarParaTi(
  catalogo: FraganciaCatalogoItem[],
  senales: SenalGusto[],
  alergiasIds: string[],
  notasEvitar: string[],
  limite = 6
): Recomendacion[] {
  const gustados: { item: FraganciaCatalogoItem; peso: number }[] = [];
  for (const s of senales) {
    const item = catalogo.find(c => coincide(c, s.nombre));
    const existente = item && gustados.find(g => g.item.id === item.id);
    if (existente) existente.peso += s.peso;
    else if (item) gustados.push({ item, peso: s.peso });
  }
  if (gustados.length === 0) return [];

  const precios = gustados.map(g => g.item.precioReferencia).sort((a, b) => a - b);
  const precioMediano = precios[Math.floor(precios.length / 2)];
  const evitar = notasEvitar.map(n => n.trim().toLowerCase()).filter(Boolean);

  const recomendaciones: Recomendacion[] = [];
  for (const c of catalogo) {
    if (gustados.some(g => g.item.id === c.id || g.item.nombre.toLowerCase() === c.nombre.toLowerCase())) continue;
    if (c.alergenosIds.some(a => alergiasIds.includes(a))) continue;
    const textoNotas = [...c.notas, ...(c.notasDetalle || [])].join(' ').toLowerCase();
    if (evitar.some(e => textoNotas.includes(e))) continue;

    // Se compara con el perfume gustado más parecido, para poder explicar el motivo
    let mejor: { puntos: number; referencia: string; motivos: string[] } | null = null;
    for (const g of gustados) {
      const motivos: string[] = [];
      let puntos = 0;
      if (c.familia !== 'Sin clasificar' && c.familia === g.item.familia) {
        puntos += 2;
        motivos.push(t('misma familia ({familia})', { familia: etiquetaCorta(c.familia) }));
      }
      const comunes = c.notas.filter(n => g.item.notas.includes(n));
      if (comunes.length > 0) {
        puntos += comunes.length;
        motivos.push(t('notas de {notas}', { notas: comunes.slice(0, 2).map(etiquetaCorta).join(t(' y ')) }));
      }
      puntos *= g.peso;
      if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { puntos, referencia: g.item.nombre, motivos };
    }
    if (!mejor) continue;

    if (Math.abs(c.precioReferencia - precioMediano) / precioMediano <= 0.35) {
      mejor.puntos += 1;
      mejor.motivos.push(t('precio parecido'));
    }
    recomendaciones.push({
      item: c,
      puntos: mejor.puntos,
      motivo: t('Como {referencia}: {motivos}', { referencia: mejor.referencia, motivos: mejor.motivos.join(', ') }),
    });
  }

  return recomendaciones.sort((a, b) => b.puntos - a.puntos).slice(0, limite);
}
