import json
import re
import sys

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


if __name__ == "__main__":
    try:
        resultado = scrapear_ahumada()
    except Exception as e:
        print(f"Error al consultar locales de Ahumada: {e}", file=sys.stderr)
        sys.exit(1)
    # ensure_ascii evita que la consola de Windows corrompa tildes al pasar el JSON a Deno
    print(json.dumps(resultado))
