# PerfumeScan

**Comparador inteligente de precios de perfumes para Chile** — Proyecto de Ingeniería de Software, 2026.

> Compara precios en tiempo real en Falabella, DBS Beauty Store, Alisha Perfumes y Farmacias Ahumada. Incluye fichas olfativas generadas por IA, historial de precios, reseñas de la comunidad y disponibilidad en tiendas con geolocalización GPS.

---

## Capturas de Pantalla

| Búsqueda de Precios | Ficha Olfativa IA | Comparador |
|---|---|---|
| _Busca en 4 tiendas simultáneamente_ | _Notas, acordes, intensidad y público_ | _Compara 2 perfumes lado a lado_ |

---

## Cómo Correr el Proyecto

### Requisitos Previos

| Herramienta | Versión | Descarga |
|---|---|---|
| Deno | 2.x | https://deno.land |
| Python | 3.10+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |

### 1. Clonar el Repositorio

```bash
git clone https://github.com/TICS316/proyecto-maurleiva.git
cd proyecto-maurleiva
```

### 2. Configurar Variables de Entorno

```bash
cd backend
copy .env.example .env
# Edita .env con tu clave real de Gemini API y Azure (opcional)
```

Obtén tu clave Gemini gratis en: https://aistudio.google.com/app/apikey

### 3. Instalar Dependencias Python

```bash
cd backend
pip install requests beautifulsoup4
```

### 4. Instalar Dependencias Frontend

```powershell
cd frontend
& "C:\Program Files\nodejs\npm.cmd" install
```

### 5. Iniciar el Backend (Deno)

```powershell
cd backend
deno run --allow-net --allow-env --allow-read --allow-write --allow-run --env server.ts
```

El backend corre en `http://localhost:8000`

### 6. Iniciar el Frontend (Vite)

En una **segunda terminal**:

```powershell
cd frontend
& "C:\Program Files\nodejs\npm.cmd" run dev
```

El frontend corre en `http://localhost:5173`

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19 + Vite)          │
│  Tab Buscar  |  Tab Comparar  |  Tab Escanear Foto       │
│  Sub-tabs: Precios | Ficha IA | Reviews | Historial | GPS│
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST API
┌──────────────────────▼──────────────────────────────────┐
│                  BACKEND (Deno + Hono)                   │
│  GET /api/buscar   │  GET /api/comparar                  │
│  POST /api/analizar│  POST /api/reviews                  │
└────┬──────────────────────────────┬───────────────────────┘
     │                              │
┌────▼─────────┐           ┌────────▼──────────┐
│ Python Scraper│           │   Gemini API      │
│ (BeautifulSoup│           │ (Fallback cascade)│
│ 4 tiendas     │           │ Fichas olfativas  │
│ en paralelo)  │           │ + Análisis fotos  │
└──────────────┘           └───────────────────┘
     │
┌────▼──────────────────────────────────────────┐
│  TIENDAS SCRAPEADAS                           │
│  • Falabella (__NEXT_DATA__ JSON)             │
│  • DBS Beauty Store (Magento, data-src)       │
│  • Alisha Perfumes (Shopify)                  │
│  • Farmacias Ahumada (Salesforce Commerce)    │
└───────────────────────────────────────────────┘
```

---

## Funcionalidades Implementadas

### Búsqueda Multi-Tienda
- Scraping paralelo en 4 tiendas chilenas simultáneamente
- Filtro de relevancia: elimina artículos que no son perfumes (cremas, vitaminas, etc.)
- Precio mínimo CLP \$8.000 para filtrar falsos positivos
- Resultados con imágenes del producto, link directo y estado de stock

### Inteligencia Artificial (Gemini)
- **Ficha olfativa completa**: familia olfativa, notas de salida/corazón/fondo, acordes principales
- **Datos expertos**: intensidad, proyección, sillage, mejor momento del día, público objetivo
- **Análisis de fotos**: identifica el perfume a partir de una imagen con Gemini Vision
- **Fallback cascade**: prueba múltiples modelos automáticamente si uno falla por cuota

### Reseñas Comunitarias
- Sistema de reseñas con calificación 1-5 estrellas
- Duración reportada en piel por usuarios reales
- Persistencia en JSON local (`reviews_comunidad.json`)
- Reseñas pre-cargadas para perfumes populares (Acqua di Gio, Sauvage, Bleu de Chanel)

### Historial de Precios
- Gráfico de barras CSS con últimas 6 mediciones
- Indicador de tendencia (bajó / subió / estable) en porcentaje
- Precio mínimo histórico detectado destacado en verde
- Persistencia en JSON local (`historial_precios.json`)

### Sucursales con Geolocalización GPS
- **11 sucursales** de Falabella, Ahumada, Alisha Perfumes y DBS Beauty Store
- Botón "Usar mi ubicación" vía `navigator.geolocation`
- Ordenamiento automático por distancia (fórmula Haversine)
- Indicador de distancia en km con colores (verde < 3km, amarillo < 8km)
- Link directo a Google Maps con indicaciones de cómo llegar

### Comparador Lado a Lado
- Compara 2 perfumes simultáneamente con scraping paralelo
- Muestra imagen del producto, precio mínimo, ficha olfativa y links a tiendas
- Badge "Más Económico" en el perfume con menor precio
- Notas olfativas y datos técnicos comparados en columnas

### Escáner de Fotos
- Sube una foto del frasco o caja del perfume
- Gemini Vision identifica marca, nombre y muestra los ingredientes
- Lanza búsqueda automática de precios y ficha del perfume detectado
- Compatible con cámara de celular (`capture="environment"`)

---

## Estructura del Proyecto

```
proyecto-maurleiva/
├── backend/
│   ├── server.ts          # API Deno + Hono (rutas, Gemini, Azure)
│   ├── scraper_stock.py   # Scraper multi-tienda Python
│   ├── .env               # Variables de entorno (NO commitear)
│   ├── .env.example       # Plantilla de variables
│   ├── historial_precios.json  # Persistencia de historial
│   └── reviews_comunidad.json  # Persistencia de reviews
├── frontend/
│   └── src/
│       ├── App.tsx        # Componente principal React
│       └── App.css        # Estilos responsive
├── .gitignore
├── Autoria.md
├── Bitacora.md            # Bitácora técnica del proyecto
├── Commit log.md
├── COMO_CORRER.md
└── README.md              # Este archivo
```

---

## Variables de Entorno

Crear `backend/.env` basándose en `backend/.env.example`:

| Variable | Descripción | Obligatoria |
|---|---|---|
| `GEMINI_API_KEY` | Clave API de Google AI Studio | Sí |
| `AZURE_CONNECTION_STRING` | Cadena de conexión Azure Blob Storage | Opcional |

---

## Endpoints de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/buscar?q=nombre` | Busca un perfume en 4 tiendas + genera ficha IA |
| `GET` | `/api/comparar?p1=X&p2=Y` | Compara 2 perfumes lado a lado |
| `POST` | `/api/analizar` | Analiza foto de perfume con Gemini Vision |
| `POST` | `/api/reviews` | Publica una reseña de usuario |

---

## Autor

**Mauricio Leiva** — Ingeniería de Software, 2026  
Proyecto académico desarrollado con asistencia de IA generativa (Antigravity / Gemini).

---

## Licencia

Proyecto académico — uso educativo solamente.
