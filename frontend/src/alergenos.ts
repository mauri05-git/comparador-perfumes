// Los 26 alérgenos de fragancia que la norma europea de cosméticos (Reglamento 1223/2009, anexo III) obliga a declarar
// en el envase sobre 0,001 %. Única lista de la app: la usan el lector de ingredientes, el semáforo y el backend.
// `inci` reconoce el nombre en la lista del envase (INCI y su traducción), sobre texto en minúsculas y sin tildes.
// `keywords` son notas que lo sugieren, solo para estimar cuando no hay lista; vacío si no hay una nota típica.

export type NivelRiesgo = 'Alto' | 'Moderado' | 'Bajo';

export interface AlergenoUE {
  id: string;
  compuesto: string;
  nombre: string;
  inci: RegExp;
  keywords: string[];
  riesgo: NivelRiesgo;
  explicacion: string;
  // Aparece en la mayoría de los perfumes: se muestra primero al configurar las alergias
  frecuente: boolean;
}

const NOTAS_EUGENOL = ['clavo', 'pimienta', 'pimienta rosa', 'pimienta negra', 'sichuan', 'nuez moscada', 'especias'];
const NOTAS_ROSA = ['rosa', 'geranio', 'peonía', 'peonia', 'magnolia', 'lirio', 'tuberosa', 'nardo'];

