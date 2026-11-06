# Guía de Demostración y Detalles Técnicos — PerfumeScan Chile
**Incremento 2 (Semana 4)**

Este documento resume los puntos clave, limitaciones conocidas a simple vista, justificaciones técnicas y el guion paso a paso recomendado para la presentación o demostración en vivo del proyecto.

---

## 1. Guion Recomendado para la Demostración en Vivo

Para una demostración fluida de 3 a 5 minutos, sigue este orden para mostrar lo más innovador y sólido del proyecto:

### Paso 1: Explorador del Catálogo por Notas Olfativas (0ms)
- **Acción:** En el panel lateral izquierdo, activa las casillas **"Chocolate / Cacao"** y **"Madera"**.
- **Destacar:** Cambia el selector lógico de **"O (Cualquiera)"** a **"Y (Todas)"** para mostrar cómo el catálogo filtra instantáneamente solo aquellos perfumes que poseen ambos acordes a la vez (lógica booleana `AND` / `OR`).
- **Qué decir:** *"Los comparadores tradicionales exigen saberse el nombre del perfume. En PerfumeScan el usuario puede descubrir fragancias según sus gustos olfativos directamente sobre el catálogo chileno"*.

### Paso 2: Ficha de Producto y Semáforo de Alérgenos IFRA
- **Acción:** Haz clic en una tarjeta (ej: *Terre d'Hermès*, *Bad Boy* o *Sauvage*).
- **Destacar:**
  - **Radar Olfativo 6D:** Gráfico vectorial hexagonal en SVG (*Frescura, Dulzor, Amaderado, Especiado, Floral y Fijación*).
  - **Semáforo Dermatológico IFRA:** Muestra la compatibilidad según 8 alérgenos que la normativa obliga a declarar (*Limoneno, Linalool, Cumarina, etc.*). La detección es una estimación a partir de las notas del perfume, no de la lista de ingredientes del envase.
  - **Enlace a Tienda Oficial:** El botón *"Visitar Falabella / DBS"* abre directamente la ficha real de compra del producto.
- **Qué decir:** *"Integramos la norma dermatológica internacional IFRA para advertir alérgenos en piel sensible antes de comprar, además de dar acceso directo a la tienda con precio verificado"*.

### Paso 3: Duelo Frente a Frente (Comparador VS)
- **Acción:** Entra a la pestaña **Duelos de Fragancias** y haz clic en uno de los duelos rápidos predefinidos (ej: *Acqua Di Giò vs Sauvage*).
- **Destacar:**
  - Superposición gráfica del Radar 6D de ambos perfumes.
  - **Matriz de Veredicto:** Análisis comparativo de qué perfume conviene más según precio total, costo por mililitro, fijación en piel y seguridad dérmica.
- **Qué decir:** *"El comparador no solo contrasta precios, sino la relación costo/rendimiento y longevidad en piel para tomar una decisión informada"*.

### Paso 4: Lista de Compras y Presupuesto
- **Acción:** Agrega un perfume a la lista de compras y abre el cajón lateral (*"Mi Lista de Compras"*).
- **Destacar:** Cálculo automático del total en CLP, clasificación por propósito (*Por Comprar, Favorito, Regalo*) y botón de exportar resumen.

---

## 2. Puntos a Tener en Cuenta a Simple Vista (Preguntas Frecuentes del Evaluador)

Si el profesor o evaluador inspecciona la app en detalle, ten claras estas respuestas:

### A. Catálogo Offline vs. Búsqueda en Vivo
- **Situación:** El catálogo (110+ perfumes, notas, radar 6D, filtros) funciona **100% en el navegador a 0ms sin requerir servidor backend**. Si se escribe en la barra superior o se pulsa *"Buscar en las 4 tiendas en vivo"*, se intenta consultar al servicio Python en el puerto 8000.
- **Respuesta:** *"El sistema opera con arquitectura desacoplada: tiene un índice local pre-calculado para lectura instantánea (como hace Knasta) y un módulo de scraping en vivo bajo demanda para cotizaciones concurrentes en tiempo real"*.

### B. ¿Por qué algunos perfumes no tienen gráfico en la pestaña "Historial"?
- **Situación:** Al entrar a la pestaña *Historial* de un perfume recién descubierto, indica que aún no hay historial registrado.
- **Respuesta:** *"Por honestidad y rigor de datos, eliminamos curvas simuladas o falsas. El historial de precios solo se grafica cuando el sistema ha capturado registros en fechas distintas a lo largo del tiempo"*.

### C. En la pestaña "Todas las Tiendas" aparece 1 tienda al abrir desde el Catálogo
- **Situación:** En la vitrina del catálogo se muestra la oferta ganadora indexada (ej: Falabella o DBS).
- **Respuesta:** *"Para optimizar la velocidad y no saturar los sitios web con miles de peticiones simultáneas, el índice guarda la mejor oferta encontrada; el botón 'Buscar en las 4 tiendas en vivo' permite profundizar la búsqueda en tiempo real si el usuario lo solicita"*.

### D. Sucursales Físicas en Santiago
- **Situación:** Los locales de Falabella, DBS y Ahumada están georreferenciados en Santiago (*Parque Arauco, Costanera Center, Providencia, Huérfanos*).
- **Respuesta:** *"Es la prueba de concepto del módulo GPS georreferenciado; la arquitectura está preparada para recibir la nómina nacional completa de sucursales en el siguiente incremento"*.

### E. Variaciones de Stock en Retail (30ml vs 100ml)
- **Situación:** En el retail chileno el inventario fluctúa con frecuencia (a veces se agotan los 100ml y queda solo 30ml o 200ml).
- **Respuesta:** *"La plataforma muestra el último precio indexado con fecha y hora, y provee el enlace directo para que el consumidor valide el stock final en la pasarela de la tienda"*.

---

## 3. Estado de la Entrega (Semana 4 / Incremento 2)
- **Frontend:** React 19 + TypeScript + Vite + Lucide Icons + SVG Nativo (sin librerías pesadas).
- **Backend:** Deno + Hono, con scraper en Python (Beautiful Soup 4 + Requests).
- **Normativa:** IFRA Fragrance Safety Standards + Material Design 3.
- **Control de Versiones:** Repositorio Git sincronizado con bitácora de commits y autoría de código.
