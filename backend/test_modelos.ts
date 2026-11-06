const API_KEY = ""; 

try {
  const respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
  const datos = await respuesta.json();
  
  if (datos.models) {
    console.log("\n✅ Modelos disponibles para tu API Key:");
    // Filtramos solo los modelos de texto/visión útiles
    datos.models
      .filter((m: any) => m.name.includes("gemini"))
      .forEach((m: any) => console.log(`- ${m.name.replace('models/', '')}`));
  } else {
    console.log("❌ Error al consultar:", datos);
  }
} catch (error) {
  console.error("Error de red:", error);
}