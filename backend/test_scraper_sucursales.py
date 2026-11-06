from scraper_sucursales import convertir_local, es_region_metropolitana, horario_desde_html

html = "<p>Lunes a Viernes: 08:00 - 21:00<br>\n            Sábado: 09:00 - 14:00<br>\n            Domingo: CERRADO</p>"
assert horario_desde_html(html, False) == "Lunes a Viernes: 08:00 - 21:00 · Sábado: 09:00 - 14:00 · Domingo: CERRADO"
assert horario_desde_html(html, True) == "Abierto 24 horas"
assert horario_desde_html("", False) == "Horario no informado"

assert es_region_metropolitana({"stateCode": "Región Metropolitana"})
assert es_region_metropolitana({"stateCode": "Region Metropolitana de Santiago"})
assert not es_region_metropolitana({"stateCode": "Valparaíso"})

local = convertir_local({
    "city": " Ñuñoa ", "address1": "Irarrázaval  1890", "storeHours": html, "is24hours": True,
    "phone": "", "latitude": -33.45, "longitude": -70.62,
})
assert local["nombre"] == "Ahumada Ñuñoa 24h"
assert local["direccion"] == "Irarrázaval 1890"
assert local["horario"] == "Abierto 24 horas"
assert local["telefono"] == "Sin teléfono"
assert local["fuente"] == "scraping"

print("ok")
