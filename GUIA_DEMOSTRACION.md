# Guía de Demostración — PerfumeScan Chile
**Semana 6**

Este documento resume el guion recomendado para la demostración en vivo, las preguntas que probablemente haga el evaluador y las limitaciones conocidas.

---

## 1. Guion recomendado (5 a 7 minutos)

Antes de empezar: iniciar con `INICIAR_PERFUMESCAN.bat` unos minutos antes y hacer una búsqueda de prueba, para que las fichas de los perfumes del guion ya estén guardadas.

### Paso 1: Búsqueda mal escrita, con resultados por partes
- **Acción:** En el buscador escribe **"savage dior"** (sin la u) y pulsa **Cotizar**.
- **Destacar:**
  - Aparece **"Mostrando resultados de sauvage dior"** con el enlace **"Buscar “savage dior” tal cual"**.
  - Las ofertas llegan tienda por tienda (**"Ya hay ofertas. Siguen respondiendo las otras tiendas..."**): las primeras en unos 2 segundos.
- **Qué decir:** *"La búsqueda corrige errores de tipeo contra los perfumes que la aplicación ya conoce, pero solo si todas las palabras calzan con uno: así no le cambia el nombre a un perfume nuevo. Y muestra cada tienda apenas responde, en vez de esperar a la más lenta."*

### Paso 2: Ficha del perfume y alérgenos del envase
- **Acción:** En la ficha de Sauvage abre la pestaña **"A qué huele"** y después el botón **"Ver ingredientes y cantidades"**.
- **Destacar:**
  - La pirámide olfativa y el perfil olfativo.
  - La lista del envase ingrediente por ingrediente, con su función, una cantidad aproximada y los alérgenos declarados.
  - El semáforo de alergias arriba de la ficha.
- **Qué decir:** *"Los alérgenos no se adivinan: si la tienda publica la lista del envase, se usan los declarados. Si no, el semáforo dice 'Sin verificar'; nunca da verde con una estimación."*

### Paso 3: La ficha sigue a la oferta
- **Acción:** Busca **"versace eros"** y en los botones de oferta elige **Eros Flame**.
- **Destacar:** Aparece **"Esta oferta es Eros Flame, no Eros"** y la ficha de Eros deja de mostrarse para esa oferta. Al volver a una oferta de Eros, reaparece.
- **Qué decir:** *"Una búsqueda trae otras versiones del mismo perfume. Mostrar las notas de Eros en la oferta de Eros Flame sería dar información de otro producto."*

### Paso 4: Un lanzamiento que la IA no conoce
- **Acción:** Busca **"giorgio armani power of you"** y abre la pestaña **"A qué huele"**.
- **Destacar:** La ficha lleva el aviso **"Lanzamiento reciente: esta ficha se armó con la descripción que publican las tiendas"**. Con ese nombre la ficha ya está guardada y aparece al instante; con otro nombre la aplicación volvería a consultar a la IA (hasta unos 20 segundos).
- **Qué decir:** *"La IA no conoce los perfumes posteriores a su fecha de corte y, en vez de decir que no sabe, describía otro perfume de la marca. Ahora esa ficha se descarta y se arma con lo que publica la tienda."*

### Paso 5: Catálogo con filtros por notas
- **Acción:** Vuelve al inicio. En el catálogo marca **"Chocolate / Cacao"** y **"Madera"** y deja **"Combinar todas (Y)"**. Luego escribe **"vainila"** en "Otra nota".
- **Destacar:** El catálogo se filtra al instante y el filtro de texto acepta el error de tipeo.
- **Qué decir:** *"Las etiquetas salen de los acordes principales de cada perfume. Antes casi todos tenían 'Madera' y el filtro no separaba nada."*

### Paso 6: Comparador
- **Acción:** Entra a **Comparador** y elige **"Acqua Di Gio vs Sauvage"** en "Comparaciones rápidas". Pulsa **"Comparar ambos en 100 ml"**.
- **Destacar:**
  - Los veredictos **Precio**, **Duración** y **Para tu piel**.
  - Con alergias configuradas, "Para tu piel" dice cuál declara tus alérgenos en el envase.
  - **En palabras simples** (debajo del radar): en qué se diferencian, para cuándo sirve cada uno y, en "¿Qué significa cada eje?", qué es frescura, dulzor, etc.
  - Si en un lado eliges la oferta de **Acqua di Giò Profondo**, ese lado deja de mostrar la duración, las notas y el perfil de Acqua di Giò.
- **Qué decir:** *"El comparador compara el mismo tamaño o el precio por ml, y cada lado muestra solo los datos que corresponden a la oferta elegida."*
- **Extra:** Copia la dirección del navegador (`?vista=comparar&a=…&b=…`), ábrela en otra pestaña y muestra que abre la misma comparación; luego usa **Atrás** para volver a la búsqueda anterior.

### Paso 7: Mis Alergias y Mi Lista
- **Acción:** Abre **Mi perfil → Mis Alergias**, marca un alérgeno (por ejemplo Salicilato de Bencilo) y vuelve a un perfume. Guarda un perfume con **"Guardar en Mi Lista y avisarme si baja"**, abre **Mi perfil → Mi Lista** y haz clic en el buscador.
- **Destacar:** El semáforo cambia según tu perfil. Mi Lista muestra el precio de hoy de cada perfume y si bajó o subió desde que lo guardaste, y el buscador despliega tus perfumes guardados para no tener que escribirlos.

