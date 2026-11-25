import { alergenosEnIngredientes, claveFormula, claveResena, clavesDelMismoPerfume, enCola, historialDeOfertas, mismaFormula, otraVersionQueLaBuscada, mismoProducto, palabrasDeMarcas, traduccionValida, validarResena } from "./utilidades.ts";

function asegurar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(mensaje);
}

Deno.test("mismoProducto reconoce el mismo producto aunque cambie la URL", () => {
  asegurar(
    mismoProducto(
      "https://www.falabella.com/falabella-cl/product/3466713/Perfume-Mujer-La-Vie/3466713",
      "https://www.falabella.com/falabella-cl/product/3466713/otro-slug?rid=1",
    ),
    "Falabella por id de producto",
  );
  asegurar(
    mismoProducto("https://dbs.cl/la-vie-est-belle-75-ml-lcm-61283/", "https://DBS.cl/la-vie-est-belle-75-ml-lcm-61283?x=1"),
    "otras tiendas sin parametros ni barra final",
  );
  asegurar(
    !mismoProducto(
      "https://www.falabella.com/falabella-cl/product/3466713/a",
      "https://www.falabella.com/falabella-cl/product/80045789/a",
    ),
    "productos distintos",
  );
  asegurar(!mismoProducto("", ""), "URL vacia no coincide");
  asegurar(!mismoProducto(null, undefined), "sin URL no coincide");
});

Deno.test("enCola ejecuta las tareas en orden aunque la primera tarde mas", async () => {
  const orden: number[] = [];
  const lenta = enCola(async () => {
    await new Promise((r) => setTimeout(r, 30));
    orden.push(1);
  });
  const rapida = enCola(async () => {
    orden.push(2);
  });
  await Promise.all([lenta, rapida]);
  asegurar(orden.join(",") === "1,2", `orden incorrecto: ${orden}`);
});

Deno.test("enCola sigue funcionando despues de una tarea que falla", async () => {
  await enCola(() => Promise.reject(new Error("falla"))).catch(() => {});
  const valor = await enCola(() => Promise.resolve(7));
  asegurar(valor === 7, "la cola quedo bloqueada");
});

Deno.test("alergenosEnIngredientes lee la lista INCI del envase", () => {
  const lista = "Alcohol • Perfume / Fragancia • Linalool • Limoneno • Hexil Cinamal • Cumarina • Geraniol • Citronelol";
  asegurar(
    alergenosEnIngredientes(lista)?.join(",") === "limonene,linalool,coumarin,geraniol,citronellol,hexyl_cinnamal",
    `detectados: ${alergenosEnIngredientes(lista)}`,
  );
  asegurar(alergenosEnIngredientes("Alcohol, Parfum, Cinnamal")?.join(",") === "cinnamal", "cinnamal solo");
  asegurar(
    alergenosEnIngredientes("Alcohol, Parfum, Alcohol Bencílico, Salicilato De Bencilo, Isoeugenol, Hidroxicitronelal, Amyl Cinnamal")?.join(",") ===
      "isoeugenol,hydroxycitronellal,benzyl_salicylate,amyl_cinnamal,benzyl_alcohol",
    `lista ampliada: ${alergenosEnIngredientes("Alcohol, Parfum, Alcohol Bencílico, Salicilato De Bencilo, Isoeugenol, Hidroxicitronelal, Amyl Cinnamal")}`,
  );
  asegurar(alergenosEnIngredientes("Alcohol Aqua / Agua Perfume Linalol")?.join(",") === "linalool", "linalol en español");
  asegurar(alergenosEnIngredientes("Alcohol, Aqua, Parfum") === null, "lista resumida no declara 'sin alérgenos'");
  asegurar(alergenosEnIngredientes("Alcohol - Parfum - Aqua") === null, "lista resumida de D&G Light Blue");
  asegurar(alergenosEnIngredientes("Alcohol, Parfum, Aqua, BHT")?.length === 0, "lista completa sin alérgenos");
  asegurar(alergenosEnIngredientes("Bergamota, Vainilla, Notas amaderadas") === null, "notas no son ingredientes");
  asegurar(alergenosEnIngredientes("Perfume con bergamota y lavanda") === null, "texto libre con la palabra perfume");
  asegurar(alergenosEnIngredientes("Eau de Parfum con notas de lavanda") === null, "texto libre con la palabra parfum");
  asegurar(alergenosEnIngredientes(undefined) === null, "sin texto");
});

Deno.test("alergenosEnIngredientes no toma una descripción como lista del envase", () => {
  asegurar(
    alergenosEnIngredientes("Alcohol agua fragancia aroma aceites esenciales bergamota cardamomo cuero patchouli conservantes colorantes") === null,
    "descripción de Burberry Her",
  );
  asegurar(alergenosEnIngredientes("Limón Siciliano, Cedro") === null, "notas de Light Blue");
});

