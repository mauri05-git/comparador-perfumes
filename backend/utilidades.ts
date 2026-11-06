// Identidad de un producto según su URL: dos URLs del mismo producto pueden diferir en parámetros o en el slug.
// En Falabella el id está en /product/{id}/; en el resto basta la URL sin parámetros ni "/" final.
export function claveProducto(url: string | null | undefined): string {
  const u = (url || "").trim().toLowerCase().split(/[?#]/)[0].replace(/\/+$/, "");
  const falabella = u.match(/falabella\.com\/.*\/product\/(\d+)/);
  return falabella ? `falabella:${falabella[1]}` : u;
}

export function mismoProducto(urlA: string | null | undefined, urlB: string | null | undefined): boolean {
  const a = claveProducto(urlA);
  return a !== "" && a === claveProducto(urlB);
}

// Ejecuta las tareas una tras otra: las lecturas-escrituras de los JSON (historial y catálogo) no deben
// intercalarse, porque una búsqueda y el refresco diario podrían sobrescribir los cambios del otro.
let cola: Promise<unknown> = Promise.resolve();
export function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => {});
  return resultado;
}