### Paso 8: Dónde conseguirlo cerca
- **Acción:** En la ficha de un perfume abre la pestaña **"Dónde conseguirlo"** y pulsa **"Usar mi ubicación"**.
- **Destacar:** Una tarjeta por cada tienda que lo vende, con precio, local más cercano y si está abierto ahora; el mapa muestra solo los locales de esas tiendas.
- **Qué decir:** *"Antes la lista mostraba los locales más cercanos de cualquier cadena, aunque no vendiera el perfume. Las tiendas no publican el stock de cada local, así que la app lo advierte."*

---

## 2. Preguntas probables del evaluador

### A. ¿Por qué algunos perfumes no tienen ficha?
- **Respuesta:** *"La ficha la genera la IA, y la IA no conoce los lanzamientos recientes. En ese caso se arma con la descripción de la tienda. Si ninguna tienda publica las notas, el perfume queda sin ficha: preferimos no mostrar nada antes que una ficha inventada o de otro perfume."*

### B. ¿Las alergias son exactas?
- **Respuesta:** *"Cuando la tienda publica la lista de ingredientes, sí: son los alérgenos que el fabricante declara en el envase según la norma europea. Cuando no la publica, es una estimación por las notas y se muestra como 'Sin verificar'. La mayoría de las tiendas no publica la lista; ese es justamente el problema que motivó el proyecto."*

### C. ¿Por qué no corrigió mi búsqueda?
- **Respuesta:** *"Solo corrige cuando todas las palabras se parecen a un perfume que la aplicación ya conoce. Si es un perfume nuevo, se busca tal cual; y si ninguna tienda lo encuentra, se busca de nuevo con el nombre oficial que reconoce la IA."*

### D. ¿Por qué algunos perfumes no tienen gráfico en "Historial"?
- **Respuesta:** *"No se inventan curvas. El historial compara solo el mismo producto en la misma tienda y se grafica recién cuando hay registros de al menos dos fechas distintas."*

### E2. ¿Por qué la segunda búsqueda es instantánea?
- **Respuesta:** *"El servidor guarda el último resultado de cada búsqueda. Al buscar de nuevo lo muestra al tiro, mientras pregunta a las tiendas si algo cambió, y al terminar marca qué precios subieron o bajaron. Para saber si un precio cambió hay que preguntarle a la tienda: lo que evitamos es hacer esperar al usuario mientras tanto."*

### E. ¿Por qué tarda la ficha?
- **Respuesta:** *"Las ofertas aparecen apenas responde cada tienda. La ficha de un perfume que nunca se buscó espera a la IA, entre 6 y 20 segundos; después queda guardada y la próxima vez es inmediata."*

### F. ¿Es un mock?
- **Respuesta:** *"No. Los precios y el stock salen de las tiendas en el momento, y el registro del sistema muestra el tiempo de cada tienda. La IA solo genera la ficha olfativa: nunca precios ni stock."*

### H. ¿Hay algo cifrado?
- **Respuesta:** *"Sí. Las contraseñas no se guardan: se guarda un hash PBKDF2 con sal por usuario. Mi Lista y las alergias de cada cuenta se guardan cifradas con AES-256-GCM y una clave que está fuera del código y de git; el registro de un usuario no se puede abrir en la cuenta de otro. La sesión va en una cookie HttpOnly y en el servidor solo queda el hash del token."*

### G. ¿Cómo saben que dos ofertas son el mismo producto?
- **Respuesta:** *"Por la URL de la tienda; en Falabella, por el id del producto. Para saber si una oferta es el mismo perfume que la ficha se compara el nombre sin la concentración ni el género, y una palabra de versión ('Flame', 'Profondo', 'Intense') la convierte en otro perfume."*

### I. ¿Las reseñas son reales? ¿Dónde se guardan?
- **Respuesta:** *"Sí, solo las que escriben los usuarios: no hay reseñas de ejemplo. Publicar pide cuenta, hay una por cuenta y perfume, cada uno puede borrar la suya y al borrar la cuenta se borran sus reseñas. Se guardan en el servidor en `reviews_comunidad.json`, que no está en git; el servidor revisa calificación y largos y nunca entrega quién es la cuenta detrás del apodo."*

---

## 3. Limitaciones conocidas
- Ocho perfumes del catálogo no tienen ficha: la IA no los conoce y sus tiendas no publican notas.
- Los horarios reales son solo de Farmacias Ahumada (229 locales); los de las demás tiendas son referenciales.
- La re-cotización diaria solo corre con el backend encendido.
- Las reseñas se guardan por el nombre del perfume que se ve; si un perfume no tiene ficha, se usa el nombre de la oferta de la tienda, así que sus reseñas pueden quedar repartidas entre dos nombres.
- Si una tienda cambia su página, ese scraper deja de traer ofertas y las demás siguen funcionando.

---

## 4. Estado de la entrega (Semana 6)
- **Frontend:** React 19 + TypeScript + Vite + Lucide Icons + SVG nativo. Tema "almacén de campo" con Bitter y Caveat.
- **Backend:** Deno + Hono, con scrapers en Python (Beautiful Soup 4 + Requests) y búsqueda entregada por partes.
- **IA:** Azure OpenAI con Gemini de respaldo, solo para la ficha olfativa; cada ficha se consulta una vez y queda guardada.
- **Normativa:** los 26 alérgenos que el Reglamento (CE) 1223/2009 de la Unión Europea obliga a declarar.
- **Pruebas:** tests del frontend (`node tests/*.test.ts`) y del backend (`deno test utilidades_test.ts`, `python test_scraper_stock.py`, `python test_scraper_sucursales.py`).
- **Control de versiones:** repositorio Git con bitácora semanal, registro de commits y declaración de autoría.