Deno.test("mismaFormula reconoce el mismo perfume y concentración en otro tamaño o tienda", () => {
  const marcas = palabrasDeMarcas(["Carolina Herrera", "Giorgio Armani", "Dolce & Gabbana", "Hugo Boss"]);
  const clave = (n: string) => claveFormula(n, marcas);
  asegurar(mismaFormula(clave("Perfume Hombre Bad Boy Edt 100 ml - CAROLINA HERRERA"), clave("Bad Boy EDT 50ml")), "con y sin marca");
  asegurar(
    mismaFormula(clave("Perfume Mujer My Way Eau De Parfum 30ml - GIORGIO ARMANI"), clave("Giorgio Armani My Way EDP 90 ml")),
    "otro tamaño y orden",
  );
  asegurar(
    mismaFormula(clave("Dolce & Gabbana Light Blue Pour Homme 100ML EDT - DOLCE&GABBANA"), clave("Light Blue Pour Homme Eau de Toilette 75 ml")),
    "marca con &",
  );
  asegurar(!mismaFormula(clave("My Way EDP 30 ml Giorgio Armani"), clave("My Way Ylang EDP 30 ml Giorgio Armani")), "otra versión");
  asegurar(!mismaFormula(clave("Bad Boy EDT 100 ml"), clave("Bad Boy EDP 100 ml")), "otra concentración");
  asegurar(!mismaFormula(clave("Light Blue EDT 100 ml"), clave("Light Blue Pour Homme EDT 100 ml")), "femenino y masculino");
  asegurar(!mismaFormula(clave("Hugo Femme EDP 75 ml"), clave("Boss Femme EDP 75 ml")), "marcas distintas");
  asegurar(!mismaFormula(clave("Perfume Hombre Light Blue EDT 100ml"), clave("Perfume Mujer Light Blue EDT 100ml")), "solo la categoría distingue el género");
  asegurar(mismaFormula(clave("Perfume Hombre Bad Boy EDT 100 ml"), clave("Bad Boy EDT 50 ml")), "un nombre sin género");
  asegurar(
    mismaFormula(clave("GIORGIO ARMANI MY WAY YLANG WOMAN EDP 30ML"), clave("Perfume Mujer My Way Ylang Eau De Parfum 30ml - GIORGIO ARMANI")),
    "Woman y Mujer en otra tienda",
  );
  asegurar(clave("Set Bad Boy EDT 100 ml + Desodorante") === null, "set");
  asegurar(clave("Recarga Sauvage EDT 300 ml") === null, "recarga");
  asegurar(clave("Perfume Bad Boy 100 ml") === null, "sin concentración no se sabe la fórmula");
});

Deno.test("historialDeOfertas junta el mismo producto de distintas búsquedas", () => {
  const url = "https://dbs.cl/versace-eros-edp-50-ml-vr-86190";
  const mapa = {
    "versace eros": [
      { fecha: "2026-11-08", tienda: "DBS Beauty Store", nombre: "Versace Eros Eau de Parfum 50 Ml", precio: 59990, ml: 50, url },
      { fecha: "2026-11-08", tienda: "DBS Beauty Store", nombre: "Versace Eros Eau de Toilette 50 Ml", precio: 51590, ml: 50, url: "https://dbs.cl/versace-eros-edt-50-ml-vr-80920" },
    ],
    "versace versace eros": [
      { fecha: "2026-11-08", tienda: "DBS Beauty Store", nombre: "Versace Eros Eau de Parfum 50 Ml", precio: 59990, ml: 50, url },
      { fecha: "2026-11-09", tienda: "DBS Beauty Store", nombre: "Versace Eros EDP 50ml", precio: 57990, ml: 50, url: url + "?color=1" },
    ],
    "versace eros eau de parfum 50 ml": [
      { fecha: "2026-11-13", tienda: "DBS Beauty Store", nombre: "Versace Eros Eau de Parfum 50 Ml", precio: 55790, ml: 50, url },
    ],
  };
  const h = historialDeOfertas(mapa, [{ tienda: "DBS Beauty Store", nombre: "Versace Eros Eau de Parfum 50 Ml", url, ml: 50 }]);
  asegurar(h.map((r) => r.fecha).join(",") === "2026-11-08,2026-11-09,2026-11-13", `fechas: ${h.map((r) => r.fecha)}`);
  asegurar(!h.some((r) => r.nombre?.includes("Toilette")), "no mezcla otro producto de la misma búsqueda");
});

