from bs4 import BeautifulSoup

from scraper_stock import (STOCK_NO, STOCK_SI, STOCK_SIN_VERIFICAR, cotizar_alisha_js, cotizar_dbs_pdp,
                           cotizar_falabella_pdp, detalle_falabella, stock_ahumada, stock_alisha, stock_dbs, stock_falabella)


def pdp(producto):
    return {"props": {"pageProps": {"productData": producto}}}


assert stock_alisha({"available": True}) == STOCK_SI
assert stock_alisha({"available": False}) == STOCK_NO
assert stock_alisha({}) == STOCK_SIN_VERIFICAR

assert stock_falabella(pdp({"isOutOfStock": True}), "1") == STOCK_NO
assert stock_falabella(pdp({"isOutOfStock": False, "variants": [{"id": "1", "isPurchaseable": True}]}), "1") == STOCK_SI
assert stock_falabella(pdp({"isOutOfStock": False, "variants": [{"id": 1, "isPurchaseable": False}]}), "1") == STOCK_NO
assert stock_falabella({}, "1") == STOCK_SIN_VERIFICAR

def dbs(html):
    return BeautifulSoup(html, "html.parser").div

assert stock_dbs(dbs('<div><form data-role="tocart-form"></form></div>')) == STOCK_SI
assert stock_dbs(dbs('<div><div class="stock unavailable">Sin stock</div></div>')) == STOCK_NO
assert stock_dbs(dbs("<div>Producto Agotado</div>")) == STOCK_NO
assert stock_dbs(dbs("<div>Perfume</div>")) == STOCK_SIN_VERIFICAR

assert stock_ahumada(dbs("<div><button>Agregar al Carrito</button></div>")) == STOCK_SI
assert stock_ahumada(dbs("<div><button disabled>Agregar al Carrito</button></div>")) == STOCK_NO
assert stock_ahumada(dbs("<div>Producto agotado</div>")) == STOCK_NO
assert stock_ahumada(dbs("<div>Colonia</div>")) == STOCK_SIN_VERIFICAR

# Re-cotización directa desde la página del producto
fal = cotizar_falabella_pdp(pdp({
    "currentVariant": "2",
    "variants": [
        {"id": "1", "name": "A 50ml", "isPurchaseable": True, "prices": [{"crossed": False, "price": ["10.000"]}]},
        {"id": "2", "name": "A 100ml", "isPurchaseable": False,
         "prices": [{"crossed": True, "price": ["99.990"]}, {"crossed": False, "price": ["72.990"]}]},
    ],
}), "u")
assert fal["precio"] == 72990 and fal["nombre"] == "A 100ml" and fal["stock"] == STOCK_NO
assert cotizar_falabella_pdp(pdp({"variants": []}), "u") is None

sopa = BeautifulSoup('<h1>Scandal 30Ml</h1><meta property="product:price:amount" content="61490">'
                     '<button id="product-addtocart-button"></button>', "html.parser")
assert cotizar_dbs_pdp(sopa, "u") == {"tienda": "DBS Beauty Store", "nombre": "Scandal 30Ml", "precio": 61490, "stock": STOCK_SI, "url": "u"}
assert cotizar_dbs_pdp(BeautifulSoup("<h1>Sin precio</h1>", "html.parser"), "u") is None

ali = cotizar_alisha_js({"title": "CK ONE 100ML", "price": 2299000, "available": False}, "u")
assert ali["precio"] == 22990 and ali["stock"] == STOCK_NO

specs = pdp({"attributes": {"specifications": [
    {"name": "Ingredientes", "value": "Alcohol\xa0•\xa0Linalool"},
    {"name": "Notas aromáticas", "value": "Bergamota, vainilla"},
    {"name": "País de origen", "value": "Francia"},
]}})
assert detalle_falabella(specs) == {"ingredientes": "Alcohol • Linalool", "notasTienda": "Bergamota, vainilla"}
assert detalle_falabella(pdp({})) == {}

