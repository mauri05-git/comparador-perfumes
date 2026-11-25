// Botones de páginas a mostrar: la primera, la última y las vecinas de la actual, con "…" en los saltos.
// Página 1 de 39: 1 2 3 4 5 … 39. Página 5: 1 … 3 4 5 6 7 … 39. Con pocas páginas, todas.
export function paginasVisibles(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  // Siempre 5 números al medio, aunque la actual esté cerca de un extremo
  let desde = Math.max(2, actual - 2);
  let hasta = Math.min(total - 1, actual + 2);
  if (actual <= 4) [desde, hasta] = [2, 5];
  if (actual >= total - 3) [desde, hasta] = [total - 4, total - 1];
  const medio = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  return [1, ...(desde > 2 ? ['…' as const] : []), ...medio, ...(hasta < total - 1 ? ['…' as const] : []), total];
}
