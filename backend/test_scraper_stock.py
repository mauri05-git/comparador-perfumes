from bs4 import BeautifulSoup

from scraper_stock import STOCK_NO, STOCK_SI, STOCK_SIN_VERIFICAR, stock_ahumada, stock_alisha, stock_dbs, stock_falabella


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

print("ok")
