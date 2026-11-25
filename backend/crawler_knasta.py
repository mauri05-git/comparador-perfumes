import requests
from bs4 import BeautifulSoup
import json
import re
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from scraper_stock import url_imagen

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

# Marcas que el catálogo recorre una a una, de hombre y de mujer (como se escriben en el buscador de las tiendas)
MARCAS_A_RECORRER = [
    "dior", "chanel", "giorgio armani", "yves saint laurent", "carolina herrera", "paco rabanne", "jean paul gaultier",
    "versace", "valentino", "givenchy", "prada", "burberry", "lancome", "hugo boss", "calvin klein", "dolce gabbana",
    "azzaro", "ralph lauren", "montblanc", "mugler", "tom ford", "gucci", "lacoste", "issey miyake", "bvlgari",
    "antonio banderas", "davidoff", "lattafa", "armaf", "nautica", "tommy hilfiger", "kenzo", "viktor rolf",
]
PAUSA_ENTRE_PEDIDOS = 0.4  # segundos: no saturar a las tiendas


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


# Productos que no son el perfume (o no en su formato normal), como palabras enteras: al recorrer marca por marca
# aparecen geles, bálsamos, cofres, brumas, minis y hasta relojes
NO_ES_PERFUME = re.compile(
    r"\b(gel|ducha|b[aá]lsamo|after\s*shave|afeitar|exfoliante|corporal|cofre|mist|hair|reloj|aceite|labial|lip|glow|"
    r"tester|minis?|miniatura|travel|discovery|variety|revitalizante|2pc|body|desodorante|deo|crema|jab[oó]n|shampoo|"
    r"esmalte|buttlerglow|aerosol)\b",
    re.IGNORECASE,
)


def normalizar_marca(marca_raw, titulo_raw):
    comb = f"{marca_raw or ''} {titulo_raw or ''}".lower()
    if any(bad in comb for bad in PALABRAS_RECHAZO) or NO_ES_PERFUME.search(titulo_raw or ""):
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
    # Nombres que las tiendas escriben mal o con la forma del frasco en vez del perfume
    tl = tl.replace("´", "'").replace("’", "'")
    if "goodgirl" in tl:
        tl = tl.replace("goodgirl", "good girl")
        t = re.sub(r"goodgirl", "Good Girl", t, flags=re.IGNORECASE)
    t = re.sub(r"\bmillon\b", "Million", t, flags=re.IGNORECASE)
    if "j'adior" in tl:
        return "J'adore", ml
    if "cantimplora" in tl:
        return "Hugo Man", ml
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
        r"\b(notas\s+.*|con\s+notas\s+de.*|dulce\s+almizcle.*|formato.*|edici[oó]n\s+limitada.*|nuevo\s+envase.*|nueva\s+presentaci[oó]n|nuevo|exclusivo\s+online|sin\s+celof[aá]n|sleeved|rpck|femenino|masculino|vaporizador|vaporisateur|natural\s+spray|spray|eau\s+de\s+parfum|eau\s+de\s+toilette|eau\s+de\s+cologne|edp|edt|edc|perfumes|perfume\s+hombre|perfume\s+mujer|perfume\s+unisex|perfumen|perfume|fragancia|hombre|mujer|unisex|para|\d{1,3}\s*ml)\b",
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

    # Palabras sueltas que quedan al final al cortar el título ("J'adore Intense Con", "Boss Bottle #6 By") y un
    # tamaño sin "ml" ("Eau Fraiche Extreme 100")
    while palabras_limpias and (
        palabras_limpias[-1].lower() in ("con", "by", "de", "y", "para", "the", "and")
        or (palabras_limpias[-1].isdigit() and 30 <= int(palabras_limpias[-1]) <= 500 and len(palabras_limpias) > 1)
    ):
        palabras_limpias.pop()
    res = " ".join(palabras_limpias).strip()
    if len(res) < 3 or res.lower() in ["en", "de", "by", "homme", "femme", "women", "men", "xx", "i will"]:
        return None, ml
    return res, ml


HOMBRE = re.compile(r"\b(hombre|homme|men|man|uomo|masculino|for him|caballero|varon)\b")
MUJER = re.compile(r"\b(mujer|femme|woman|women|donna|femenino|for her|dama|lady)\b")
PERFUMES_DE_MUJER = ["good girl", "girl", "miss ", "bella", "yara", "amor amor", "la vie est belle", "libre", "paradoxe", "j'adore", "idole", "idôle", "tresor", "trésor", "goddess", "coco mademoiselle", "chance", "bright crystal", "crystal noir", "olympea", "fame", "my way", "burberry her", "lady million", "scandal"]
PERFUMES_DE_HOMBRE = ["bad boy", "boy", "sauvage", "invictus", "eros", "polo", "explorer", "gentleman", "bottled", "asad", "le male", "le beau", "voyage", "fahrenheit", "wanted", "1 million", "one million", "phantom", "myslf", "code", "hero", "dylan blue", "the one for men"]


