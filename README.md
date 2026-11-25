# PerfumeScan

[![Tests](https://github.com/TICS316/proyecto-maurleiva/actions/workflows/tests.yml/badge.svg)](https://github.com/TICS316/proyecto-maurleiva/actions/workflows/tests.yml)

**Almacén de perfumes: los precios de hoy en Chile y lo que declara el envase** — Proyecto de Ingeniería de Software, 2026.

> Compara precios en vivo en Falabella, DBS Beauty Store, Alisha Perfumes y Farmacias Ahumada. Muestra el stock verificado, el historial de precios del mismo producto, las sucursales con horario y GPS, una ficha olfativa por perfume y los alérgenos según la lista de ingredientes del envase.

---

## Cómo correr el proyecto

### Requisitos previos

| Herramienta | Versión | Descarga |
|---|---|---|
| Deno | 2.x | https://deno.land |
| Python | 3.10+ | https://python.org |
| Node.js | 18+ (solo para compilar el frontend) | https://nodejs.org |

### 1. Clonar el repositorio

```bash
git clone https://github.com/TICS316/proyecto-maurleiva.git
cd proyecto-maurleiva
```

### 2. Configurar variables de entorno

```bash
cd backend
copy .env.example .env
# Edita .env con tus claves (ver "Variables de entorno" más abajo)
```

### 3. Instalar dependencias

```bash
pip install requests beautifulsoup4
cd frontend
npm install
npm run build
```

En PowerShell usa `npm.cmd` en vez de `npm`.

### 4. Iniciar

En Windows basta con abrir `INICIAR_PERFUMESCAN.bat`: levanta el backend (si Deno está instalado) y sirve el frontend compilado en `http://localhost:5173`.

A mano, en dos terminales:

```powershell
# Terminal 1: backend en http://localhost:8000
cd backend
deno run --allow-net --allow-env --allow-read --allow-write --allow-run --env server.ts

# Terminal 2: frontend en http://localhost:5173
cd frontend
npm.cmd run dev
```

Más detalles y preguntas frecuentes en [COMO_CORRER.md](COMO_CORRER.md).

---

## Arquitectura

```
┌───────────────────────────────────────────────────────────┐
│              FRONTEND (React 19 + TypeScript + Vite)      │
│  Explorar (buscador + catálogo con filtros) | Comparador  │
│  Ficha: Todas las tiendas | Historial | A qué huele |     │
│         Guía de uso | Dónde conseguirlo | Reseñas         │
└──────────────────────┬────────────────────────────────────┘
                       │ HTTP (la búsqueda llega por partes, una línea JSON por evento)
┌──────────────────────▼────────────────────────────────────┐
│                  BACKEND (Deno + Hono)                    │
│  /api/buscar-vivo · /api/buscar · /api/comparar · ...     │
│  Corrección de tipeo · fichas guardadas · cola de escritura│
└────┬──────────────────────────────┬───────────────────────┘
     │ Deno.Command                 │
┌────▼──────────────┐      ┌────────▼───────────────────────┐
│ Scrapers Python   │      │ IA: Azure OpenAI y Gemini       │
│ 4 tiendas en      │      │ (solo la ficha olfativa; se     │
│ paralelo; entrega │      │ consulta una vez por perfume)   │
│ cada tienda apenas│      └─────────────────────────────────┘
│ responde          │
└────┬──────────────┘
     │
┌────▼──────────────────────────────────────────┐
│  TIENDAS                                      │
│  • Falabella (__NEXT_DATA__ JSON)             │
│  • DBS Beauty Store (HTML, data-src)          │
│  • Alisha Perfumes (JSON de Shopify)          │
│  • Farmacias Ahumada (Salesforce Commerce)    │
└───────────────────────────────────────────────┘
```

No hay base de datos: los datos viven en archivos JSON dentro de `backend/` y toda escritura pasa por una cola para que dos procesos no se pisen.

---

## Funcionalidades

### Búsqueda en 4 tiendas
- Las ofertas de cada tienda aparecen apenas responde: las primeras llegan a los 2 a 2,5 segundos, sin esperar a la más lenta.
- Tolera errores de tipeo ("savage dior", "versache eroz"): corrige contra los perfumes conocidos, avisa "Mostrando resultados de …" y deja buscar lo escrito tal cual.
- Stock verificado en tres estados: En Stock, Agotado y Sin verificar. El mejor precio ignora las ofertas agotadas.
- Filtra lo que no es perfume (cremas, vinilos, ropa) y los productos repetidos.
- Al hacer clic en el buscador se despliegan tus perfumes guardados y tus búsquedas recientes.

### Ficha del perfume
- Notas de salida, corazón y fondo, familia, duración, proyección y perfil olfativo.
- La ficha sigue a la oferta abierta: si es otra versión (por ejemplo Eros Flame al buscar Eros), no muestra las notas del perfume buscado.
- Cada ficha se guarda en `fichas_conocidas.json`. Si la IA no conoce un lanzamiento reciente, la ficha se arma con la descripción que publica la tienda y lo avisa; si ninguna tienda publica notas, el perfume queda sin ficha en vez de con una inventada.

### Alergias
- Los 26 alérgenos que la norma europea obliga a declarar.
- Con la lista de ingredientes del envase (la publica Falabella), el semáforo usa los alérgenos declarados; la lista se reusa para el mismo perfume y concentración en otro tamaño o tienda.
- Sin la lista, el resultado es "Sin verificar": una estimación por las notas nunca da "Compatible".
- "Ver ingredientes y cantidades" muestra cada ingrediente con su función y una cantidad aproximada.

### Catálogo con filtros
- Unos cien perfumes con filtros por notas (combinando todas o cualquiera), familia, marca, género, concentración, ocasión y precio, y la opción "Sin mis alérgenos en sus notas".
- Las etiquetas salen de los acordes principales de cada ficha, para que el filtro separe de verdad.
- Los filtros de texto aceptan errores y palabras a medio escribir.
- El catálogo se re-cotiza solo una vez al día con el backend encendido.

### Comparador
- Dos perfumes lado a lado: precio, precio por ml (y botón para comparar el mismo tamaño), duración, notas en común y perfil olfativo.
- Veredicto "Para tu piel" según tus alérgenos y si están declarados en el envase.
- Cada lado muestra los datos de su ficha solo si la oferta elegida es de ese perfume.

### Historial de precios
- Compara solo el mismo producto en la misma tienda (mismo tamaño y concentración).
- El gráfico y el precio tachado aparecen recién con registros de al menos 2 fechas distintas: no se inventan curvas.

### Dónde conseguirlo cerca
- Una tarjeta por cada tienda que vende el perfume con stock: precio, local más cercano, si está abierto ahora y cómo llegar.
- Mapa de OpenStreetMap con los locales de esas tiendas.
- Horario por día y coordenadas de 229 locales de Farmacias Ahumada en la Región Metropolitana, obtenidos de su buscador oficial.
- Locales de DBS (23) y Alisha (5) leídos de sus páginas, con horario por día, ubicados con OpenStreetMap.
- Los 4 locales de Falabella están escritos a mano con coordenadas verificadas; su horario es referencial y se marca como tal.
- Ordena por cercanía con la ubicación del navegador (fórmula de Haversine).

### Otras
- **Para ti:** recomendaciones según tu lista, tus búsquedas y tus alergias, con el motivo de cada una.
- **Mi perfil:** un solo botón con Mi Lista, Mis Alergias y la cuenta.
- **Resultados al instante:** si un perfume ya se buscó antes, se muestran al tiro sus últimos precios conocidos mientras se consultan las tiendas, y al terminar se marca qué precios cambiaron.
- **Links que se pueden compartir:** la dirección sigue a la pantalla (`?buscar=Sauvage%20Dior`, `?vista=comparar&a=Acqua%20Di%20Gio&b=Sauvage%20Dior`); funcionan Atrás, Adelante y recargar.
- **Cuenta (opcional):** registro con correo y contraseña; Mi Lista y las alergias se guardan en la cuenta para usarlas desde otro equipo. Se puede cambiar la contraseña y borrar la cuenta. En el servidor, la lista y las alergias se guardan cifradas (AES-256-GCM).
- **Mi Lista:** perfumes guardados por comprar, favoritos y para regalar, más listas propias con nombre (un perfume puede estar en varias). El mismo perfume se puede guardar en distintos tamaños. Cada uno se vuelve a cotizar una vez al día y muestra si bajó o subió desde que lo guardaste; el botón de la barra avisa cuántos bajaron.
- **Escáner de fotos:** identifica el perfume desde una foto del frasco y lo busca.
- **Reseñas:** las escriben usuarios con cuenta, una por perfume (se puede editar y borrar); no hay reseñas de ejemplo.
- **Comparador en palabras simples:** debajo del radar olfativo explica en qué se diferencian los dos perfumes, para cuándo sirve cada uno y qué significa cada eje.
- **Registro del sistema** con el tiempo de cada tienda.
- **Español e inglés:** selector ES / EN en la barra de arriba; la elección queda guardada en el navegador. Las fichas de la IA también tienen su versión en inglés; los nombres de productos y lo que publican las tiendas se muestran como lo escriben ellas.

### Diseño
Tema "almacén de campo": de día, papel kraft y tinta; de noche, una pizarra con marco de madera. Letra Bitter para los datos y Caveat para el letrero. Los colores del semáforo de alergias no forman parte del tema.

---

## Estructura del proyecto

```
proyecto-maurleiva/
├── backend/
│   ├── server.ts                  # API Deno + Hono (búsqueda, IA, catálogo, refresco)
│   ├── utilidades.ts              # Identidad de producto por URL, fórmula, cola de escritura
│   ├── scraper_stock.py           # Precios y stock en las 4 tiendas
│   ├── scraper_sucursales.py      # Horarios y coordenadas de Ahumada
│   ├── crawler_knasta.py          # Índice masivo del catálogo (se corre a mano)
│   ├── *_test.ts, test_*.py       # Tests del backend
│   ├── catalogo_descubiertos.json # Catálogo aprendido de las búsquedas
│   ├── fichas_conocidas.json      # Fichas olfativas guardadas
│   ├── ingredientes_conocidos.json# Listas de ingredientes del envase
│   ├── historial_precios.json     # Un registro por producto, tienda y día
│   ├── reviews_comunidad.json     # Reseñas (fuera de git)
│   ├── imagenes/                  # Fotos descargadas del catálogo
│   └── .env.example               # Plantilla de variables
├── frontend/
│   ├── public/catalogo_knasta.json# Catálogo indexado
│   ├── src/
│   │   ├── App.tsx, App.css       # Pantalla principal (búsqueda, vista del producto, estado) y tema
│   │   ├── tipos.ts               # Tipos de datos: ofertas, fichas, locales, reseñas
│   │   ├── ofertas.ts             # Tamaño, precio por ml, concentración, mismo producto, distancia
│   │   ├── sugerencias.ts         # Sugerencias del campo de perfume y fotos del catálogo
│   │   ├── i18n.ts, i18n/en.ts    # Idiomas: t() y el diccionario en inglés
│   │   ├── fichaIdioma.ts         # La ficha en el idioma elegido
│   │   ├── components/            # Comparador, ficha, guía, locales, reseñas, tarjeta de oferta,
│   │   │                          # ingredientes, alergias, Mi Lista, catálogo, cuenta...
│   │   ├── etiquetas.ts           # Etiquetas del catálogo (compartidas con el backend)
│   │   ├── busquedaFlexible.ts    # Tolerancia a errores de tipeo
│   │   ├── nombres.ts             # Si una oferta es el perfume de la ficha
│   │   ├── alergenos.ts           # Los 26 alérgenos de la norma europea
│   │   ├── ingredientes.ts        # Lectura de la lista del envase
│   │   ├── veredictoPiel.ts       # Veredicto "Para tu piel" del comparador
│   │   └── paraTi.ts              # Recomendaciones
│   └── tests/                     # Tests del frontend (node tests/x.test.ts)
├── INICIAR_PERFUMESCAN.bat        # Lanzador para Windows
├── Autoria.md
├── Bitacora.md                    # Bitácora semanal del proyecto
├── Commit log.md
├── COMO_CORRER.md
├── GUIA_DEMOSTRACION.md
└── README.md
```

---

## Variables de entorno

Crear `backend/.env` a partir de `backend/.env.example`:

| Variable | Descripción | Obligatoria |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT_NAME` | Azure OpenAI, la IA que se usa primero | Una de las dos IA |
| `GEMINI_API_KEY` | Google Gemini, respaldo si Azure no responde | Una de las dos IA |
| `AZURE_CONNECTION_STRING` | Azure Blob Storage para las fotos del escáner | Opcional |
| `REFRESCO_DIARIO` | `0` desactiva la re-cotización diaria del catálogo | Opcional |
| `REFRESCO_POR_DIA` | Cuántos perfumes del catálogo se re-cotizan cada día, empezando por los de precio más antiguo (por defecto 80) | Opcional |
| `ORIGENES_PERMITIDOS` | Direcciones extra desde las que se puede usar la API con sesión, separadas por coma (la de la app publicada) | Al publicarla |
| `DETRAS_DE_PROXY` | `1` cuando el backend está detrás de un proxy (Railway), para leer la IP real en el límite de intentos | Al publicarla |
| `CORREOS_ADMIN` | Correos (separados por coma) de las cuentas que pueden borrar el registro de la consola desde otro equipo; desde el mismo equipo del backend no hace falta | Al publicarla, si se quiere borrar el registro |
| `CLAVE_DATOS` | Clave (32 bytes en base64) con que se cifran Mi Lista y las alergias de las cuentas. Si falta, se crea `backend/clave_datos.key` (fuera de git): respáldala, sin ella no se leen los datos guardados | Opcional |

Sin ninguna IA la aplicación funciona igual: muestra las fichas ya guardadas y, para una docena de perfumes muy conocidos, una ficha de respaldo escrita a mano (también cuando la IA se queda sin cuota). Los demás perfumes quedan sin ficha. La clave de Gemini se obtiene gratis en https://aistudio.google.com/app/apikey.

---

## Endpoints de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/buscar-vivo?q=nombre` | Búsqueda por partes: ofertas de cada tienda, ficha y resultado final (NDJSON) |
| `GET` | `/api/buscar?q=nombre` | La misma búsqueda en una sola respuesta. `literal=1` busca sin corregir |
| `GET` | `/api/comparar?p1=X&p2=Y` | Compara dos perfumes |
| `GET` | `/api/cotizar?url=...` | Precio actual de un producto leyendo su página |
| `GET` | `/api/catalogo` | Catálogo aprendido |
| `GET` | `/api/ingredientes/frecuencias` | En cuántos perfumes con lista conocida aparece cada alérgeno |
| `GET` | `/api/refresco` | Avance y resumen de la re-cotización diaria |
| `GET` | `/api/logs` | Registro del sistema |
| `POST` | `/api/analizar` | Identifica un perfume desde una foto |
| `GET` | `/api/reviews?perfume=...` | Reseñas de un perfume (y cuáles son tuyas) |
| `POST` / `DELETE` | `/api/reviews`, `/api/reviews/:id` | Publicar o borrar tu reseña (piden sesión) |
| `POST` | `/api/descubrir-por-filtros` | Busca perfumes nuevos con las notas elegidas |
| `POST` | `/api/cuenta/registro`, `/api/cuenta/entrar`, `/api/cuenta/salir` | Crear cuenta, entrar y salir (sesión en cookie) |
| `GET` | `/api/cuenta` | Quién inició sesión |
| `GET` / `PUT` | `/api/cuenta/datos` | Mi Lista y alergias del usuario con sesión |
| `POST` | `/api/cuenta/contrasena`, `/api/cuenta/borrar` | Cambiar la contraseña o borrar la cuenta (piden la contraseña actual) |

Para re-etiquetar el catálogo completo con la IA: `deno run -A --env server.ts --etiquetar` (desde `backend`, con el servidor apagado).
Para traducir al inglés las fichas guardadas que no tengan traducción: `deno run -A --env server.ts --traducir` (también con el servidor apagado).

---

## Autor

**Mauricio Leiva** — Ingeniería de Software, 2026  
Proyecto académico desarrollado con asistencia de IA generativa (Antigravity / Gemini en las primeras semanas y Claude Code desde la semana 5). El detalle está en [Autoria.md](Autoria.md).

---

## Licencia

Proyecto académico — uso educativo solamente.
