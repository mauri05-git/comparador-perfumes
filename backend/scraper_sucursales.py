import json
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-CL,es;q=0.9",
}

# Buscador oficial de locales de Farmacias Ahumada (Salesforce Commerce Cloud).
# Ignora el radio y devuelve todos los locales del país con horario por día y coordenadas.
URL_AHUMADA = "https://www.farmaciasahumada.cl/on/demandware.store/Sites-ahumada-cl-Site/default/Stores-FindStores"


def limpiar(texto):
    return re.sub(r"\s+", " ", texto or "").strip()


def horario_desde_html(html, es_24h):
    if es_24h:
        return "Abierto 24 horas"
    lineas = [limpiar(l) for l in BeautifulSoup(html or "", "html.parser").get_text("\n").split("\n")]
    return " · ".join(l for l in lineas if l) or "Horario no informado"


def es_region_metropolitana(local):
    return "metropolitana" in (local.get("stateCode") or "").lower()


def convertir_local(local):
    comuna = limpiar(local.get("city")) or "Sin comuna"
    return {
        "tienda": "Farmacias Ahumada",
        "nombre": f"Ahumada {comuna}" + (" 24h" if local.get("is24hours") else ""),
        "direccion": limpiar(local.get("address1")),
        "horario": horario_desde_html(local.get("storeHours"), local.get("is24hours")),
        "comuna": comuna,
        "region": "Metropolitana",
        "telefono": limpiar(local.get("phone")) or "Sin teléfono",
        "lat": local.get("latitude"),
        "lng": local.get("longitude"),
        "fuente": "scraping",
    }


def scrapear_ahumada():
    resp = requests.get(URL_AHUMADA, params={"lat": -33.4489, "long": -70.6693}, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    locales = resp.json().get("stores") or []
    return [
        convertir_local(l) for l in locales
        if es_region_metropolitana(l) and l.get("latitude") and l.get("longitude")
    ]


# ─────────────────────────────────────────────
#  DBS y Alisha: sus páginas oficiales listan los locales con dirección y horario, pero sin coordenadas.
#  Las coordenadas salen de OpenStreetMap (Nominatim) y se guardan, para consultar cada dirección una sola vez.
# ─────────────────────────────────────────────
URL_DBS = "https://dbs.cl/nuestras-tiendas"
URL_ALISHA = "https://alishaperfumes.cl/"
URL_NOMINATIM = "https://nominatim.openstreetmap.org/search"
ARCHIVO_COORDENADAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "coordenadas_locales.json")
# Nominatim pide identificar la aplicación y no más de una consulta por segundo
HEADERS_NOMINATIM = {"User-Agent": "PerfumeScan/1.0 (proyecto academico de comparacion de precios)"}


def horario_por_dias(tramos):
    """[("Lunes a Jueves", "10:00 - 20:00"), ("Domingo", "CERRADO")] -> "Lunes a Jueves: 10:00 - 20:00 · Domingo: CERRADO" """
    return " · ".join(f"{dias}: {limpiar(horas).upper() if 'cerrado' in horas.lower() else limpiar(horas)}" for dias, horas in tramos)


def horario_alisha(texto):
    """'Lunes a Jueves 10:30-20:30 hs. Viernes a Domingos: 10:30-21:00 hs.' -> formato por días"""
    tramos = re.findall(
        r"([A-ZÁÉÍÓÚa-záéíóú]+(?:\s+a\s+[A-ZÁÉÍÓÚa-záéíóú]+)?)\s*:?\s*(?:de\s+)?(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})",
        texto or "",
    )
    return " · ".join(f"{dias}: {desde.zfill(5)} - {hasta.zfill(5)}" for dias, desde, hasta in tramos) or limpiar(texto)


