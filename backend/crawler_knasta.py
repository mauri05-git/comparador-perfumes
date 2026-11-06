import requests
from bs4 import BeautifulSoup
import json
import re
import os
import sys
from concurrent.futures import ThreadPoolExecutor

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-CL,es;q=0.9",
}

# Solo casas perfumistas oficiales y reconocidas en retail chileno
MARCAS_OFICIALES = [
    ("Carolina Herrera", ["carolina herrera", "good girl", "bad boy", "212 vip", "212 men", "212 heroes", "212 sexy"]),
    ("Giorgio Armani", ["giorgio armani", "emporio armani", "acqua di gio", "acqua di giò", "stronger with you", "my way", "armani code", "si passioni"]),
    ("Jean Paul Gaultier", ["jean paul gaultier", "gaultier", "le male", "le beau", "scandal", "la belle", "divine"]),
    ("Dolce & Gabbana", ["dolce & gabbana", "dolce gabbana", "d&g", "light blue", "the one", "devotion", "k by dolce"]),
    ("Yves Saint Laurent", ["yves saint laurent", "saint laurent", "ysl", "black opium", "libre", "myslf", "kouros", "la nuit de l'homme"]),
    ("Rabanne", ["paco rabanne", "rabanne", "1 million", "one million", "invictus", "phantom", "fame", "olympea", "black xs", "million gold"]),
    ("Dior", ["christian dior", "dior", "sauvage", "dior homme", "miss dior", "j'adore", "jadore", "fahrenheit", "poison"]),
    ("Chanel", ["chanel", "bleu de chanel", "coco mademoiselle", "allure homme", "chance", "gabrielle"]),
    ("Versace", ["versace", "eros", "dylan blue", "dylan turquoise", "dylan purple", "bright crystal", "crystal noir", "versense"]),
    ("Tom Ford", ["tom ford", "black orchid", "ombre leather", "tobacco vanille", "oud wood", "soleil blanc"]),
    ("Valentino", ["valentino", "born in roma", "valentino uomo", "voce viva"]),
    ("Mugler", ["thierry mugler", "mugler", "a*men", "angel", "alien"]),
    ("Lancôme", ["lancôme", "lancome", "lancme", "la vie est belle", "idole", "idôle", "tresor", "trésor"]),
    ("Calvin Klein", ["calvin klein", "ck one", "ck be", "eternity", "euphoria", "defy"]),
    ("Nautica", ["nautica", "voyage"]),
    ("Hermès", ["hermès", "hermes", "terre d'hermes", "terre d'hermès", "h24", "twilly", "un jardin"]),
    ("Viktor&Rolf", ["viktor&rolf", "viktor & rolf", "spicebomb", "flowerbomb"]),
    ("Lacoste", ["lacoste", "l.12.12"]),
    ("Hugo Boss", ["hugo boss", "boss bottled", "boss the scent", "hugo man", "hugo just different"]),
    ("Montblanc", ["montblanc", "mont blanc", "explorer", "legend", "individuel"]),
    ("Givenchy", ["givenchy", "gentleman", "irresistible", "l'interdit"]),
    ("Prada", ["prada", "paradoxe", "luna rossa", "l'homme prada"]),
    ("Burberry", ["burberry", "burberry hero", "burberry her", "goddess", "burberry touch", "burberry london"]),
    ("Gucci", ["gucci", "gucci guilty", "gucci bloom", "gucci flora"]),
    ("Azzaro", ["azzaro", "the most wanted", "wanted", "chrome"]),
    ("Ralph Lauren", ["ralph lauren", "polo blue", "polo black", "polo red", "polo green", "polo 67"]),
    ("Antonio Banderas", ["antonio banderas", "the icon", "blue seduction", "king of seduction", "her secret"]),
    ("Halloween", ["halloween"]),
    ("Tous", ["tous", "loveme"]),
    ("Cacharel", ["cacharel", "amor amor", "yes i am", "anais anais", "noa"]),
    ("Davidoff", ["davidoff", "cool water"]),
    ("Tommy Hilfiger", ["tommy hilfiger", "tommy girl", "impact"]),
    ("DKNY", ["dkny", "be delicious"]),
    ("Moschino", ["moschino", "toy boy", "toy 2"]),
    ("Kenzo", ["kenzo", "flower by kenzo"]),
    ("Loewe", ["loewe", "solo loewe", "esencia", "7 loewe"]),
    ("Bvlgari", ["bvlgari", "bulgari", "man in black", "omnia", "aqva"]),
    ("Guerlain", ["guerlain", "l'homme ideal", "shalimar", "mon guerlain", "aqua allegoria"]),
    ("Issey Miyake", ["issey miyake", "l'eau d'issey"]),
    ("Narciso Rodriguez", ["narciso rodriguez", "for her"]),
    ("Lattafa", ["lattafa khamrah", "lattafa asad", "lattafa yara", "lattafa fakhar", "badee al oud"]),
    ("Armaf", ["club de nuit intense", "club de nuit woman", "club de nuit sillage", "club de nuit iconic"]),
]