Deno.test("otraVersionQueLaBuscada: la ficha de otra versión se descarta si las tiendas venden lo buscado", () => {
  const precios = [
    { nombre: "Perfume hombre Bad Boy Elixir EDP 50ml - CAROLINA HERRERA" },
    { nombre: "Perfume Hombre Bad Boy Cobalt Elixir EDP 100 ML - CAROLINA HERRERA" },
    { nombre: "Bad Boy Eau De Toilette 100Ml" },
  ];
  const cobalt = { nombre: "Bad Boy Cobalt Elixir", marca: "Carolina Herrera" };
  const elixir = { nombre: "Bad Boy Elixir", marca: "Carolina Herrera" };
  asegurar(otraVersionQueLaBuscada("Bad Boy Elixir", cobalt, precios), "Cobalt no es lo buscado");
  asegurar(otraVersionQueLaBuscada("Carolina Herrera Bad Boy Elixir", cobalt, precios), "también con la marca escrita");
  asegurar(!otraVersionQueLaBuscada("Bad Boy Elixir", elixir, precios), "la ficha correcta se queda");
  asegurar(!otraVersionQueLaBuscada("Bad Boy Elixir", cobalt, precios.slice(1)), "si nadie vende lo buscado, no hay con qué comparar");
  asegurar(!otraVersionQueLaBuscada("Sauvage", { nombre: "Sauvage Eau de Toilette", marca: "Dior" }, [{ nombre: "Dior Sauvage EDT 100ml" }]), "la concentración no cuenta como otra versión");
});

Deno.test("claveResena: mismo perfume aunque cambien tildes, mayúsculas o signos", () => {
  asegurar(claveResena("Acqua di Giò  EDP") === claveResena("acqua di gio edp"), "tildes y espacios");
  asegurar(claveResena("J'adore") === "j adore", claveResena("J'adore"));
  asegurar(claveResena("Sauvage EDT") !== claveResena("Sauvage Elixir"), "otra versión es otra reseña");
});

Deno.test("clavesDelMismoPerfume: con o sin concentración es el mismo perfume, otra versión no", () => {
  const guardadas = ["acqua di gio pour homme", "acqua di gio pour homme edt", "acqua di gio pour homme eau de parfum", "acqua di gio profumo", "sauvage elixir"];
  const con = clavesDelMismoPerfume(claveResena("Acqua di Giò Pour Homme Eau de Toilette"), guardadas);
  asegurar(JSON.stringify(con) === JSON.stringify(["acqua di gio pour homme", "acqua di gio pour homme edt"]), JSON.stringify(con));
  const sin = clavesDelMismoPerfume(claveResena("Acqua di Giò Pour Homme"), guardadas);
  asegurar(sin.length === 3 && !sin.includes("acqua di gio profumo"), JSON.stringify(sin));
  asegurar(clavesDelMismoPerfume(claveResena("Sauvage"), guardadas).length === 0, "Sauvage Elixir es otro perfume");
});

Deno.test("validarResena: rechaza lo que no corresponde y limpia lo válido", () => {
  const ok = { perfume: " Sauvage EDT ", usuario: "Mauri", rating: 4, duracion_horas: 8, comentario: "Fresco y dura toda la tarde." };
  const r = validarResena(ok);
  asegurar(typeof r !== "string" && r.perfume === "Sauvage EDT" && r.rating === 4, JSON.stringify(r));
  for (const malo of [
    { ...ok, rating: 6 },
    { ...ok, rating: 4.5 },
    { ...ok, rating: "5; borrar" },
    { ...ok, usuario: "" },
    { ...ok, usuario: "x".repeat(41) },
    { ...ok, comentario: "corto" },
    { ...ok, comentario: "a".repeat(801) },
    { ...ok, perfume: "" },
    { ...ok, duracion_horas: 100 },
    null,
  ]) {
    asegurar(typeof validarResena(malo) === "string", `debía rechazar ${JSON.stringify(malo)}`);
  }
});

Deno.test("traduccionValida guarda solo lo que calza con la ficha en español", () => {
  const ficha = {
    familia_olfativa: "Aromático Fougère",
    notas_salida: ["Bergamota", "Pimienta"],
    notas_fondo: ["Ambroxan"],
    descripcion: "Fresco y especiado.",
    guia_aplicacion: { atomizaciones: "3", puntos_pulso: ["Cuello", "Muñecas"], consejo_experto: "x", clima_ideal: "y" },
  };
  const en = traduccionValida({
    familia_olfativa: "Aromatic Fougère",
    notas_salida: ["Bergamot", "Pepper"],
    notas_fondo: ["Ambroxan", "Cedar"], // una de más: ya no es la misma pirámide
    descripcion: "Fresh and spicy.",
    guia_aplicacion: { atomizaciones: "3", puntos_pulso: ["Neck", "Wrists"], consejo_experto: "a", clima_ideal: "b" },
    nombre: "Otro nombre", // no es un campo que se traduzca
  }, ficha);
  asegurar(en.familia_olfativa === "Aromatic Fougère" && en.notas_salida[0] === "Bergamot", "traduce familia y notas");
  asegurar(!("notas_fondo" in en), "descarta una lista con otra cantidad");
  asegurar(!("nombre" in en), "no guarda campos que no se traducen");
  asegurar(en.guia_aplicacion.puntos_pulso[1] === "Wrists", "guarda la guía completa");
  asegurar(traduccionValida(null, ficha) === undefined && traduccionValida({}, ficha) === undefined, "sin traducción, nada");
});