def direccion_para_buscar(direccion):
    """Sin local, nivel ni número de oficina, que confunden al buscador"""
    d = re.split(r",?\s*(?:locales?|local|nivel|piso|oficina|torre|edificio|y/o)\b", direccion, flags=re.I)[0]
    d = re.sub(r"\bN[°º]\s*", "", d)
    d = re.sub(r"#\s*(\d+).*$", r"\1", d)  # "Paseo Ahumada #152 ex #154" -> "Paseo Ahumada 152"
    d = re.sub(r"(\d+)[-–]\d+", r"\1", d)  # "9709-9719" -> "9709"
    d = re.sub(r"(\d+)[A-Z]\b", r"\1", d)  # "3519A" -> "3519"
    d = re.sub(r"^(?:Salida Metro [^A]+)", "", d)
    return limpiar(d.replace("Avda.", "Avenida").replace("Avda ", "Avenida ").replace("Av. ", "Avenida "))


def comuna_de(direccion_osm):
    for clave in ("suburb", "city_district", "town", "municipality", "city"):
        valor = direccion_osm.get(clave)
        if valor and valor != "Santiago":
            return valor
    return direccion_osm.get("city") or "Sin comuna"


def cargar_coordenadas():
    try:
        with open(ARCHIVO_COORDENADAS, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def buscar_en_osm(consulta):
    """Primer resultado de Nominatim para la consulta, o None si no hay o no está en la Región Metropolitana"""
    time.sleep(1.1)
    resp = requests.get(
        URL_NOMINATIM,
        params={"q": f"{consulta}, Santiago, Chile", "format": "jsonv2", "limit": 1, "countrycodes": "cl", "addressdetails": 1},
        headers=HEADERS_NOMINATIM,
        timeout=20,
    )
    resp.raise_for_status()
    datos = resp.json()
    if not datos or "metropolitana" not in (datos[0].get("address", {}).get("state") or "").lower():
        return None
    return datos[0]


def nombre_del_mall(nombre, tienda):
    """'DBS MallPlaza Egaña' -> 'Mall Plaza Egaña'; 'Alisha Mall Cenco Costanera' -> 'Mall Cenco Costanera'"""
    sin_cadena = re.sub(rf"^(?:{re.escape(tienda.split()[0])})\s+", "", nombre, flags=re.I)
    return re.sub(r"MallPlaza", "Mall Plaza", sin_cadena)


def geocodificar(nombre, tienda, direccion, cache):
    """{"lat", "lng", "comuna"} del local, o None si no se encontró en la Región Metropolitana.
    Primero por el nombre del mall (OpenStreetMap los tiene bien ubicados, y algunas direcciones no),
    después por la dirección y, si tampoco, por la calle sin número."""
    clave = f"{nombre} | {direccion_para_buscar(direccion)}"
    if clave in cache:
        return cache[clave]
    lugar = buscar_en_osm(nombre_del_mall(nombre, tienda))
    # Con un nombre como "DBS Providencia" o "Metro Los Leones" saldría la comuna, una calle o una estación: solo vale
    # un mall o local comercial, o el paradero que lleva el nombre del mall
    if lugar and lugar.get("category") not in ("shop", "landuse") and lugar.get("type") not in ("mall", "department_store", "retail", "bus_stop"):
        lugar = None
    calle = direccion_para_buscar(direccion)
    # OpenStreetMap llama "Ahumada" al Paseo Ahumada
    for intento in dict.fromkeys([calle, re.sub(r"^Paseo\s+", "", calle)]):
        lugar = lugar or buscar_en_osm(intento)
    cache[clave] = {"lat": float(lugar["lat"]), "lng": float(lugar["lon"]), "comuna": comuna_de(lugar["address"])} if lugar else None
    return cache[clave]


def locales_dbs(html):
    """(nombre, dirección, horario) de la tabla de tiendas de DBS en la Región Metropolitana, sin las cerradas"""
    sopa = BeautifulSoup(html, "html.parser")
    locales = []
    for tabla in sopa.find_all("table"):
        # DBS pone el nombre de la región como título antes de cada tabla
        titulo = tabla.find_previous(lambda tag: tag.name in ("h1", "h2", "h3", "h4", "h5", "strong", "p", "button") and tag.get_text(strip=True))
        if not titulo or "metropolitana" not in titulo.get_text(" ").lower():
            continue
        filas = tabla.find_all("tr")
        encabezado = [limpiar(c.get_text(" ")) for c in filas[0].find_all(["th", "td"])] if filas else []
        if len(encabezado) < 3 or "direcci" not in encabezado[1].lower():
            continue
        dias = encabezado[2:]
        for fila in filas[1:]:
            celdas = [limpiar(c.get_text(" ")) for c in fila.find_all(["td", "th"])]
            if len(celdas) != len(encabezado):
                continue
            horas = celdas[2:]
            if all("cerrado" in h.lower() for h in horas):
                continue
            locales.append((celdas[0], celdas[1], horario_por_dias(zip(dias, horas))))
    return locales


def locales_alisha(html):
    """(nombre, dirección, horario) de la lista de sucursales que Alisha publica al pie de su página"""
    texto = limpiar(BeautifulSoup(html, "html.parser").get_text(" "))
    inicio = texto.find("SUCURSALES")
    if inicio < 0:
        return []
    fin = texto.find("INFO", inicio)
    bloque = texto[inicio + len("SUCURSALES"):fin if fin > 0 else None]
    locales = []
    # Cada sucursal es "dirección | (nota |) Horario: ..."; la siguiente empieza tras un "hs." seguido de algo que no
    # es un día ("... 15:30 hs. Mall Plaza Vespucio")
    dias = r"(?:Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)"
    for parte in re.split(rf"(?<=hs\.)\s+(?=[A-ZÁÉÍÓÚ])(?!{dias})", bloque):
        if "Horario:" not in parte:
            continue
        antes, horario = parte.split("Horario:", 1)
        direccion = limpiar(antes.split("|")[0])
        # Nombre corto: "Mall Cenco Costanera", "Metro Los Leones", "Paseo Ahumada"
        metro = re.match(r"Salida (Metro .+?)\s+(?:Av\.?|Avenida|Calle)\s", direccion)
        nombre = metro.group(1) if metro else limpiar(re.split(r",|#|\s+Local\b|\s+\d", direccion)[0])
        if "oficina" in direccion.lower():
            nombre = "Oficina Nueva Providencia"
        locales.append((f"Alisha {nombre}", direccion, horario_alisha(horario)))
    return locales


def con_coordenadas(tienda, locales, cache):
    resultado = []
    for nombre, direccion, horario in locales:
        lugar = geocodificar(nombre, tienda, direccion, cache)
        if not lugar:
            continue
        resultado.append({
            "tienda": tienda,
            "nombre": nombre if nombre.lower().startswith(tienda.split()[0].lower()) else f"{tienda} {nombre}",
            "direccion": direccion,
            "horario": horario,
            "comuna": lugar["comuna"],
            "region": "Metropolitana",
            "telefono": "",
            "lat": lugar["lat"],
            "lng": lugar["lng"],
            "fuente": "scraping",
        })
    return resultado


def scrapear_dbs_y_alisha():
    cache = cargar_coordenadas()
    resultado = []
    for tienda, url, leer in (("DBS Beauty Store", URL_DBS, locales_dbs), ("Alisha Perfumes", URL_ALISHA, locales_alisha)):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            resultado += con_coordenadas(tienda, leer(resp.text), cache)
        except Exception as e:
            print(f"Error al consultar locales de {tienda}: {e}", file=sys.stderr)
    with open(ARCHIVO_COORDENADAS, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    return resultado


if __name__ == "__main__":
    resultado = []
    try:
        resultado += scrapear_ahumada()
    except Exception as e:
        print(f"Error al consultar locales de Ahumada: {e}", file=sys.stderr)
    resultado += scrapear_dbs_y_alisha()
    if not resultado:
        sys.exit(1)
    # ensure_ascii evita que la consola de Windows corrompa tildes al pasar el JSON a Deno
    print(json.dumps(resultado))
