import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from '../i18n.ts';

// Mapa de los locales cercanos con OpenStreetMap (sin clave de API). Los puntos son círculos de colores en vez de
// los íconos de Leaflet, que dependen de imágenes que el empaquetador no copia.

export interface PuntoMapa {
  lat: number;
  lng: number;
  titulo: string;
  detalle: string;
  color: string;
}

const SANTIAGO: [number, number] = [-33.4489, -70.6693];

export function MapaSucursales({ puntos, usuario }: { puntos: PuntoMapa[]; usuario: { lat: number; lng: number } | null }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    // En celular un dedo mueve la página, no el mapa (se acerca con dos dedos)
    mapa.current = L.map(contenedor.current, { scrollWheelZoom: false, dragging: !L.Browser.mobile }).setView(SANTIAGO, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    const c = capa.current;
    if (!m || !c) return;
    c.clearLayers();
    for (const p of puntos) {
      L.circleMarker([p.lat, p.lng], { radius: 8, color: '#2e2010', weight: 1.5, fillColor: p.color, fillOpacity: 0.9 })
        .bindPopup(`<strong>${escapar(p.titulo)}</strong><br>${escapar(p.detalle)}`)
        .addTo(c);
    }
    if (usuario) {
      L.circleMarker([usuario.lat, usuario.lng], { radius: 9, color: '#ffffff', weight: 3, fillColor: '#1d4ed8', fillOpacity: 1 })
        .bindPopup(t('Tu ubicación'))
        .addTo(c);
    }
    // Encuadra al usuario con los locales más cercanos; sin GPS, todos los locales mostrados
    const encuadre: [number, number][] = [
      ...(usuario ? [[usuario.lat, usuario.lng] as [number, number]] : []),
      ...puntos.slice(0, usuario ? 6 : puntos.length).map((p) => [p.lat, p.lng] as [number, number]),
    ];
    if (encuadre.length > 1) m.fitBounds(encuadre, { padding: [28, 28], maxZoom: 15 });
    else if (encuadre.length === 1) m.setView(encuadre[0], 14);
  }, [puntos, usuario]);

  return (
    <div
      ref={contenedor}
      role="region"
      aria-label={t('Mapa de los locales')}
      style={{ height: '320px', borderRadius: 'var(--m3-shape-md)', border: '1px solid var(--m3-outline)', overflow: 'hidden', zIndex: 0, position: 'relative' }}
    />
  );
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