# Palabras de relleno, maquillaje o dupes de marketplace que debemos rechazar
PALABRAS_RECHAZO = [
    "set ", "+ gel", "body lotion", "shower gel", "locion", "loción", "desodorante",
    "after shave", "crema", "decant", "muestra", "vial", "imitacion", "imitación",
    "alternativo", "inspirado", "tipo ", "asdaaf", "nasmaat", "abaan", "awaan",
    "safwaan", "atika", "jivi", "alhambra", "frasco recargable", "recarga", "refill",
    "cabello", "hair mist", "bruma", "splash", "bolsa", "estuche", " + ",
    "primer", "maquillaje", "base ", "corrector", "labial", "mascara", "máscara",
    "sombra", "delineador", "rubor", "polvo ", "serum", "sérum", "contorno",
]


def normalizar_marca(marca_raw, titulo_raw):
    comb = f"{marca_raw or ''} {titulo_raw or ''}".lower()
    if any(bad in comb for bad in PALABRAS_RECHAZO):
        return None
    for canonica, kws in MARCAS_OFICIALES:
        if any(kw in comb for kw in kws):
            return canonica
    return None


def ml_desde_texto(texto):
    """Tamaño en ml escrito en un título o URL (ej: "Edt 40 Ml", "...-75-ml-..."); None si no aparece."""
    m = re.search(r"\b(\d{1,3})\s*ml\b", (texto or "").replace("-", " ").replace("_", " "), re.IGNORECASE)
    ml = int(m.group(1)) if m else None
    return ml if ml and 5 <= ml <= 500 else None


