import requests
from bs4 import BeautifulSoup
import json
import sys
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import time
from datetime import date, timedelta

# ─────────────────────────────────────────────
#  HEADERS comunes
# ─────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-CL,es;q=0.9",
}

# Palabras que NUNCA corresponden a un perfume (ropa, música, deco, bazar, papelería)
CATEGORIAS_NO_PERFUME = [
    # Música, vinilos, audio
    "vinilo", "vinilos", "disco", "discos", "cd", "lp", "cassette", "tocadiscos",
    # Hogar, dormitorio, decoración y papelería
    "cama", "camas", "colchon", "colchones", "almohada", "almohadas", "respaldo",
    "mural", "murales", "decomural", "cuadro", "cuadros", "poster", "posters",
    "lamina", "laminas", "adhesivo", "adhesivos", "sticker", "stickers",
    "cojin", "cojines", "funda", "fundas", "cortina", "cortinas", "alfombra", "alfombras",
    "sabana", "sabanas", "cubrecama", "manta", "toalla", "toallas",
    "taza", "tazas", "termo", "termos", "vaso", "vasos", "plato", "platos",
    "mueble", "muebles", "lampara", "lamparas", "adorno",
    # Vestuario, calzado y accesorios
    "polera", "poleras", "pantalon", "pantalones", "camisa", "camisas",
    "poleron", "polerones", "chaqueta", "chaquetas", "abrigo", "ropa", "vestido", "vestidos",
    "falda", "faldas", "calcetines", "calzoncillo", "calzoncillos", "boxer",
    "zapatilla", "zapatillas", "zapato", "zapatos", "bota", "botas", "sandalia", "sandalias",
    "cartera", "carteras", "mochila", "mochilas", "billetera", "billeteras",
    "reloj", "relojes", "lentes", "anteojos", "gafas", "joya", "joyas", "collar", "anillo", "pulsera",
    # Entretenimiento y juguetes
    "libro", "libros", "revista", "revistas", "comic", "manga",
    "juguete", "juguetes", "peluche", "peluches", "figura", "figuras", "lego",
    "llavero", "llaveros", "juego de mesa",
    # Tecnología
    "celular", "carcasa", "funda celular", "cargador", "cable", "audifonos", "parlante"
]

# Palabras de farmacia / suplementos / higiene que no son perfume a menos que se indique fragancia
PALABRAS_PROHIBIDAS = [
    "toallitas", "toalla", "panal", "panales", "crema", "shampoo", "champu",
    "bloqueador", "serum", "mascarilla", "colageno", "desodorante", "pasta",
    "cepillo", "booster", "neovadiol", "emubaby", "detergente", "acondicionador",
    "protector solar", "toallita", "jabn", "jabon", "balsamo", "lubricante",
    "bcaa", "aminoacidos", "creatina", "proteina", "suplemento", "biotechusa",
    "vitamina", "capsulas", "comprimidos", "jarabe"
]

# Términos que identifican inequívocamente a una fragancia
TERMINOS_FRAGANCIA = [
    "perfume", "fragancia", "eau de", "edt", "edp", "edc", "parfum",
    "toilette", "cologne", "colonia", "vaporisateur", "spray",
    "body mist", "body splash", "tester"
]

STOCK_SI = "En Stock"
STOCK_NO = "Agotado"
STOCK_SIN_VERIFICAR = "Sin verificar"

# Lo que no salió bien en esta búsqueda y conviene anotar en el registro (Falabella respondiendo 403, por ejemplo).
# Sin esto un bloqueo se veía como "la tienda no publica nada".
AVISOS = []

# Detalle de cada producto de Falabella ya leído (ingredientes, notas, familia y tamaño de cada variante). Casi nunca
# cambia, y volver a pedir la página en cada búsqueda era la mayor parte de las consultas que hacen que Falabella
# bloquee por unos minutos.
ARCHIVO_DETALLES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "detalles_falabella.json")
DIAS_DETALLE = 30