def genero_y_fuente(marca, titulo, genero_busqueda=None):
    """(género, de dónde salió): el título, un perfume conocido, la búsqueda que lo encontró o ninguna."""
    # Sin la marca: "Carolina HERrera" hacía pasar por perfume de mujer a todo Carolina Herrera (Bad Boy incluido)
    t = re.sub(re.escape(marca or ""), " ", (titulo or "").lower(), flags=re.IGNORECASE)
    t = re.sub(r"carolina\s+herrera", " ", t)
    hombre, mujer = bool(HOMBRE.search(t)), bool(MUJER.search(t))
    if hombre != mujer:
        return ("Masculino" if hombre else "Femenino"), "titulo"
    # Un perfume conocido pesa más que la búsqueda: "perfume hombre dior" también trae J'adore
    if any(re.search(rf"\b{re.escape(k.strip())}\b", t) for k in PERFUMES_DE_MUJER):
        return "Femenino", "conocido"
    if any(re.search(rf"\b{re.escape(k.strip())}\b", t) for k in PERFUMES_DE_HOMBRE):
        return "Masculino", "conocido"
    if genero_busqueda:
        return genero_busqueda, "busqueda"
    return "Unisex", "ninguna"


def inferir_genero(marca, titulo, genero_busqueda=None):
    return genero_y_fuente(marca, titulo, genero_busqueda)[0]


def inferir_metadatos_olfativos(marca, nombre, texto_completo, genero_busqueda=None):
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

    genero = inferir_genero(marca, texto_completo, genero_busqueda)

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
    busquedas = [(f"perfume {g} {m}".replace(" ", "+"), genero) for m in MARCAS_A_RECORRER for g, genero in (("hombre", "Masculino"), ("mujer", "Femenino"))]
    for q, genero_busqueda in busquedas:
        time.sleep(PAUSA_ENTRE_PEDIDOS)
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
            for item in results[:48]:
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
                    "genero_busqueda": genero_busqueda,
                })
        except Exception:
            pass
    return items


def crawl_dbs_categoria():
    items = []
    queries = ["eau+de+parfum", "eau+de+toilette"] + [m.replace(" ", "+") for m in MARCAS_A_RECORRER]
    for q in queries:
        time.sleep(PAUSA_ENTRE_PEDIDOS)
        try:
            url = f"https://dbs.cl/catalogsearch/result/?q={q}&product_list_limit=48"
            resp = requests.get(url, headers=HEADERS, timeout=12)
            resp.encoding = "utf-8"
            if resp.status_code != 200:
                continue
            sopa = BeautifulSoup(resp.text, "html.parser")
            for prod in sopa.select(".product-item")[:48]:
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
                img_src = url_imagen(img_el)
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
    for q, genero_busqueda in (("perfume+eau+de", None), ("perfume+hombre", "Masculino"), ("perfume+mujer", "Femenino")):
        time.sleep(PAUSA_ENTRE_PEDIDOS)
        items += crawl_ahumada_busqueda(q, genero_busqueda)
    return items


def crawl_ahumada_busqueda(q, genero_busqueda):
    items = []
    try:
        url = f"https://www.farmaciasahumada.cl/search?q={q}"
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
            img_src = url_imagen(img_el)
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
                "genero_busqueda": genero_busqueda,
            })
    except Exception:
        pass
    return items