def limpiar_titulo_perfume(titulo_raw, marca):
    t = titulo_raw or ""
    ml = ml_desde_texto(t)

    # Nombres compuestos o icónicos con formato canónico exacto
    tl = (titulo_raw or "").lower()
    if "bleu de chanel" in tl:
        return "Bleu de Chanel", ml
    if "dior homme intense" in tl:
        return "Dior Homme Intense", ml
    if "dior homme sport" in tl:
        return "Dior Homme Sport", ml
    if "dior homme" in tl:
        return "Dior Homme", ml
    if "miss dior blooming bouquet" in tl or "blooming bouquet" in tl:
        return "Miss Dior Blooming Bouquet", ml
    if "miss dior rose" in tl:
        return "Miss Dior Rose N'Roses", ml
    if "miss dior parfum" in tl:
        return "Miss Dior Parfum", ml
    if "miss dior" in tl:
        return "Miss Dior", ml
    if "addict peachy glow" in tl:
        return "Addict Peachy Glow", ml
    if "addict rosy glow" in tl:
        return "Addict Rosy Glow", ml
    if "my burberry black" in tl or ("burberry" in tl and "my black" in tl):
        return "My Burberry Black", ml
    if "my burberry blush" in tl or ("burberry" in tl and "my blush" in tl):
        return "My Burberry Blush", ml
    if "burberry her elixir" in tl:
        return "Burberry Her Elixir", ml
    if "burberry her intense" in tl:
        return "Burberry Her Intense", ml
    if "burberry her" in tl:
        return "Burberry Her", ml
    if "burberry hero" in tl:
        return "Burberry Hero", ml
    if "burberry goddess" in tl:
        return "Burberry Goddess", ml
    if "valentino uomo born in roma intense" in tl or "born in roma intense uomo" in tl:
        return "Born In Roma Uomo Intense", ml
    if "born in roma uomo coral" in tl:
        return "Born In Roma Uomo Coral Fantasy", ml
    if "born in roma uomo" in tl:
        return "Born In Roma Uomo", ml
    if "born in roma donna" in tl:
        return "Born In Roma Donna", ml
    if "valentino uomo" in tl:
        return "Valentino Uomo", ml
    if "armani code" in tl:
        return "Armani Code", ml
    if "acqua di gio profondo" in tl or "acqua di giò profondo" in tl:
        return "Acqua di Giò Profondo", ml
    if "acqua di gio parfum" in tl or "acqua di giò parfum" in tl:
        return "Acqua di Giò Parfum", ml
    if "acqua di gio" in tl or "acqua di giò" in tl:
        return "Acqua di Giò", ml
    if "si passione" in tl or "sí passione" in tl:
        return "Sí Passione", ml
    if "coco mademoiselle" in tl:
        return "Coco Mademoiselle", ml
    if "infusion d'ylang" in tl or "infusion d ylang" in tl:
        return "Infusion d'Ylang", ml
    if "infusion de rose" in tl:
        return "Infusion de Rose", ml
    if "infusion de cedre" in tl or "infusion de cèdre" in tl:
        return "Infusion de Cèdre", ml
    if "infusion d'iris" in tl:
        return "Infusion d'Iris", ml
    if "pivoine suzhou" in tl or "de pivoine" in tl:
        return "Pivoine Suzhou (Armani Privé)", ml
    if "q by dolce" in tl or "perfumes q by" in tl:
        return "Q by Dolce & Gabbana", ml

    # Quitar frases promocionales de Falabella / retail
    t = re.sub(
        r"\b(con\s+notas\s+de.*|notas\s+frescas.*|notas\s+florales.*|dulce\s+almizcle.*|formato.*|edici[oó]n\s+limitada.*|nuevo\s+envase.*|vaporizador|vaporisateur|natural\s+spray|spray|eau\s+de\s+parfum|eau\s+de\s+toilette|eau\s+de\s+cologne|edp|edt|edc|perfumes|perfume\s+hombre|perfume\s+mujer|perfume\s+unisex|perfume|fragancia|hombre|mujer|unisex|para|\d{2,3}\s*ml)\b",
        " ",
        t,
        flags=re.IGNORECASE,
    )

    # Quitar marca al principio o al final sin romper frases como "de <Marca>"
    m_esc = re.escape(marca)
    t = re.sub(rf"^\s*{m_esc}\b", " ", t, flags=re.IGNORECASE)
    t = re.sub(rf"\b(?<!de\s){m_esc}\s*$", " ", t, flags=re.IGNORECASE)
    t = re.sub(r"\b(paco\s+rabanne|thierry\s+mugler|christian\s+dior|yves\s+saint\s+laurent|giorgio\s+armani|emporio\s+armani|carolina\s+herrera|dolce\s*&?\s*gabbana|jean\s+paul\s+gaultier|paul\s+gaultier|ralph\s+lauren|calvin\s+klein|hugo\s+boss|viktor\s*&?\s*rolf)\b", " ", t, flags=re.IGNORECASE)
    t = re.sub(r"[-–—|/,().+]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()

    # Eliminar palabras duplicadas consecutivas (ej: "Intense Intense")
    palabras_limpias = []
    for w in t.split():
        if w.upper() in ["II", "III", "IV", "VIP", "XS", "CK", "YSL", "CH", "DKNY"]:
            wf = w.upper()
        else:
            wf = w.capitalize()
        if not palabras_limpias or palabras_limpias[-1].lower() != wf.lower():
            palabras_limpias.append(wf)

    res = " ".join(palabras_limpias).strip()
    if len(res) < 3 or res.lower() in ["en", "de", "by", "homme", "femme", "women", "men", "xx", "i will"]:
        return None, ml
    return res, ml


def inferir_metadatos_olfativos(marca, nombre, texto_completo):
    txt = f"{marca} {nombre} {texto_completo}".lower()

    if "elixir" in txt or ("parfum" in txt and "eau de parfum" not in txt and "edp" not in txt):
        concentracion = "Parfum / Elixir"
        duracion = 11
        proyeccion = "Bestia"
    elif "toilette" in txt or "edt" in txt or "fresca" in txt:
        concentracion = "Eau de Toilette (EDT)"
        duracion = 7
        proyeccion = "Moderada"
    else:
        concentracion = "Eau de Parfum (EDP)"
        duracion = 9
        proyeccion = "Alta"

    if any(k in txt for k in ["mujer", "femme", "woman", "women", "her", "girl", "miss ", "dama", "femenin", "bella", "yara", "amor amor", "la vie est belle", "libre", "paradoxe", "j'adore", "idole", "idôle", "tresor", "trésor", "goddess", "coco mademoiselle", "chance", "bright crystal", "crystal noir", "olympea", "fame", "my way"]):
        genero = "Femenino"
    elif any(k in txt for k in ["hombre", "homme", "man", "men", "uomo", "boy", "masculin", "sauvage", "invictus", "eros", "polo", "explorer", "gentleman", "bottled", "asad", "le male", "le beau", "voyage", "fahrenheit", "wanted", "1 million", "one million", "phantom", "myslf", "code"]):
        genero = "Masculino"
    else:
        genero = "Unisex"

    notas = []
    notas_detalle = []

    reglas_notas = [
        ("Chocolate / Cacao", ["chocolate", "cacao", "pralin", "gianduja", "bad boy", "good girl", "dior homme intense", "black xs", "khamrah", "angel", "a*men", "black orchid", "valentino uomo", "qahwa", "la vie est belle", "1 million lucky"], ["Cacao", "Praliné"]),
        ("Madera (Cedro / Sándalo / Oud)", ["madera", "amaderad", "cedro", "sándalo", "sandalo", "oud", "vetiver", "pachul", "roble", "bleu", "sauvage", "homme", "uomo", "explorer", "gentleman", "bad boy", "good girl", "terre", "boss", "club de nuit", "asad", "hero", "polo", "defy"], ["Madera de Cedro", "Sándalo"]),
        ("Café / Espresso", ["café", "cafe", "espresso", "qahwa", "black opium", "good girl", "halloween man x", "valentino uomo"], ["Café Tostado"]),
        ("Vainilla / Haba Tonka", ["vainilla", "vanilla", "tonka", "yara", "le male", "eros", "scandal", "good girl", "bad boy", "born in roma", "khamrah", "code", "wanted", "invictus victory", "goddess", "stronger with you", "paradoxe"], ["Vainilla Bourbon", "Haba Tonka"]),
        ("Tabaco / Cuero / Incienso", ["tabaco", "tobacco", "cuero", "leather", "humo", "incienso", "spicebomb", "man in black", "ombre leather", "bleu", "fahrenheit", "1 million", "gentleman reserve"], ["Incienso", "Acorde de Cuero"]),
        ("Caramelo / Miel", ["caramelo", "miel", "scandal", "khamrah", "angel", "1 million", "one million", "la vie est belle", "stronger with you intensely"], ["Caramelo", "Miel"]),
        ("Bergamota / Limón", ["bergamota", "limón", "limon", "pomelo", "mandarina", "cítric", "acqua", "light blue", "sauvage", "bleu", "eros", "ck one", "cool water", "allure", "polo", "versace", "voyage", "chance", "coco mademoiselle", "luna rossa"], ["Bergamota", "Cítricos"]),
        ("Notas Marinas", ["marin", "acuát", "acuat", "acqua", "voyage", "invictus", "cool water", "polo blue", "light blue", "luna rossa ocean", "dylan turquoise"], ["Brisa Marina", "Acorde Acuático"]),
        ("Pimienta / Especias", ["pimienta", "canela", "cardamomo", "jengibre", "especia", "sauvage", "spicebomb", "1 million", "one million", "asad", "khamrah", "bad boy", "stronger with you"], ["Pimienta Rosa", "Cardamomo"]),
        ("Lavanda / Menta", ["lavanda", "menta", "salvia", "le male", "eros", "sauvage", "libre", "myslf", "phantom", "luna rossa", "goddess"], ["Lavanda", "Menta Fresca"]),
        ("Ámbar / Ambroxan", ["ámbar", "ambar", "ambroxan", "almizcle", "sauvage", "bleu", "dylan blue", "eros", "allure"], ["Ámbar", "Almizcle"]),
        ("Jazmín / Rosa / Iris", ["rosa", "jazmín", "jazmin", "iris", "azahar", "floral", "miss dior", "j'adore", "coco mademoiselle", "la vie est belle", "good girl", "libre", "idole", "idôle", "amor amor", "my way", "paradoxe", "tresor", "trésor", "her", "bright crystal", "dior homme intense"], ["Jazmín", "Iris", "Rosa"]),
        ("Frutal / Coco / Manzana", ["coco", "piña", "manzana", "pera", "cereza", "frutal", "yara", "le beau", "voyage", "amor amor", "be delicious", "club de nuit", "eros", "boss bottled", "her", "dylan purple"], ["Acorde Frutal", "Manzana / Pera"]),
    ]

    for etiqueta, kws, dets in reglas_notas:
        if any(k in txt for k in kws):
            notas.append(etiqueta)
            for d in dets:
                if d not in notas_detalle:
                    notas_detalle.append(d)

    # Si ninguna regla reconoce el perfume, se deja sin notas en vez de asignar unas por defecto
    if not notas:
        familia = "Sin clasificar"
    elif "Chocolate / Cacao" in notas or "Caramelo / Miel" in notas or ("Vainilla / Haba Tonka" in notas and genero == "Femenino"):
        familia = "Dulce / Gourmand"
    elif "Notas Marinas" in notas:
        familia = "Cítrico / Acuático"
    elif "Jazmín / Rosa / Iris" in notas and genero == "Femenino":
        familia = "Floral / Frutal"
    elif "Pimienta / Especias" in notas or "Tabaco / Cuero / Incienso" in notas:
        familia = "Ámbar / Especiado"
    elif "Lavanda / Menta" in notas and "Ámbar / Ambroxan" in notas:
        familia = "Fougère / Azul"
    else:
        familia = "Amaderado / Aromático"

    alergenos = []
    if "Bergamota / Limón" in notas:
        alergenos.append("limonene")
    if "Lavanda / Menta" in notas or "Jazmín / Rosa / Iris" in notas:
        alergenos.append("linalool")
    if "Vainilla / Haba Tonka" in notas or "Chocolate / Cacao" in notas:
        alergenos.append("coumarin")
    if "Pimienta / Especias" in notas:
        alergenos.append("cinnamal")

    return {
        "concentracion": concentracion,
        "duracionHoras": duracion,
        "proyeccion": proyeccion,
        "genero": genero,
        "familia": familia,
        "notas": notas[:5],
        "notasDetalle": notas_detalle[:4],
        "alergenosIds": alergenos,
    }


def crawl_falabella_categoria():
    items = []
    queries = [
        "perfume+dior+chanel+armani+ysl",
        "perfume+carolina+herrera+rabanne+jean+paul+gaultier",
        "perfume+versace+valentino+givenchy+prada",
        "perfume+burberry+lancome+hugo+boss+calvin+klein",
        "perfume+dolce+gabbana+azzaro+ralph+lauren+montblanc",
    ]
    for q in queries:
        try:
            url = f"https://www.falabella.com/falabella-cl/search?Ntt={q}"
            resp = requests.get(url, headers=HEADERS, timeout=12)
            resp.encoding = "utf-8"
            if resp.status_code != 200:
                continue
            sopa = BeautifulSoup(resp.text, "html.parser")
            nd = sopa.find("script", id="__NEXT_DATA__")
            if not nd:
                continue
            data = json.loads(nd.string)
            results = data.get("props", {}).get("pageProps", {}).get("results", [])
            for item in results[:28]:
                nombre = (item.get("displayName") or "").strip()
                brand = (item.get("brand") or "").strip()
                if not nombre or brand.upper() in ["GENERICO", "GENÉRICO", "GENERIC", "SIN MARCA", ""]:
                    continue
                url_prod = item.get("url", "")
                imagen = (item.get("mediaUrls") or [None])[0]
                if not imagen:
                    continue
                precio = None
                for p in item.get("prices", []):
                    if not p.get("crossed", True):
                        pl = p.get("price", [])
                        if pl:
                            try:
                                precio = int(float(str(pl[0]).replace(".", "").replace(",", ".")))
                            except Exception:
                                pass
                        break
                if not precio or precio < 18000:
                    continue
                items.append({
                    "tienda": "Falabella",
                    "nombre_tienda": nombre,
                    "marca_tienda": brand,
                    "precio": precio,
                    "imagen": imagen,
                    "url": url_prod,
                    "descripcion_extra": f"{brand} {nombre}",
                })
        except Exception:
            pass
    return items


def crawl_dbs_categoria():
    items = []
    queries = ["eau+de+parfum", "eau+de+toilette", "jean+paul+gaultier+rabanne+versace+lancome"]
    for q in queries:
        try:
            url = f"https://dbs.cl/catalogsearch/result/?q={q}"
            resp = requests.get(url, headers=HEADERS, timeout=12)
            resp.encoding = "utf-8"
            if resp.status_code != 200:
                continue
            sopa = BeautifulSoup(resp.text, "html.parser")
            for prod in sopa.select(".product-item")[:32]:
                txt_prod = prod.get_text(" | ", strip=True)
                partes = [p.strip() for p in txt_prod.split(" | ") if p.strip()]
                if len(partes) < 2:
                    continue
                marca_dbs = partes[0]
                nombre_dbs = partes[1]

                el_precio = prod.select_one("[data-price-amount]")
                if el_precio and el_precio.get("data-price-amount"):
                    try:
                        precio = int(float(el_precio["data-price-amount"]))
                    except Exception:
                        precio = None
                else:
                    el_p = prod.select_one(".price")
                    txt_p = re.sub(r"[^\d]", "", el_p.get_text()) if el_p else ""
                    precio = int(txt_p) if txt_p else None
                if not precio or precio < 15000:
                    continue

                a_tag = prod.select_one("a.product-item-link") or prod.select_one("a[href]")
                href = a_tag["href"] if a_tag and a_tag.get("href") else url

                img_el = prod.select_one("img.product-image-photo") or prod.select_one("img")
                img_src = None
                if img_el:
                    img_src = img_el.get("src") or img_el.get("data-src")
                if not img_src:
                    continue

                items.append({
                    "tienda": "DBS Beauty Store",
                    "nombre_tienda": f"{marca_dbs} {nombre_dbs}",
                    "marca_tienda": marca_dbs,
                    "precio": precio,
                    "imagen": img_src,
                    "url": href,
                    "descripcion_extra": f"{marca_dbs} {nombre_dbs}",
                })
        except Exception:
            pass
    return items


def crawl_ahumada_categoria():
    items = []
    try:
        url = "https://www.farmaciasahumada.cl/search?q=perfume+eau+de"
        resp = requests.get(url, headers=HEADERS, timeout=12)
        resp.encoding = "utf-8"
        if resp.status_code != 200:
            return items
        sopa = BeautifulSoup(resp.text, "html.parser")
        for prod in sopa.select(".product-tile, .product")[:25]:
            el_n = prod.select_one(".pdp-link a, .link")
            el_b = prod.select_one(".product-brand, .brand")
            el_p = prod.select_one(".value[content], .sales .value")
            if not el_n or not el_p:
                continue
            nombre = el_n.get_text(strip=True)
            marca = el_b.get_text(strip=True) if el_b else ""
            raw_p = el_p.get("content") or el_p.get_text()
            txt_p = re.sub(r"[^\d]", "", str(raw_p))
            precio = int(txt_p) if txt_p else None
            if not precio or precio < 15000:
                continue
            href = el_n.get("href", "")
            link = f"https://www.farmaciasahumada.cl{href}" if href.startswith("/") else href
            img_el = prod.select_one(".tile-image, img")
            img_src = img_el.get("src") or img_el.get("data-src") if img_el else None
            if not img_src:
                continue
            items.append({
                "tienda": "Farmacias Ahumada",
                "nombre_tienda": nombre,
                "marca_tienda": marca,
                "precio": precio,
                "imagen": img_src,
                "url": link,
                "descripcion_extra": f"{marca} {nombre}",
            })
    except Exception:
        pass
    return items


PALETAS_FRASCO = [
    {"primario": "#1e293b", "secundario": "#0f172a", "acento": "#fbbf24", "forma": "clasico"},
    {"primario": "#312e81", "secundario": "#1e1b4b", "acento": "#f59e0b", "forma": "clasico"},
    {"primario": "#78350f", "secundario": "#451a03", "acento": "#fbbf24", "forma": "estilizado"},
    {"primario": "#065f46", "secundario": "#064e3b", "acento": "#34d399", "forma": "cilindro"},
    {"primario": "#831843", "secundario": "#500724", "acento": "#f472b6", "forma": "esfera"},
    {"primario": "#1e3a8a", "secundario": "#172554", "acento": "#60a5fa", "forma": "lingote"},
]


def construir_catalogo_knasta():
    with ThreadPoolExecutor(max_workers=3) as ex:
        f_fala = ex.submit(crawl_falabella_categoria)
        f_dbs = ex.submit(crawl_dbs_categoria)
        f_ahu = ex.submit(crawl_ahumada_categoria)
        brutos = f_fala.result() + f_dbs.result() + f_ahu.result()

    agrupados = {}
    for b in brutos:
        marca = normalizar_marca(b["marca_tienda"], b["nombre_tienda"])
        if not marca:
            continue
        nombre_limpio, ml = limpiar_titulo_perfume(b["nombre_tienda"], marca)
        if not nombre_limpio or len(nombre_limpio) < 3:
            continue
        if ml is None:
            ml = ml_desde_texto(b["url"])
        txt_ml = f" · {ml}ml" if ml else ""

        clave = re.sub(r"[^a-z0-9]+", "-", f"{marca.lower()}-{nombre_limpio.lower()}").strip("-")
        if not clave:
            continue

        meta = inferir_metadatos_olfativos(marca, nombre_limpio, b["descripcion_extra"])
        paleta = PALETAS_FRASCO[abs(hash(clave)) % len(PALETAS_FRASCO)]

        if clave not in agrupados:
            agrupados[clave] = {
                "id": f"knasta-{clave}",
                "nombre": nombre_limpio,
                "subtitulo": f"{meta['concentracion'].split(' ')[0]}{txt_ml} · {b['tienda']}",
                "marca": marca,
                "precioReferencia": b["precio"],
                "ml": ml,
                "concentracion": meta["concentracion"],
                "genero": meta["genero"],
                "familia": meta["familia"],
                "notas": meta["notas"],
                "notasDetalle": meta["notasDetalle"],
                "estaciones": ["Otoño", "Primavera"] if meta["familia"] != "Cítrico / Acuático" else ["Verano", "Primavera"],
                "ocasion": "Noche & Fiesta" if meta["duracionHoras"] >= 9 else "Oficina & Diario",
                "duracionHoras": meta["duracionHoras"],
                "proyeccion": meta["proyeccion"],
                "alergenosIds": meta["alergenosIds"],
                "imagen": b["imagen"],
                "tiendaMejorPrecio": b["tienda"],
                "urlMejorPrecio": b["url"],
                "descubiertoEnVivo": True,
                "colorFrasco": paleta,
            }
        else:
            actual = agrupados[clave]
            if b["precio"] < actual["precioReferencia"]:
                # La oferta se reemplaza completa: precio, tienda, URL, tamaño e imagen deben ser del mismo producto
                actual["precioReferencia"] = b["precio"]
                actual["tiendaMejorPrecio"] = b["tienda"]
                actual["urlMejorPrecio"] = b["url"]
                actual["ml"] = ml
                actual["subtitulo"] = f"{meta['concentracion'].split(' ')[0]}{txt_ml} · {b['tienda']}"
                actual["imagen"] = b["imagen"] or actual["imagen"]
            if not actual["imagen"] and b["imagen"]:
                actual["imagen"] = b["imagen"]

    lista_final = list(agrupados.values())

    # Solo se escribe el catálogo indexado; catalogo_descubiertos.json guarda los perfumes aprendidos de las
    # búsquedas y sobrescribirlo los borraba. El backend combina ambos al refrescar precios.
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ruta_frontend_public = os.path.join(base_dir, "..", "frontend", "public", "catalogo_knasta.json")

    try:
        os.makedirs(os.path.dirname(ruta_frontend_public), exist_ok=True)
        with open(ruta_frontend_public, "w", encoding="utf-8") as f:
            json.dump(lista_final, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    marcas_unicas = sorted(list({x["marca"] for x in lista_final}))
    return {
        "success": True,
        "total_brutos_tiendas": len(brutos),
        "total_perfumes_unicos": len(lista_final),
        "total_marcas": len(marcas_unicas),
        "marcas": marcas_unicas,
        "items": lista_final,
    }


if __name__ == "__main__":
    res = construir_catalogo_knasta()
    print(json.dumps(res, ensure_ascii=False))