def id_producto_falabella(url):
    m = re.search(r"/product/(\d+)", url or "")
    return m.group(1) if m else None


def leer_detalles():
    try:
        with open(ARCHIVO_DETALLES, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def detalle_guardado(detalles, url):
    """El detalle guardado del producto si tiene menos de DIAS_DETALLE días."""
    entrada = detalles.get(id_producto_falabella(url) or "")
    if not entrada:
        return None
    try:
        if date.fromisoformat(entrada["fecha"]) < date.today() - timedelta(days=DIAS_DETALLE):
            return None
    except Exception:
        return None
    return entrada


def guardar_detalles(nuevos):
    """Junta lo nuevo con lo que hay en disco y reemplaza el archivo de una vez: otra búsqueda puede estar
    escribiéndolo al mismo tiempo (el refresco diario corre dos a la vez)."""
    if not nuevos:
        return
    try:
        detalles = leer_detalles()
        detalles.update(nuevos)
        temporal = f"{ARCHIVO_DETALLES}.{os.getpid()}.tmp"
        with open(temporal, "w", encoding="utf-8") as f:
            json.dump(detalles, f, ensure_ascii=False)
        for _ in range(3):
            try:
                os.replace(temporal, ARCHIVO_DETALLES)
                break
            except PermissionError:
                time.sleep(0.2)  # Windows: el otro proceso lo tiene abierto un instante
    except Exception:
        pass


def url_imagen(img_el):
    """URL real de la foto. Las tiendas cargan las fotos al hacer scroll: en `src` dejan un GIF
    transparente (data:...) y la foto va en data-src, data-original o srcset."""
    if not img_el:
        return None
    srcset = (img_el.get("srcset") or "").split(",")[0].strip().split(" ")[0]
    for valor in (img_el.get("data-src"), img_el.get("data-original"), srcset, img_el.get("src")):
        if valor and not valor.startswith("data:"):
            return valor
    return None


def stock_falabella(datos_pdp, sku_id):
    producto = datos_pdp.get("props", {}).get("pageProps", {}).get("productData") or {}
    if not producto:
        return STOCK_SIN_VERIFICAR
    if producto.get("isOutOfStock"):
        return STOCK_NO
    for variante in producto.get("variants") or []:
        if str(variante.get("id")) == str(sku_id):
            return STOCK_SI if variante.get("isPurchaseable") else STOCK_NO
    return STOCK_SI


def detalle_falabella(datos_pdp):
    """Ingredientes y notas que Falabella publica en las especificaciones del producto."""
    producto = datos_pdp.get("props", {}).get("pageProps", {}).get("productData") or {}
    specs = {
        limpiar_texto(s.get("name")): (s.get("value") or "").replace("\xa0", " ").strip()
        for s in (producto.get("attributes") or {}).get("specifications") or []
    }
    detalle = {
        "ingredientes": specs.get("ingredientes"),
        "notasTienda": specs.get("notas aromaticas"),
        # "Frutal,Floral": la familia según la tienda, que ayuda a armar la ficha de un perfume que la IA no conoce
        "familiaTienda": specs.get("fragancia perfume"),
    }
    return {k: v for k, v in detalle.items() if v}


def precio_falabella(precios_raw):
    """Precio vigente (el no tachado) de una lista de precios de Falabella."""
    vigente = next((p for p in precios_raw or [] if not p.get("crossed", True)), (precios_raw or [None])[0])
    precio_str = ((vigente or {}).get("price") or [None])[0]
    if not precio_str:
        return None
    try:
        return float(str(precio_str).replace(".", "").replace(",", "."))
    except ValueError:
        return None


def normalizar_tamano(texto):
    """"30 ML" -> "30ml", como lo escriben las otras tiendas; None si no trae un número."""
    texto = (texto or "").strip()
    return re.sub(r"\s+", "", texto).lower() if re.search(r"\d", texto) else None


def tamanos_falabella(item):
    """Tamaños que el listado ofrece como opciones de un mismo producto ("30 ML", "50 ML", "90 ML"), cada uno con su
    precio, su enlace y su disponibilidad. El listado muestra el producto una sola vez, con el precio más bajo y sin
    decir de qué tamaño es: sin esto la oferta quedaba "Tamaño sin datos"."""
    for v in item.get("variants") or []:
        if v.get("type") != "SIZES":
            continue
        tamanos = []
        for o in v.get("options") or []:
            tamano = normalizar_tamano(o.get("size") or o.get("value"))
            precio = precio_falabella(o.get("prices"))
            if not tamano or not precio or not o.get("url"):
                continue
            tamanos.append({
                "tamano": tamano,
                "precio": precio,
                "url": o["url"],
                "sku": o.get("variant") or o.get("offeringId"),
                "stock": STOCK_SI if o.get("isPurchaseable") else STOCK_NO if o.get("isPurchaseable") is False else STOCK_SIN_VERIFICAR,
                "orden": o.get("sizeOrder") or 0,
            })
        return sorted(tamanos, key=lambda t: t["orden"])
    return []


def con_tamano(nombre, tamano):
    """Agrega el tamaño al final del nombre ("... Over Red - YVES SAINT LAURENT 30ml"), si no lo trae. Al final y no
    antes de la marca: al limpiar un título, lo que viene después del tamaño se descarta, y se perdía la marca."""
    if not tamano or re.search(r"\d\s*ml\b", nombre, re.I):
        return nombre
    return f"{nombre} {tamano}"


def tamano_de_variante(datos_pdp, sku_id):
    """Tamaño de la variante cotizada, leído de la ficha del producto."""
    producto = datos_pdp.get("props", {}).get("pageProps", {}).get("productData") or {}
    for v in producto.get("variants") or []:
        if str(v.get("id")) == str(sku_id):
            return normalizar_tamano((v.get("attributes") or {}).get("size"))
    return None


def consultar_stock_falabella(url, sku_id):
    """(stock, detalle) leyendo la ficha del producto; el detalle sale de la misma página, sin otra consulta."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=6)
        if resp.status_code != 200:
            return STOCK_SIN_VERIFICAR, {"_estado": resp.status_code}
        nd = BeautifulSoup(resp.text, "html.parser").find("script", id="__NEXT_DATA__")
        if not nd:
            return STOCK_SIN_VERIFICAR, {"_estado": "sin datos"}
        datos = json.loads(nd.string)
        detalle = detalle_falabella(datos)
        tamano = tamano_de_variante(datos, sku_id)
        if tamano:
            detalle["_tamano"] = tamano
        return stock_falabella(datos, sku_id), detalle
    except Exception:
        return STOCK_SIN_VERIFICAR, {"_estado": "sin respuesta"}


def stock_dbs(item):
    if item.select_one(".stock.unavailable") or "agotado" in item.get_text(" ", strip=True).lower():
        return STOCK_NO
    if item.select_one("form[data-role=tocart-form], button.tocart"):
        return STOCK_SI
    return STOCK_SIN_VERIFICAR


def stock_ahumada(tile):
    if "agotado" in tile.get_text(" ", strip=True).lower():
        return STOCK_NO
    for boton in tile.select("button"):
        if "agregar" in boton.get_text(" ", strip=True).lower():
            return STOCK_NO if boton.has_attr("disabled") else STOCK_SI
    return STOCK_SIN_VERIFICAR


def stock_alisha(producto):
    disponible = producto.get("available")
    if disponible is True:
        return STOCK_SI
    if disponible is False:
        return STOCK_NO
    return STOCK_SIN_VERIFICAR


def limpiar_texto(t):
    if not t:
        return ""
    t = t.lower()
    t = re.sub(r"[áàäâ]", "a", t)
    t = re.sub(r"[éèëê]", "e", t)
    t = re.sub(r"[íìïî]", "i", t)
    t = re.sub(r"[óòöô]", "o", t)
    t = re.sub(r"[úùüû]", "u", t)
    return t

def es_producto_relevante(nombre_prod, query_busqueda, precio=None):
    if not nombre_prod:
        return False
        
    # Ningún perfume de diseñador vale menos de $8.000 (evita toallitas o baratijas)
    if precio is not None and precio < 8000:
        return False

    p_clean = limpiar_texto(nombre_prod)
    q_clean = limpiar_texto(query_busqueda)

    # 1. Filtro estricto: categorías que NUNCA son perfume (vinilos, deco, ropa, etc.)
    for no_perfume in CATEGORIAS_NO_PERFUME:
        if re.search(rf"\b{re.escape(no_perfume)}\b", p_clean):
            return False

    # 2. Si contiene palabras de farmacia/higiene y no dice expresamente perfume/fragancia, descartar
    for prohibida in PALABRAS_PROHIBIDAS:
        if prohibida in p_clean and not any(term in p_clean for term in TERMINOS_FRAGANCIA):
            return False

    # Descartar stopwords muy cortas o ambiguas
    stopwords = {
        "para", "con", "del", "las", "los", "por", "que", "una", "uno", "set",
        "men", "man", "woman", "women", "hombre", "mujer", "eau", "toilette", "parfum",
        "edp", "edt", "edc", "perfume", "fragancia", "tester", "mini", "estuche", "est",
        "de", "la", "el", "di"
    }
    palabras_query = [w for w in re.findall(r"\b\w+\b", q_clean) if len(w) > 2 and w not in stopwords]

    if not palabras_query:
        return True

    # Coincidencia por palabra completa
    coincidencias = 0
    for w in palabras_query:
        if re.search(rf"\b{re.escape(w)}\b", p_clean):
            coincidencias += 1

    # 3. Si la búsqueda tiene solo 1 palabra relevante (o palabras muy genéricas como "name"),
    # exigir que el producto tenga al menos un indicador explícito de fragancia (eau de, edt, edp, perfume, etc.)
    if len(palabras_query) <= 1:
        tiene_termino_fragancia = any(t in p_clean for t in TERMINOS_FRAGANCIA)
        if not tiene_termino_fragancia:
            return False

    # Si la búsqueda tiene 2 o más palabras clave (ej: "Trussardi" y "Name", o "Acqua" y "Gio"),
    # requerir que coincidan al menos 2 para evitar productos homónimos de marcas baratas
    min_requerido = min(2, len(palabras_query))
    return coincidencias >= min_requerido


# ─────────────────────────────────────────────
#  FUENTE 1 — Falabella (Extracción vía __NEXT_DATA__)
# ─────────────────────────────────────────────
def buscar_falabella(nombre_perfume):
    resultados = []
    try:
        query = nombre_perfume.replace(" ", "+")
        url = f"https://www.falabella.com/falabella-cl/search?Ntt={query}"
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.encoding = "utf-8"

        if resp.status_code != 200:
            AVISOS.append(f"Falabella respondió {resp.status_code} a la búsqueda: esta vez no hay ofertas de Falabella")
            return resultados

        sopa = BeautifulSoup(resp.text, "html.parser")
        nd = sopa.find("script", id="__NEXT_DATA__")
        if not nd:
            AVISOS.append("Falabella respondió la búsqueda sin datos: esta vez no hay ofertas de Falabella")
            return resultados

        data = json.loads(nd.string)
        items = data.get("props", {}).get("pageProps", {}).get("results", [])
        skus_vistos = set()
        productos = []  # url y variante de cada producto, para leer su ficha

        for item in items[:12]:
            # Falabella repite productos en el listado (patrocinados)
            sku = item.get("skuId")
            if sku in skus_vistos:
                continue
            skus_vistos.add(sku)

            nombre = item.get("displayName", "Sin nombre")
            brand = (item.get("brand") or "").strip()

            # En Falabella Marketplace, 'GENERICO' o sin marca corresponde a baratijas/artesanías (vinilos, murales, etc.)
            if brand.upper() in ["GENERICO", "GENÉRICO", "GENERIC", "SIN MARCA"]:
                continue

            url_prod = item.get("url", "")
            imagen = (item.get("mediaUrls") or [None])[0]

            precio = precio_falabella(item.get("prices", []))

            nombre_limpio = f"{nombre} - {brand}" if brand and brand.lower() not in nombre.lower() else nombre
            nombre_limpio = nombre_limpio.encode("utf-8", "ignore").decode("utf-8")

            if not es_producto_relevante(nombre_limpio, nombre_perfume, precio):
                continue
            grupo = len(productos)
            tamanos = tamanos_falabella(item)
            if tamanos:
                # Una oferta por tamaño, cada una con su precio y su enlace; el stock viene en el listado
                for t in tamanos:
                    resultados.append({
                        "tienda": "Falabella",
                        "nombre": con_tamano(nombre_limpio, t["tamano"]),
                        "precio": t["precio"],
                        "moneda": "CLP",
                        "stock": t["stock"],
                        "url": t["url"],
                        "imagen": imagen,
                        "_grupo": grupo,
                    })
                productos.append({"url": tamanos[0]["url"], "sku": tamanos[0]["sku"], "con_tamanos": True})
            else:
                resultados.append({
                    "tienda": "Falabella",
                    "nombre": nombre_limpio,
                    "precio": precio,
                    "moneda": "CLP",
                    "stock": STOCK_SIN_VERIFICAR,
                    "url": url_prod,
                    "imagen": imagen,
                    "_grupo": grupo,
                })
                productos.append({"url": url_prod, "sku": item.get("skuId"), "con_tamanos": False})
            if len(productos) >= 4:
                break

        # El listado no trae el detalle (ingredientes, notas) ni, en un producto sin tamaños, el stock y el tamaño:
        # se lee la ficha de cada producto en paralelo, una vez por producto, y el detalle vale para todos sus tamaños
        # Un producto con tamaños ya trae su stock en el listado: si su detalle se leyó hace poco, no se vuelve a pedir
        # la página. Uno sin tamaños sí, porque de ahí sale su stock.
        guardados = leer_detalles()
        def consultar(p):
            previo = detalle_guardado(guardados, p["url"])
            if previo and p["con_tamanos"]:
                return STOCK_SIN_VERIFICAR, dict(previo.get("detalle") or {}), True
            stock, detalle = consultar_stock_falabella(p["url"], p["sku"])
            if "_estado" in detalle and previo:
                # La página no respondió: vale el detalle que ya se tenía
                return stock, {**(previo.get("detalle") or {}), "_tamano": previo.get("tamano"), "_estado": detalle["_estado"]}, True
            return stock, detalle, False

        with ThreadPoolExecutor(max_workers=4) as executor:
            consultas = list(executor.map(consultar, productos))

        nuevos, fallidas, estados = {}, 0, set()
        for prod, (stock, detalle, de_guardado) in zip(productos, consultas):
            if "_estado" in detalle:
                fallidas += 1
                estados.add(str(detalle["_estado"]))
            elif not de_guardado and id_producto_falabella(prod["url"]):
                nuevos[id_producto_falabella(prod["url"])] = {
                    "fecha": date.today().isoformat(),
                    "detalle": {k: v for k, v in detalle.items() if not k.startswith("_")},
                    "tamano": detalle.get("_tamano"),
                }
        guardar_detalles(nuevos)
        if fallidas:
            AVISOS.append(
                f"Falabella no entregó {fallidas} de {len(productos)} páginas de producto ({', '.join(sorted(estados))}): "
                "faltan sus notas e ingredientes"
            )

        for r in resultados:
            prod = productos[r["_grupo"]]
            stock, detalle, de_guardado = consultas[r["_grupo"]]
            tamano = detalle.get("_tamano")
            r.update({k: v for k, v in detalle.items() if not k.startswith("_")})
            if "_estado" in detalle and not de_guardado:
                # Para que la app diga por qué falta la ficha, en vez de "la tienda no publica notas"
                r["detalleNoDisponible"] = True
            if not prod["con_tamanos"]:
                r["stock"] = stock
                r["nombre"] = con_tamano(r["nombre"], tamano)
    except Exception:
        pass

    for r in resultados:
        r.pop("_grupo", None)
    return resultados


# ─────────────────────────────────────────────
#  FUENTE 2 — DBS Beauty Store (Perfumería y Belleza Fina)
# ─────────────────────────────────────────────
def buscar_dbs(nombre_perfume):
    resultados = []
    try:
        query = nombre_perfume.replace(" ", "+")
        url = f"https://dbs.cl/catalogsearch/result/?q={query}"
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return resultados

        sopa = BeautifulSoup(resp.text, "html.parser")
        # Cada producto trae un .product-item anidado dentro de otro; solo se toman los externos
        items = [it for it in sopa.select(".product-item") if not it.find_parent(class_="product-item")]

        for item in items[:6]:
            link_el = item.select_one("a.product-item-link, a.product-item-photo, a")
            img_el = item.select_one("img.product-image-photo")
            price_el = item.select_one(".price")

            nombre = link_el.get_text(strip=True) if link_el else ""
            if not nombre and img_el:
                nombre = img_el.get("alt", "")

            img = url_imagen(img_el)
            href = link_el.get("href") if link_el else ""

            precio_val = None
            if price_el:
                m = re.search(r"\$\s*([\d\.]+)", price_el.get_text(strip=True))
                if m:
                    try:
                        precio_val = float(m.group(1).replace(".", ""))
                    except Exception:
                        pass

            if nombre and precio_val and es_producto_relevante(nombre, nombre_perfume, precio_val):
                resultados.append({
                    "tienda": "DBS Beauty Store",
                    "nombre": nombre,
                    "precio": precio_val,
                    "moneda": "CLP",
                    "stock": stock_dbs(item),
                    "url": href,
                    "imagen": img,
                })
                if len(resultados) >= 4:
                    break
    except Exception:
        pass

    return resultados


# ─────────────────────────────────────────────
#  FUENTE 3 — Alisha Perfumes (Tienda Especializada de Fragancias)
# ─────────────────────────────────────────────
def buscar_alisha(nombre_perfume):
    # La página HTML de búsqueda se renderiza con JS; el endpoint JSON de Shopify trae precio y disponibilidad
    resultados = []
    try:
        resp = requests.get(
            "https://alishaperfumes.cl/search/suggest.json",
            params={"q": nombre_perfume, "resources[type]": "product", "resources[limit]": 10},
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code != 200:
            return resultados

        productos = resp.json().get("resources", {}).get("results", {}).get("products", [])
        for p in productos:
            title = re.sub(r"[^\x00-\x7F]+", " ", p.get("title") or "").strip()
            try:
                price_val = float(p.get("price"))
            except (TypeError, ValueError):
                continue

            if title and es_producto_relevante(title, nombre_perfume, price_val):
                resultados.append({
                    "tienda": "Alisha Perfumes",
                    "nombre": title,
                    "precio": price_val,
                    "moneda": "CLP",
                    "stock": stock_alisha(p),
                    "url": "https://alishaperfumes.cl" + (p.get("url") or "").split("?")[0],
                    "imagen": p.get("image"),
                    # Alisha describe las notas del perfume: sirve de fuente para los que la IA no conoce
                    "descripcionTienda": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", p.get("body") or "")).strip()[:1200],
                })
                if len(resultados) >= 4:
                    break
    except Exception:
        pass

    return resultados


# ─────────────────────────────────────────────
#  FUENTE 4 — Farmacias Ahumada (Con filtro estricto de no-farmacia)
# ─────────────────────────────────────────────
def buscar_ahumada(nombre_perfume):
    resultados = []
    try:
        query = nombre_perfume.replace(" ", "+")
        url = f"https://www.farmaciasahumada.cl/search?q={query}"
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return resultados

        sopa = BeautifulSoup(resp.text, "html.parser")
        cards = sopa.select(".product-tile")

        for c in cards[:12]:
            # select_one con selectores separados por coma devuelve el primero del documento
            # (el <a> vacío de la imagen), así que se prueban en orden de preferencia
            link_el = c.select_one("a.link") or c.select_one(".pdp-link a") or c.select_one("a")
            if not link_el:
                continue
            href = link_el.get("href", "")
            if href.startswith("/"):
                href = "https://www.farmaciasahumada.cl" + href

            img_el = c.select_one("img.tile-image") or c.select_one("img")
            title = link_el.get_text(strip=True) or link_el.get("title", "")
            if not title:
                title = img_el.get("alt", "") if img_el else ""

            price_el = c.select_one(".sales") or c.select_one(".price")
            price_val = None
            if price_el:
                p_txt = price_el.get_text(strip=True)
                m = re.search(r"\$\s*([\d\.]+)", p_txt)
                if m:
                    try:
                        price_val = float(m.group(1).replace(".", ""))
                    except Exception:
                        pass

            img = url_imagen(img_el)

            # FILTRO ESTRICTO: No agregar si es crema, toallitas o si no es relevante
            if title and price_val and es_producto_relevante(title, nombre_perfume, price_val):
                resultados.append({
                    "tienda": "Farmacias Ahumada",
                    "nombre": title,
                    "precio": price_val,
                    "moneda": "CLP",
                    "stock": stock_ahumada(c),
                    "url": href,
                    "imagen": img,
                })
                if len(resultados) >= 4:
                    break
    except Exception:
        pass

    return resultados


# ─────────────────────────────────────────────
#  RE-COTIZACIÓN DIRECTA — lee la página de un producto ya conocido
# ─────────────────────────────────────────────
def precio_desde_texto(texto):
    m = re.search(r"\d[\d\.]*", str(texto or ""))
    return float(m.group(0).replace(".", "")) if m else None


def cotizar_falabella_pdp(datos_pdp, url):
    producto = datos_pdp.get("props", {}).get("pageProps", {}).get("productData") or {}
    variantes = producto.get("variants") or []
    id_variante = str(producto.get("currentVariant") or producto.get("primaryVariantId") or "")
    variante = next((v for v in variantes if str(v.get("id")) == id_variante), variantes[0] if variantes else None)
    if not variante:
        return None
    precios = variante.get("prices") or []
    vigente = next((p for p in precios if not p.get("crossed", True)), precios[0] if precios else None)
    precio = precio_desde_texto((vigente or {}).get("price", [None])[0])
    if not precio:
        return None
    return {
        "tienda": "Falabella",
        "nombre": variante.get("name") or producto.get("name"),
        "precio": precio,
        "stock": stock_falabella(datos_pdp, variante.get("id")),
        "url": url,
        **detalle_falabella(datos_pdp),
    }


def cotizar_dbs_pdp(sopa, url):
    precio_el = sopa.select_one("meta[property='product:price:amount']") or sopa.select_one("[data-price-type=finalPrice]")
    if not precio_el:
        return None
    precio = precio_desde_texto(precio_el.get("content") or precio_el.get("data-price-amount"))
    if not precio:
        return None
    titulo = sopa.select_one("h1")
    agotado = sopa.select_one(".stock.unavailable") is not None
    con_carrito = sopa.select_one("#product-addtocart-button") is not None
    return {
        "tienda": "DBS Beauty Store",
        "nombre": titulo.get_text(strip=True) if titulo else "",
        "precio": precio,
        "stock": STOCK_NO if agotado else (STOCK_SI if con_carrito else STOCK_SIN_VERIFICAR),
        "url": url,
    }


def cotizar_alisha_js(producto, url):
    # El endpoint .js de Shopify entrega el precio en centavos
    if producto.get("price") is None:
        return None
    return {
        "tienda": "Alisha Perfumes",
        "nombre": re.sub(r"[^\x00-\x7F]+", " ", producto.get("title") or "").strip(),
        "precio": float(producto["price"]) / 100,
        "stock": stock_alisha(producto),
        "url": url,
    }


def cotizar_url(url):
    """Precio y stock actuales de un producto conocido, leyendo su propia página. None si no se puede."""
    try:
        if "falabella.com" in url:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            nd = BeautifulSoup(resp.text, "html.parser").find("script", id="__NEXT_DATA__") if resp.status_code == 200 else None
            return cotizar_falabella_pdp(json.loads(nd.string), url) if nd else None
        if "dbs.cl" in url:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            return cotizar_dbs_pdp(BeautifulSoup(resp.text, "html.parser"), url) if resp.status_code == 200 else None
        if "alishaperfumes.cl" in url:
            resp = requests.get(url.split("?")[0] + ".js", headers=HEADERS, timeout=10)
            return cotizar_alisha_js(resp.json(), url) if resp.status_code == 200 else None
        # shortcut: Ahumada no tiene re-cotización directa; el catálogo no guarda ofertas suyas hoy
    except Exception:
        pass
    return None


def es_busqueda_no_perfume(query):
    if not query:
        return True
    q_clean = limpiar_texto(query)
    # Si contiene términos explícitos de perfumería, se permite (ej: "perfume de rosas", "eau de toilette")
    if any(t in q_clean for t in TERMINOS_FRAGANCIA):
        return False
    # Si la consulta contiene alguna categoría que no es perfume (ej: "zapatillas", "cama", "polera", etc.)
    for no_p in CATEGORIAS_NO_PERFUME:
        if re.search(rf"\b{re.escape(no_p)}\b", q_clean):
            return True
    return False


# ─────────────────────────────────────────────
#  FUNCIÓN PRINCIPAL — Ejecuta las 4 tiendas en paralelo
# ─────────────────────────────────────────────
def buscar_en_todas(nombre_perfume, al_terminar_tienda=None):
    # Si la consulta del usuario no es de perfumería, abortar inmediatamente
    if es_busqueda_no_perfume(nombre_perfume):
        return []

    todos = []
    scrapers = [buscar_falabella, buscar_dbs, buscar_alisha, buscar_ahumada]

    with ThreadPoolExecutor(max_workers=4) as executor:
        futuros = {executor.submit(fn, nombre_perfume): fn.__name__ for fn in scrapers}
        for futuro in as_completed(futuros):
            try:
                resultados = futuro.result()
                if resultados:
                    todos.extend(resultados)
                    if al_terminar_tienda:
                        al_terminar_tienda(resultados)
            except Exception:
                pass

    # Ordenar por precio ascendente
    todos.sort(key=lambda x: (x["precio"] is None, x["precio"] or 0))
    return todos


# ─────────────────────────────────────────────
#  ENTRY POINT (llamado por Deno)
# ─────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--url":
        print(json.dumps(cotizar_url(sys.argv[2])))
        sys.exit(0)
    # --por-tienda: una línea JSON por tienda apenas responde (para mostrar ofertas sin esperar a la más lenta)
    # y al final la lista completa
    por_tienda = len(sys.argv) > 1 and sys.argv[1] == "--por-tienda"
    palabras = sys.argv[2:] if por_tienda else sys.argv[1:]
    nombre_perfume = " ".join(palabras) if palabras else "Acqua Di Gio"
    # ensure_ascii evita que la consola de Windows corrompa tildes al pasar el JSON a Deno
    if por_tienda:
        resultados = buscar_en_todas(nombre_perfume, lambda ofertas: print(json.dumps({"ofertas": ofertas}), flush=True))
        print(json.dumps({"todas": resultados, "avisos": AVISOS}))
    else:
        print(json.dumps(buscar_en_todas(nombre_perfume)))