export const ALERGENOS_UE: AlergenoUE[] = [
  {
    id: 'limonene', compuesto: 'D-Limonene', nombre: 'Cítricos / Bergamota / Limón', inci: /\blimonen[eo]\b/,
    keywords: ['bergamota', 'limón', 'limon', 'naranja', 'mandarina', 'pomelo', 'toronja', 'cítrico', 'citrico', 'cítricos', 'citricos', 'yuzu', 'lima', 'neroli'],
    riesgo: 'Moderado', frecuente: true,
    explicacion: 'Presente en cáscaras de cítricos. Al oxidarse en pieles sensibles puede causar enrojecimiento o fotosensibilidad.',
  },
  {
    id: 'linalool', compuesto: 'Linalool', nombre: 'Lavanda / Neroli / Flores Blancas', inci: /\blinalo?ol\b/,
    keywords: ['lavanda', 'neroli', 'cilantro', 'albahaca', 'jazmín', 'jazmin', 'flor de azahar', 'azahar', 'salvia', 'geranio'],
    riesgo: 'Moderado', frecuente: true,
    explicacion: 'Terpeno floral muy común en aguas de colonia y fougères. Regulado por la directiva europea de cosméticos.',
  },
  {
    id: 'cinnamal', compuesto: 'Cinnamal (Cinamaldehído)', nombre: 'Canela / Especias Cálidas',
    // "hexyl/amyl cinnamal" son otros compuestos de la lista
    inci: /(?<!(hexil|hexyl|amil|amyl)\s?)\bcinn?amal\b/,
    keywords: ['canela', 'cassia', 'especias cálidas', 'cardamomo', 'nuez moscada'],
    riesgo: 'Alto', frecuente: true,
    explicacion: 'Uno de los alérgenos de contacto más reactivos en perfumería oriental e invernal según normas IFRA.',
  },
  {
    id: 'eugenol', compuesto: 'Eugenol', nombre: 'Clavo de Olor / Pimienta Picante', inci: /\beugenol\b/,
    keywords: NOTAS_EUGENOL, riesgo: 'Alto', frecuente: true,
    explicacion: 'Compuesto aromático presente en especias intensas. Puede desencadenar irritación local en cuello y muñecas.',
  },
  {
    id: 'coumarin', compuesto: 'Coumarin (Cumarina)', nombre: 'Haba Tonka / Vainilla / Almendra', inci: /\b(coumarin|cumarina)\b/,
    keywords: ['haba tonka', 'tonka', 'vainilla', 'almendra', 'cacao', 'praliné', 'praline', 'caramelo'],
    riesgo: 'Moderado', frecuente: true,
    explicacion: 'Clásico fijador dulce en perfumes gourmand y nocturnos.',
  },
  {
    id: 'oakmoss', compuesto: 'Evernia Prunastri', nombre: 'Musgo de Roble / Pachulí / Tierra',
    inci: /evernia prunastri|musgo de roble/,
    keywords: ['musgo', 'musgo de roble', 'roble', 'liquen', 'chipre', 'fougère', 'fougere', 'vetiver', 'pachulí', 'pachuli'],
    riesgo: 'Alto', frecuente: true,
    explicacion: 'Extracto botánico fuertemente restringido por IFRA debido a su contenido de atranol y cloroatranol.',
  },
  {
    id: 'citral', compuesto: 'Citral (Geranial)', nombre: 'Verbena / Hierba Limón / Jengibre', inci: /\bcitral\b/,
    keywords: ['verbena', 'lemongrass', 'hierba limón', 'jengibre', 'cidra', 'petitgrain'],
    riesgo: 'Moderado', frecuente: true,
    explicacion: 'Aldehído cítrico de gran potencia fresca que puede irritar pieles con dermatitis atópica.',
  },
  {
    id: 'geraniol', compuesto: 'Geraniol', nombre: 'Rosa / Peonía / Geranio', inci: /\bgeraniol\b/,
    keywords: NOTAS_ROSA, riesgo: 'Bajo', frecuente: true,
    explicacion: 'Componente primario de aceites esenciales de rosas y buqués florales.',
  },
  {
    id: 'citronellol', compuesto: 'Citronellol', nombre: 'Rosa / Citronela', inci: /\bcitronell?ol\b/,
    keywords: NOTAS_ROSA, riesgo: 'Bajo', frecuente: true,
    explicacion: 'Alcohol de aroma a rosa fresca, presente en el aceite de rosa, geranio y citronela.',
  },
  {
    id: 'isoeugenol', compuesto: 'Isoeugenol', nombre: 'Isoeugenol (clavo, ylang)', inci: /\bisoeugenol\b/,
    keywords: NOTAS_EUGENOL, riesgo: 'Alto', frecuente: false,
    explicacion: 'Pariente del eugenol, más sensibilizante: su concentración está limitada por IFRA.',
  },
  {
    id: 'hydroxycitronellal', compuesto: 'Hydroxycitronellal', nombre: 'Hidroxicitronelal (muguet)',
    inci: /\bhydroxycitronellal\b|\bhidroxicitronelal\b/, keywords: ['muguet', 'lirio de los valles'],
    riesgo: 'Alto', frecuente: false,
    explicacion: 'Molécula sintética de aroma floral fresco; de las que más reacciones produce en pruebas de parche.',
  },
  {
    id: 'benzyl_salicylate', compuesto: 'Benzyl Salicylate', nombre: 'Salicilato de Bencilo',
    inci: /\bbenzyl salicylate\b|\bsalicilato de bencilo\b/, keywords: [], riesgo: 'Bajo', frecuente: false,
    explicacion: 'Fijador floral muy usado (ylang, jazmín). Sensibilizante débil.',
  },
  {
    id: 'hexyl_cinnamal', compuesto: 'Hexyl Cinnamal', nombre: 'Hexil Cinamal',
    inci: /\bhex(yl|il) ?cinn?amal\b/, keywords: [], riesgo: 'Bajo', frecuente: false,
    explicacion: 'Molécula de aroma a jazmín, muy común en perfumes. Sensibilizante débil.',
  },
  {
    id: 'amyl_cinnamal', compuesto: 'Amyl Cinnamal', nombre: 'Amil Cinamal',
    inci: /\bam(yl|il) ?cinn?amal\b/, keywords: [], riesgo: 'Moderado', frecuente: false,
    explicacion: 'Molécula de aroma a jazmín, pariente del hexil cinamal.',
  },
  {
    id: 'amylcinnamyl_alcohol', compuesto: 'Amylcinnamyl Alcohol', nombre: 'Alcohol Amilcinamílico',
    inci: /\bamylcinnamyl alcohol\b|\balcohol amilcinamilico\b/, keywords: [], riesgo: 'Bajo', frecuente: false,
    explicacion: 'Molécula floral poco frecuente en perfumes actuales.',
  },
  {
    id: 'cinnamyl_alcohol', compuesto: 'Cinnamyl Alcohol', nombre: 'Alcohol Cinamílico',
    inci: /\bcinnamyl alcohol\b|\balcohol cinamilico\b/, keywords: [], riesgo: 'Moderado', frecuente: false,
    explicacion: 'Aroma balsámico de jacinto; la piel puede transformarlo en cinamaldehído.',
  },
  {
    id: 'benzyl_alcohol', compuesto: 'Benzyl Alcohol', nombre: 'Alcohol Bencílico',
    inci: /\bbenzyl alcohol\b|\balcohol bencilico\b/, keywords: [], riesgo: 'Bajo', frecuente: false,
    explicacion: 'Presente en jazmín y bálsamos; también se usa como conservante.',
  },
  {
    id: 'benzyl_benzoate', compuesto: 'Benzyl Benzoate', nombre: 'Benzoato de Bencilo',
    inci: /\bbenzyl benzoate\b|\bbenzoato de bencilo\b/, keywords: [], riesgo: 'Bajo', frecuente: false,
    explicacion: 'Solvente y fijador balsámico. Sensibilizante débil.',
  },
  {
    id: 'benzyl_cinnamate', compuesto: 'Benzyl Cinnamate', nombre: 'Cinamato de Bencilo',
    inci: /\bbenzyl cinnamate\b|\bcinamato de bencilo\b/, keywords: [], riesgo: 'Bajo', frecuente: false,
    explicacion: 'Fijador balsámico presente en el bálsamo de Perú y de Tolú.',
  },
  {
    id: 'anise_alcohol', compuesto: 'Anise Alcohol', nombre: 'Alcohol de Anís',
    inci: /\banis(e|yl) alcohol\b|\balcohol (de )?anis(ico)?\b/, keywords: ['anís', 'anis'], riesgo: 'Bajo', frecuente: false,
    explicacion: 'Aroma dulce y floral de anís y mimosa.',
  },
  {
    id: 'farnesol', compuesto: 'Farnesol', nombre: 'Farnesol', inci: /\bfarnesol\b/, keywords: [], riesgo: 'Moderado', frecuente: false,
    explicacion: 'Alcohol floral presente en tilo, rosa y almizcle; también desodorante.',
  },
  {
    id: 'alpha_isomethyl_ionone', compuesto: 'Alpha-Isomethyl Ionone', nombre: 'Alfa-Isometil Ionona',
    inci: /isomet\w*l ionon/, keywords: [], riesgo: 'Bajo', frecuente: false,
    explicacion: 'Molécula de aroma a violeta e iris, muy usada en perfumes.',
  },
  {
    id: 'methyl_octynoate', compuesto: 'Methyl 2-Octynoate', nombre: 'Octinoato de Metilo',
    inci: /octynoate|octinoato/, keywords: ['violeta'], riesgo: 'Moderado', frecuente: false,
    explicacion: 'Nota verde de hoja de violeta; su uso está limitado por IFRA.',
  },
  {
    id: 'lilial', compuesto: 'Butylphenyl Methylpropional (Lilial)', nombre: 'Lilial',
    inci: /butylphenyl methylpropional|butilfenil metilpropional|\blilial\b/, keywords: [], riesgo: 'Alto', frecuente: false,
    explicacion: 'Prohibido en la Unión Europea desde 2022; aún aparece en stock antiguo o importado.',
  },
  {
    id: 'lyral', compuesto: 'Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde (Lyral)', nombre: 'Lyral',
    inci: /hydroxyisohexyl|hidroxiisohexil|\blyral\b/, keywords: [], riesgo: 'Alto', frecuente: false,
    explicacion: 'Prohibido en la Unión Europea desde 2021 por su alta tasa de alergias.',
  },
  {
    id: 'treemoss', compuesto: 'Evernia Furfuracea', nombre: 'Musgo de Árbol', inci: /evernia furfuracea|musgo de arbol/,
    keywords: [], riesgo: 'Alto', frecuente: false,
    explicacion: 'Liquen como el musgo de roble, restringido por IFRA por su contenido de atranol.',
  },
];

export function sinTildes(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Ids de los alérgenos que nombra un texto (un ingrediente o una lista completa)
export function alergenosEnTexto(texto: string): string[] {
  const t = sinTildes(texto);
  return ALERGENOS_UE.filter((a) => a.inci.test(t)).map((a) => a.id);
}

// Antes eugenol incluía isoeugenol y geraniol incluía citronellol: quien los marcó conserva esos avisos
export function migrarAlergiasGuardadas(ids: string[]): string[] {
  const extra = [...(ids.includes('eugenol') ? ['isoeugenol'] : []), ...(ids.includes('geraniol') ? ['citronellol'] : [])];
  return [...new Set([...ids, ...extra])];
}
