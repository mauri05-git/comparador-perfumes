from scraper_sucursales import (
    convertir_local, direccion_para_buscar, es_region_metropolitana, horario_alisha, horario_desde_html, horario_por_dias,
    locales_alisha, locales_dbs, nombre_del_mall,
)

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

# DBS: tabla con un horario por columna; las tiendas cerradas todos los días no se muestran
tabla = """<h3>Región Metropolitana de Santiago</h3><table><tr><th>Tiendas</th><th>Dirección</th><th>Lunes a Jueves</th><th>Viernes</th><th>Sábado</th><th>Domingo</th></tr>
<tr><td>DBS Providencia</td><td>Avda. Providencia 2230, Local 15</td><td>10:00 - 20:00</td><td>10:00 - 20:00</td><td>10:00 - 14:00</td><td>CERRADO</td></tr>
<tr><td>Plaza San Miguel</td><td>Av. de la Marina 2000</td><td>CERRADO</td><td>CERRADO</td><td>CERRADO</td><td>CERRADO</td></tr></table>"""
assert locales_dbs(tabla) == [("DBS Providencia", "Avda. Providencia 2230, Local 15",
    "Lunes a Jueves: 10:00 - 20:00 · Viernes: 10:00 - 20:00 · Sábado: 10:00 - 14:00 · Domingo: CERRADO")]
assert horario_por_dias([("Domingo", "Cerrado")]) == "Domingo: CERRADO"
assert locales_dbs("<h3>I Región de Tarapacá</h3>" + tabla.split("</h3>", 1)[1]) == [], "otras regiones no"
assert direccion_para_buscar("Paseo Ahumada #152 ex #154 Local 5") == "Paseo Ahumada 152"
assert direccion_para_buscar("Pte. Eduardo Frei Montalva N°9709-9719, Local L515-A") == "Pte. Eduardo Frei Montalva 9709"
assert direccion_para_buscar("Av. El Llano Subercaseaux 3519A, local 1094") == "Avenida El Llano Subercaseaux 3519"

# Alisha: sucursales al pie de la página
pie = """<footer>SUCURSALES Av. Nueva Providencia 2155 Edificio Panorámico, Torre A, Piso 5, Oficina 504. | Entrada con previo registro de identidad | Horario: Lunes a Viernes 10:00-18:30 hs. Sábados 10:00-15:30 hs. Mall Cenco Costanera, Nivel 1 Local 1517 | Horario: Lunes a Domingo de 10:00-21:00hs. Salida Metro Los Leones Av. Nueva Providencia 2224 y/o 2234 Local PM4-PM5 | Horario: Lunes a Viernes de 09:30-19:00 hs- Sábados 9:30-16:00hs. INFO Nosotros</footer>"""
locales = locales_alisha(pie)
assert [l[0] for l in locales] == ["Alisha Oficina Nueva Providencia", "Alisha Mall Cenco Costanera", "Alisha Metro Los Leones"], locales
assert locales[1][2] == "Lunes a Domingo: 10:00 - 21:00", locales[1][2]
assert locales[2][2] == "Lunes a Viernes: 09:30 - 19:00 · Sábados: 09:30 - 16:00", locales[2][2]
assert locales[0][2] == "Lunes a Viernes: 10:00 - 18:30 · Sábados: 10:00 - 15:30", locales[0][2]
assert horario_alisha("Lunes a Jueves 10:30-20:30 hs. Viernes a Domingos: 10:30-21:00 hs.") == "Lunes a Jueves: 10:30 - 20:30 · Viernes a Domingos: 10:30 - 21:00"

# Lo que se le pasa al buscador de direcciones
assert direccion_para_buscar("Av. Manquehue Sur N°31, Local 150") == "Avenida Manquehue Sur 31"
assert direccion_para_buscar("Avda Kennedy 5413 local 107, 1° nivel") == "Avenida Kennedy 5413"
assert locales_alisha("SUCURSALES Paseo Ahumada #152 ex #154 Local 5 | Horario: Lunes a Viernes de 09:30-19:00 hs. INFO")[0][0] == "Alisha Paseo Ahumada"
assert direccion_para_buscar("Salida Metro Los Leones Av. Nueva Providencia 2224 y/o 2234 Local PM4-PM5") == "Avenida Nueva Providencia 2224"

assert nombre_del_mall("DBS MallPlaza Egaña", "DBS Beauty Store") == "Mall Plaza Egaña"
assert nombre_del_mall("Alisha Mall Cenco Costanera", "Alisha Perfumes") == "Mall Cenco Costanera"

print("ok")
