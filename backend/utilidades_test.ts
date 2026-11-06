import { enCola, mismoProducto } from "./utilidades.ts";

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
