# Cómo correr PerfumeScan localmente

## Requisitos previos
- **Deno** instalado (`deno --version`)
- **Python 3** con las librerías: `pip install requests beautifulsoup4`
- Archivo `.env` en la carpeta `backend/` con tus keys

## 1. Archivo `.env` (crear en /backend)

```env
AZURE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
GEMINI_API_KEY=tu-api-key-de-google-ai-studio
```

## 2. Instalar dependencias Python

```bash
pip install requests beautifulsoup4
```

## 3. Terminal 1 — Iniciar el backend

```bash
cd backend
deno run --allow-net --allow-env --allow-read --allow-write --allow-run --env server.ts
```

Debería verse:
```
Servidor corriendo en http://localhost:8000
  POST /api/analizar  - Analiza foto de perfume
  GET  /api/buscar?q= - Busca por nombre directamente
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

---

## Preguntas frecuentes

### ¿Por qué Gemini no responde a veces?
- **Error 503**: Servidores saturados (alta demanda en el tier gratuito). El backend rota automáticamente al siguiente modelo de Gemini.
- **Error 429**: Límite de requests por minuto alcanzado (15 RPM en free tier).
- **Alternativa**: Si se configuran las variables `AZURE_OPENAI_*` en `.env`, el backend usa Azure OpenAI primero y Gemini queda como respaldo.

### El backend dice "Faltan variables .env"
Verificar que el archivo `.env` esté en la carpeta `backend/` y que tenga las dos variables.

### El scraper devuelve `[]`
- Verificar conexión a internet
- Probar directamente: `python scraper_stock.py Acqua Di Gio`
- Falabella puede tener rate limiting temporal, esperar unos minutos
