import requests
from bs4 import BeautifulSoup
import json
import sys
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

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


def consultar_stock_falabella(url, sku_id):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=6)
        if resp.status_code != 200:
            return STOCK_SIN_VERIFICAR
        nd = BeautifulSoup(resp.text, "html.parser").find("script", id="__NEXT_DATA__")
        return stock_falabella(json.loads(nd.string), sku_id) if nd else STOCK_SIN_VERIFICAR
    except Exception:
        return STOCK_SIN_VERIFICAR


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
            return resultados

        sopa = BeautifulSoup(resp.text, "html.parser")
        nd = sopa.find("script", id="__NEXT_DATA__")
        if not nd:
            return resultados

        data = json.loads(nd.string)
        items = data.get("props", {}).get("pageProps", {}).get("results", [])
        skus_vistos = set()

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

            precio = None
            precios_raw = item.get("prices", [])
            for p in precios_raw:
                if not p.get("crossed", True):
                    precio_lista = p.get("price", [])
                    precio_str = precio_lista[0] if precio_lista else None
                    if precio_str:
                        try:
                            precio = float(str(precio_str).replace(".", "").replace(",", "."))
                        except ValueError:
                            pass
                    break

            if precio is None and precios_raw:
                precio_lista = precios_raw[0].get("price", [])
                precio_str = precio_lista[0] if precio_lista else None
                if precio_str:
                    try:
                        precio = float(str(precio_str).replace(".", "").replace(",", "."))
                    except ValueError:
                        pass

            nombre_limpio = f"{nombre} - {brand}" if brand and brand.lower() not in nombre.lower() else nombre
            nombre_limpio = nombre_limpio.encode("utf-8", "ignore").decode("utf-8")

            if es_producto_relevante(nombre_limpio, nombre_perfume, precio):
                resultados.append({
                    "tienda": "Falabella",
                    "nombre": nombre_limpio,
                    "precio": precio,
                    "moneda": "CLP",
                    "stock": STOCK_SIN_VERIFICAR,
                    "url": url_prod,
                    "imagen": imagen,
                    "_sku": item.get("skuId"),
                })
                if len(resultados) >= 4:
                    break

        # El listado de búsqueda no trae stock; se consulta la ficha de cada producto en paralelo
        with ThreadPoolExecutor(max_workers=4) as executor:
            stocks = executor.map(lambda r: consultar_stock_falabella(r["url"], r["_sku"]), resultados)
            for r, stock in zip(resultados, stocks):
                r["stock"] = stock
    except Exception:
        pass

    for r in resultados:
        r.pop("_sku", None)
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

            img = img_el.get("data-src") or img_el.get("src") if img_el else None
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

            img = img_el.get("src") if img_el else None

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
def buscar_en_todas(nombre_perfume):
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
            except Exception:
                pass

    # Ordenar por precio ascendente
    todos.sort(key=lambda x: (x["precio"] is None, x["precio"] or 0))
    return todos


# ─────────────────────────────────────────────
#  ENTRY POINT (llamado por Deno)
# ─────────────────────────────────────────────
if __name__ == "__main__":
    nombre_perfume = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Acqua Di Gio"
    resultados = buscar_en_todas(nombre_perfume)
    # ensure_ascii evita que la consola de Windows corrompa tildes al pasar el JSON a Deno
    print(json.dumps(resultados))
