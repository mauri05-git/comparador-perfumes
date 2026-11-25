# Cómo correr PerfumeScan localmente

## Requisitos previos
- **Deno** instalado (`deno --version`)
- **Python 3** con las librerías: `pip install requests beautifulsoup4`
- Archivo `.env` en la carpeta `backend/` con tus keys

## 1. Archivo `.env` (crear en /backend)

```env
# IA para la ficha olfativa: basta con una de las dos (Azure se usa primero, Gemini es el respaldo)
AZURE_OPENAI_ENDPOINT=https://tu-recurso.openai.azure.com
AZURE_OPENAI_API_KEY=tu-clave-de-azure-openai
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
GEMINI_API_KEY=tu-api-key-de-google-ai-studio

# Opcional: fotos del escáner en Azure Blob Storage
AZURE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
```

Sin ninguna IA la aplicación funciona igual: muestra las fichas ya guardadas y, para una docena de perfumes muy conocidos, una ficha de respaldo escrita a mano (también cuando la IA se queda sin cuota). Los demás perfumes quedan sin ficha.

## 2. Instalar dependencias Python

```bash
pip install requests beautifulsoup4
```

## 3. Forma rápida (Windows)

Compila el frontend una vez (`cd frontend`, `npm.cmd install` y `npm.cmd run build`) y abre `INICIAR_PERFUMESCAN.bat`: levanta el backend y sirve el frontend compilado en http://localhost:5173. Después de cambiar código del frontend hay que volver a compilar.

## 3b. Terminal 1 — Iniciar el backend

```bash
cd backend
deno run --allow-net --allow-env --allow-read --allow-write --allow-run --env server.ts
```

Debería verse:
```
Servidor corriendo en http://localhost:8000
  POST /api/analizar  - Analiza foto de perfume
  GET  /api/buscar?q= - Busca por nombre directamente (multitienda + caché + alérgenos)
  ...
Listening on http://localhost:8000/
```

## 4. Terminal 2 — Iniciar el frontend

```bash
cd frontend
npm install   # solo la primera vez
npm run dev
```

Abre http://localhost:5173 en el navegador.

---

## Probar sin el frontend (con curl o el navegador)

### Probar búsqueda por nombre directamente en el navegador:
```
http://localhost:8000/api/buscar?q=Acqua+Di+Gio
http://localhost:8000/api/buscar?q=Sauvage+Dior
http://localhost:8000/api/buscar?q=Bleu+de+Chanel
```

### La misma búsqueda por partes (como la usa el frontend):
```
http://localhost:8000/api/buscar-vivo?q=savage+dior
```
Cada línea es un evento: `corregida` (si corrigió un error de tipeo), `ofertas` (una por tienda), `ficha` y, al final, `fin` con la respuesta completa. Con `&literal=1` se busca exactamente lo escrito.

### Con curl (PowerShell):
```powershell
Invoke-WebRequest "http://localhost:8000/api/buscar?q=Sauvage+Dior" | Select-Object -ExpandProperty Content
```

### Probar el scraper Python directamente:
```bash
cd backend
python scraper_stock.py Sauvage Dior
python scraper_stock.py Bleu de Chanel
python scraper_stock.py Acqua Di Gio
```

### Tests:
```bash
cd backend
deno test utilidades_test.ts
deno test -A cuentas_test.ts
python test_scraper_stock.py
python test_scraper_sucursales.py
python test_crawler_knasta.py
deno check server.ts

cd ../frontend
node tests/etiquetas.test.ts
node tests/nombres.test.ts
node tests/alergenos.test.ts
node tests/ingredientes.test.ts
node tests/veredictoPiel.test.ts
node tests/paraTi.test.ts
node tests/paginas.test.ts
node tests/lecturaRadar.test.ts
node tests/traducciones.test.ts
node tests/fichaIdioma.test.ts
```

### Volver a leer el catálogo de las tiendas
Recorre 33 marcas de hombre y de mujer en Falabella, DBS, Alisha y Ahumada (unos 3 minutos) y escribe `frontend/public/catalogo_knasta.json`. Después hay que reconstruir el frontend para que la app lo cargue.
```bash
cd backend
python crawler_knasta.py > NUL
cd ../frontend
npm run build
```

### Re-etiquetar el catálogo completo
Con el backend apagado, desde `backend`:
```bash
deno run -A --env server.ts --etiquetar
```
Pide a la IA la ficha de cada perfume que no la tenga (una sola vez por perfume) y recalcula las etiquetas de los dos catálogos. Se puede interrumpir y repetir sin volver a consultar las fichas ya guardadas. Con un número al final (`--etiquetar 10`) procesa solo los primeros.

---

## Preguntas frecuentes

### ¿Por qué Gemini no responde a veces?
- **Error 503**: Servidores saturados (alta demanda en el tier gratuito). El backend rota automáticamente al siguiente modelo de Gemini.
- **Error 429**: Límite de requests por minuto alcanzado (15 RPM en free tier).
- **Alternativa**: Si se configuran las variables `AZURE_OPENAI_*` en `.env`, el backend usa Azure OpenAI primero y Gemini queda como respaldo.

### No aparece la ficha olfativa
Verificar que el archivo `.env` esté en la carpeta `backend/` y que tenga Azure OpenAI o Gemini configurado. Si el perfume es un lanzamiento reciente que la IA no conoce, la ficha se arma con la descripción de la tienda; si ninguna tienda publica notas, el perfume queda sin ficha.

### El scraper devuelve `[]`
- Verificar conexión a internet
- Probar directamente: `python scraper_stock.py Acqua Di Gio`
- Falabella puede tener rate limiting temporal, esperar unos minutos

### Traducir las fichas al inglés
Con el backend apagado, desde `backend`:
```bash
deno run -A --env server.ts --traducir
```
Traduce las fichas guardadas que todavía no tienen su versión en inglés (las nuevas ya llegan traducidas). Se puede interrumpir y repetir sin volver a traducir las hechas. Con un número al final (`--traducir 10`) traduce solo esa cantidad.

### Abrir la app desde un celular (misma red Wi-Fi)
Sirve para probar el escáner con la cámara del celular. En las redes de la universidad suele estar bloqueada la conexión entre equipos: en ese caso, conecta el notebook a la zona Wi-Fi (hotspot) del propio celular.

1. En `backend/.env` agrega `PERMITIR_RED_LOCAL=1` (acepta las direcciones privadas 192.168.x.x, 10.x.x.x y 172.16–31.x.x) y reinicia el backend.
2. En `frontend`, con la app ya compilada (`npm.cmd run build`):
   ```bash
   npm.cmd run red
   ```
   Muestra una línea `Network: http://192.168.x.x:5174`.
3. En el celular, conectado a la misma red, abre esa dirección. La primera vez Windows pregunta si Node y Deno pueden conectarse: acepta solo para redes **privadas**.

La página va por `http`, no `https`: alcanza para elegir o tomar una foto con el botón del escáner.
