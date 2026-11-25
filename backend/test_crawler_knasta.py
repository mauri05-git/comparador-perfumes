# Ejecutar con: python test_crawler_knasta.py
from crawler_knasta import inferir_genero, limpiar_titulo_perfume, normalizar_marca, sin_genero_final, sin_marca_suelta


def probar():
    casos = [
        # El título manda; "Carolina Herrera" no debe hacer pasar todo por perfume de mujer
        ("Carolina Herrera", "Perfume hombre Bad Boy Elixir EDP 50ml - CAROLINA HERRERA", None, "Masculino"),
        ("Carolina Herrera", "Bad Boy Cobalt Eau De Parfum 50Ml", None, "Masculino"),
        ("Carolina Herrera", "Good Girl Eau de Parfum 80ml", None, "Femenino"),
        ("Rabanne", "Perfume Mujer Lady Million EDP", "Masculino", "Femenino"),
        # Sin género en el título, vale la búsqueda que lo encontró
        ("Chanel", "Chance Eau Tendre", "Femenino", "Femenino"),
        ("Lattafa", "Khamrah EDP", "Masculino", "Masculino"),
        # Sin título ni búsqueda que lo digan, las palabras clave (enteras) o unisex
        ("Dior", "Sauvage EDT 100ml", None, "Masculino"),
        ("Lattafa", "Khamrah EDP", None, "Unisex"),
    ]
    for marca, titulo, busqueda, esperado in casos:
        obtenido = inferir_genero(marca, titulo, busqueda)
        assert obtenido == esperado, f"{titulo!r} (búsqueda {busqueda}): {obtenido}, se esperaba {esperado}"
    print(f"ok: {len(casos)} casos de género")

    # Lo que no es perfume se descarta
    for titulo in ["Gel De Ducha Sauvage Dior", "Bálsamo Sauvage After Shave", "Cofre Sauvage Y Miniatura Sauvage", "Born In Roma Hair & Body Mist Caramel Crush", "Hugo Boss Reloj 1540045", "Dior Addict Lip Glow", "Perfume 212 Woman Tester"]:
        assert normalizar_marca("", titulo) is None, titulo
    assert normalizar_marca("Dior", "Perfume Hombre Sauvage Elixir 100 ml") == "Dior"

    # Frases de venta y palabras sueltas fuera del nombre
    assert limpiar_titulo_perfume("Perfume Hombre Sauvage Elixir - Notas cítricas, especiadas y amaderadas 60 ml", "Dior")[0] == "Sauvage Elixir"
    assert limpiar_titulo_perfume("Boss Femme Nueva Presentacion EDP 50ml", "Hugo Boss")[0] == "Boss Femme"

    # "Men" al final se quita solo si lo que queda alcanza a ser un nombre
    assert sin_genero_final("Sauvage Men") == "Sauvage"
    assert sin_genero_final("Bad Boy Cobalt Elixir Men") == "Bad Boy Cobalt Elixir"
    assert sin_genero_final("Deep Red For Women") == "Deep Red"
    for oficial in ["212 Men", "CH Men", "Hugo Man", "Xy Men"]:
        assert sin_genero_final(oficial) == oficial, oficial
    # Pedazos sueltos de la marca fuera del nombre, sin romper nombres que los necesitan
    assert sin_marca_suelta("Herrera Confidential Amethyst Carolina", "Carolina Herrera") == "Confidential Amethyst"
    assert sin_marca_suelta("1 Million Paco", "Rabanne") == "1 Million"
    assert sin_marca_suelta("Paco 1 Million Parfum", "Rabanne") == "1 Million Parfum"
    assert sin_marca_suelta("Versace Eros", "Versace") == "Eros"
    for intacto, marca in [("Hugo Man", "Hugo Boss"), ("Boss Femme", "Hugo Boss"), ("Miss Dior", "Dior"), ("Good Girl", "Carolina Herrera"), ("Sauvage", "Dior")]:
        assert sin_marca_suelta(intacto, marca) == intacto, intacto
    # Errores de las tiendas y la forma del frasco
    assert limpiar_titulo_perfume("Perfume Goodgirl EDP 80ml", "Carolina Herrera")[0] == "Good Girl"
    assert limpiar_titulo_perfume("Perfume J´adior EDP 50ml", "Dior")[0] == "J'adore"
    assert limpiar_titulo_perfume("Hugo Boss Cantimplora Verde EDT 125ml", "Hugo Boss")[0] == "Hugo Man"
    assert limpiar_titulo_perfume("Perfume One Millon EDT 100ml", "Rabanne")[0] == "One Million"
    assert limpiar_titulo_perfume("Versace Eau Fraiche Extreme 100", "Versace")[0] == "Eau Fraiche Extreme"
    assert limpiar_titulo_perfume("Perfumen Bright Crystal Absolu EDP 90ml", "Versace")[0] == "Bright Crystal Absolu"
    assert normalizar_marca("Versace", "Versace Costa Azzurra En Aerosol") is None
    print("ok: limpieza de nombres")


if __name__ == "__main__":
    probar()
