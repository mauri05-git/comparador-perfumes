// Dirección del backend: el mismo equipo desde el que se abrió la página, en el puerto 8000. En el notebook es
// http://localhost:8000; desde un celular en la misma red Wi-Fi, la dirección del notebook (http://192.168.x.x:8000).
const RESPALDO = 'http://localhost:8000';
export const API_BASE =
  typeof window !== 'undefined' && window.location.hostname
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : RESPALDO;

// Las fotos descargadas quedaron guardadas con la dirección del notebook (http://localhost:8000/imagenes/...).
// Abierta desde otro equipo, esa dirección apunta al propio celular: se cambia por la del backend.
export function urlDelBackend(url: string): string {
  return API_BASE !== RESPALDO && url.startsWith(RESPALDO) ? API_BASE + url.slice(RESPALDO.length) : url;
}