# Las tiendas dejan un GIF transparente en src mientras la foto real carga después
from bs4 import BeautifulSoup as _BS
from scraper_stock import url_imagen
gif = "data:image/gif;base64,R0lGODlhPAE8AYAAAP"
dbs = _BS(f'<img src="{gif}" data-src="https://dbs.cl/a.jpg" srcset="https://dbs.cl/a.jpg 1x">', "html.parser").img
assert url_imagen(dbs) == "https://dbs.cl/a.jpg"
solo_srcset = _BS(f'<img src="{gif}" srcset="https://dbs.cl/b.jpg?x=1 1x, https://dbs.cl/b2.jpg 2x">', "html.parser").img
assert url_imagen(solo_srcset) == "https://dbs.cl/b.jpg?x=1"
assert url_imagen(_BS(f'<img src="{gif}">', "html.parser").img) is None
assert url_imagen(_BS('<img src="https://x.cl/c.jpg">', "html.parser").img) == "https://x.cl/c.jpg"
assert url_imagen(None) is None

# Tamaños del listado de Falabella y detalle guardado de cada producto
from datetime import date, timedelta

from scraper_stock import con_tamano, detalle_guardado, id_producto_falabella, tamanos_falabella

listado = {"variants": [{"type": "SIZES", "options": [
    {"size": "90 ML", "url": "https://f.cl/product/1/x/3", "variant": "3", "isPurchaseable": True, "sizeOrder": 2,
     "prices": [{"crossed": False, "price": ["182.990"]}]},
    {"size": "30 ML", "url": "https://f.cl/product/1/x/1", "variant": "1", "isPurchaseable": False, "sizeOrder": 0,
     "prices": [{"crossed": True, "price": ["99.990"]}, {"crossed": False, "price": ["81.990"]}]},
]}]}
t = tamanos_falabella(listado)
assert [x["tamano"] for x in t] == ["30ml", "90ml"]
assert t[0]["precio"] == 81990 and t[0]["stock"] == STOCK_NO and t[1]["stock"] == STOCK_SI
assert tamanos_falabella({"variants": [{"type": "COLOR", "options": []}]}) == []
assert con_tamano("Perfume Black Opium - YSL", "30ml") == "Perfume Black Opium - YSL 30ml"
assert con_tamano("Perfume Black Opium 50ml - YSL", "30ml") == "Perfume Black Opium 50ml - YSL"

assert id_producto_falabella("https://www.falabella.com/falabella-cl/product/80504185/nombre/80504163") == "80504185"
assert id_producto_falabella("https://alishaperfumes.cl/products/x") is None
hoy, viejo = date.today().isoformat(), (date.today() - timedelta(days=40)).isoformat()
guardados = {"1": {"fecha": hoy, "detalle": {"notasTienda": "Vainilla"}}, "2": {"fecha": viejo, "detalle": {}}}
assert detalle_guardado(guardados, "https://f.cl/product/1/x")["detalle"] == {"notasTienda": "Vainilla"}
assert detalle_guardado(guardados, "https://f.cl/product/2/x") is None  # de hace más de 30 días: se vuelve a leer
assert detalle_guardado(guardados, "https://f.cl/product/9/x") is None

# Guardar junta lo nuevo con lo que ya estaba (otra búsqueda pudo escribir entre medio)
import os
import tempfile

import scraper_stock

carpeta = tempfile.mkdtemp()
scraper_stock.ARCHIVO_DETALLES = os.path.join(carpeta, "detalles.json")
scraper_stock.guardar_detalles({"1": {"fecha": hoy, "detalle": {"notasTienda": "Rosa"}}})
scraper_stock.guardar_detalles({"2": {"fecha": hoy, "detalle": {}}})
assert set(scraper_stock.leer_detalles()) == {"1", "2"}
assert scraper_stock.leer_detalles()["1"]["detalle"] == {"notasTienda": "Rosa"}

print("ok")