def crawl_alisha_categoria():
    items = []
    for m in MARCAS_A_RECORRER:
        for g, genero_busqueda in (("men", "Masculino"), ("women", "Femenino")):
            time.sleep(PAUSA_ENTRE_PEDIDOS)
            try:
                resp = requests.get(
                    "https://alishaperfumes.cl/search/suggest.json",
                    params={"q": f"{m} {g}", "resources[type]": "product", "resources[limit]": 10},
                    headers=HEADERS,
                    timeout=12,
                )
                if resp.status_code != 200:
                    continue
                for p in resp.json().get("resources", {}).get("results", {}).get("products", []):
                    titulo = re.sub(r"[^\x00-\x7F]+", " ", p.get("title") or "").strip()
                    try:
                        precio = int(float(p.get("price")))
                    except (TypeError, ValueError):
                        continue
                    if not titulo or precio < 15000 or not p.get("image") or p.get("available") is False:
                        continue
                    items.append({
                        "tienda": "Alisha Perfumes",
                        "nombre_tienda": titulo,
                        "marca_tienda": p.get("vendor") or "",
                        "precio": precio,
                        "imagen": p.get("image"),
                        "url": "https://alishaperfumes.cl" + (p.get("url") or "").split("?")[0],
                        "descripcion_extra": f"{p.get('vendor') or ''} {titulo}",
                        "genero_busqueda": genero_busqueda,
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


FINAL_DE_GENERO = re.compile(r"\s+(for\s+men|for\s+women|men|man|woman|women)$", re.IGNORECASE)


# Palabras que solas no son un nombre: "Hugo Man" o "Miss Dior" no deben perder la parte de la marca
SOLAS_NO_SON_NOMBRE = {"man", "men", "woman", "women", "femme", "homme", "miss", "xx", "xy", "boss", "hugo", "red", "the"}


def sin_marca_suelta(nombre, marca):
    """Quita al principio o al final un pedazo suelto de una marca de varias palabras ("Herrera Confidential Amethyst
    Carolina" -> "Confidential Amethyst", "1 Million Paco" -> "1 Million") o la marca repetida ("Versace Eros" -> "Eros")."""
    nombre_completo = next((kws[0] for canonica, kws in MARCAS_OFICIALES if canonica == marca), marca)
    de_marca = set(f"{marca} {nombre_completo}".lower().split())
    palabras = nombre.split()
    cambio = True
    while cambio and len(palabras) > 1:
        cambio = False
        for i in (0, -1):
            if len(palabras) > 1 and palabras[i].lower() in de_marca:
                resto = palabras[1:] if i == 0 else palabras[:-1]
                if len(resto) == 1 and (resto[0].lower() in SOLAS_NO_SON_NOMBRE or len(resto[0]) < 3):
                    continue
                palabras, cambio = resto, True
    return " ".join(palabras)


def sin_genero_final(nombre):
    # "Sauvage Men" y "Sauvage" son el mismo perfume; "212 Men", "CH Men" o "Hugo Man" no (el resto no alcanza a ser nombre)
    resto = FINAL_DE_GENERO.sub("", nombre).strip()
    if resto == nombre or resto.isdigit() or (len(resto.split()) < 2 and len(resto) < 6):
        return nombre
    return resto


HOY = time.strftime("%Y-%m-%d")


def construir_catalogo_knasta():
    # Una tienda por hilo: las búsquedas a una misma tienda van de a una, con pausa
    with ThreadPoolExecutor(max_workers=4) as ex:
        f_fala = ex.submit(crawl_falabella_categoria)
        f_dbs = ex.submit(crawl_dbs_categoria)
        f_ahu = ex.submit(crawl_ahumada_categoria)
        f_ali = ex.submit(crawl_alisha_categoria)
        brutos = f_fala.result() + f_dbs.result() + f_ahu.result() + f_ali.result()

    agrupados = {}
    for b in brutos:
        marca = normalizar_marca(b["marca_tienda"], b["nombre_tienda"])
        if not marca:
            continue
        nombre_limpio, ml = limpiar_titulo_perfume(b["nombre_tienda"], marca)
        if not nombre_limpio or len(nombre_limpio) < 3:
            continue
        nombre_limpio = sin_genero_final(sin_marca_suelta(nombre_limpio, marca))
        if ml is None:
            ml = ml_desde_texto(b["url"])
        if ml is not None and ml < 10:
            continue  # minis y muestras
        txt_ml = f" · {ml}ml" if ml else ""

        meta = inferir_metadatos_olfativos(marca, nombre_limpio, b["descripcion_extra"], b.get("genero_busqueda"))
        _, fuente_genero = genero_y_fuente(marca, b["descripcion_extra"], b.get("genero_busqueda"))
        base = re.sub(r"[^a-z0-9]+", "-", f"{marca.lower()}-{nombre_limpio.lower()}").strip("-")
        if not base:
            continue
        clave = f"{base}-{meta['genero'][0].lower()}"
        if fuente_genero in ("busqueda", "ninguna"):
            # Sin el género en el título ni un perfume conocido, va con el que ya existe con ese nombre; si apareció en
            # la búsqueda de hombre y en la de mujer, es unisex (antes quedaba repetido, uno de cada género)
            existente = next((k for k in (f"{base}-m", f"{base}-f", f"{base}-u") if k in agrupados), None)
            if existente:
                clave = existente
                previo = agrupados[existente]
                if previo["genero"] != meta["genero"] and previo.get("_genero_por_busqueda"):
                    previo["genero"] = "Unisex"

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
                # El precio se acaba de leer en la tienda: con la fecha, la app lo muestra como del día
                "fechaPrecio": HOY,
                "colorFrasco": paleta,
                "_genero_por_busqueda": fuente_genero in ("busqueda", "ninguna"),
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

    # "Eros Men" va con "Eros" si ese existe en la misma marca y género ("Hugo Man" se queda: no hay un "Hugo" de hombre)
    for clave_g in list(agrupados):
        x = agrupados.get(clave_g)
        if not x:
            continue
        base = FINAL_DE_GENERO.sub("", x["nombre"]).strip()
        if base == x["nombre"]:
            continue
        destino = next((k for k, y in agrupados.items() if k != clave_g and y["marca"] == x["marca"] and y["genero"] == x["genero"] and y["nombre"] == base), None)
        if destino:
            if x["precioReferencia"] < agrupados[destino]["precioReferencia"]:
                for campo in ("precioReferencia", "tiendaMejorPrecio", "urlMejorPrecio", "ml", "subtitulo", "imagen"):
                    agrupados[destino][campo] = x[campo]
            del agrupados[clave_g]
    lista_final = list(agrupados.values())
    for x in lista_final:
        x.pop("_genero_por_busqueda", None)

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
