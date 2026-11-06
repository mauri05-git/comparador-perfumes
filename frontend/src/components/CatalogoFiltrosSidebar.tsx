import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Scale,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Heart,
  ExternalLink,
} from 'lucide-react';

export interface FraganciaCatalogoItem {
  id: string;
  nombre: string;
  subtitulo: string;
  marca: string;
  precioReferencia: number;
  ml: number | null; // null: la tienda no indica el tamaño
  concentracion: 'Eau de Parfum (EDP)' | 'Eau de Toilette (EDT)' | 'Parfum / Elixir';
  genero: 'Masculino' | 'Femenino' | 'Unisex';
  familia:
    | 'Cítrico / Acuático'
    | 'Amaderado / Aromático'
    | 'Dulce / Gourmand'
    | 'Ámbar / Especiado'
    | 'Floral / Frutal'
    | 'Fougère / Azul'
    | 'Sin clasificar';
  notas: string[];
  notasDetalle?: string[];
  estaciones: ('Verano' | 'Primavera' | 'Otoño' | 'Invierno')[];
  ocasion: 'Oficina & Diario' | 'Noche & Fiesta' | 'Citas Románticas' | 'Deporte & Calor' | 'Eventos Formales';
  duracionHoras: number;
  proyeccion: 'Moderada' | 'Alta' | 'Bestia';
  alergenosIds: string[];
  imagen: string | null;
  tiendaMejorPrecio?: string | null;
  urlMejorPrecio?: string | null;
  fechaPrecio?: string; // última vez que se verificó el precio en la tienda (AAAA-MM-DD)
  descubiertoEnVivo?: boolean;
  colorFrasco: {
    primario: string;
    secundario: string;
    acento: string;
    forma: 'clasico' | 'cilindro' | 'lingote' | 'esfera' | 'estilizado';
  };
}

export const CATALOGO_FRAGANCIAS_CHILE: FraganciaCatalogoItem[] = [
  {
    id: 'acqua-di-gio',
    nombre: 'Acqua di Giò',
    subtitulo: 'Pour Homme · 100ml · Brisa Marina, Bergamota & Cedro',
    marca: 'Giorgio Armani',
    precioReferencia: 147990,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Cítrico / Acuático',
    notas: ['Bergamota / Limón', 'Notas Marinas', 'Madera (Cedro / Sándalo / Oud)', 'Jazmín / Rosa / Iris'],
    notasDetalle: ['Bergamota de Calabria', 'Notas Marinas', 'Cedro Blanco', 'Jazmín', 'Romero'],
    estaciones: ['Verano', 'Primavera'],
    ocasion: 'Deporte & Calor',
    duracionHoras: 7,
    proyeccion: 'Moderada',
    alergenosIds: ['limonene', 'linalool', 'oakmoss'],
    imagen: 'https://media.falabella.com/falabellaCL/80618221_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/80618221/perfume-hombre-acqua-di-gio-edt-100ml-giorgio-armani',
    colorFrasco: { primario: '#e2e8f0', secundario: '#94a3b8', acento: '#0284c7', forma: 'clasico' },
  },
  {
    id: 'sauvage-dior',
    nombre: 'Sauvage',
    subtitulo: 'Eau de Toilette · 100ml · Bergamota, Pimienta & Ambroxan',
    marca: 'Dior',
    precioReferencia: 81500,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Fougère / Azul',
    notas: [
      'Bergamota / Limón',
      'Ámbar / Ambroxan',
      'Pimienta / Especias',
      'Lavanda / Menta',
      'Madera (Cedro / Sándalo / Oud)',
    ],
    notasDetalle: ['Bergamota Reggio', 'Ambroxan', 'Pimienta de Sichuan', 'Cedro', 'Lavanda'],
    estaciones: ['Otoño', 'Invierno', 'Primavera', 'Verano'],
    ocasion: 'Noche & Fiesta',
    duracionHoras: 10,
    proyeccion: 'Bestia',
    alergenosIds: ['limonene', 'eugenol', 'linalool'],
    imagen: 'https://media.falabella.com/falabellaCL/4712595_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/4712595/Perfume%20Hombre%20Sauvage%20Eau%20de%20toilette',
    colorFrasco: { primario: '#1e293b', secundario: '#0f172a', acento: '#38bdf8', forma: 'cilindro' },
  },
  {
    id: 'bleu-de-chanel',
    nombre: 'Bleu de Chanel',
    subtitulo: 'Eau de Parfum · 100ml · Incienso, Pomelo & Sándalo',
    marca: 'Chanel',
    precioReferencia: 181500,
    ml: 100,
    concentracion: 'Eau de Parfum (EDP)',
    genero: 'Masculino',
    familia: 'Amaderado / Aromático',
    notas: [
      'Madera (Cedro / Sándalo / Oud)',
      'Bergamota / Limón',
      'Tabaco / Cuero / Incienso',
      'Ámbar / Ambroxan',
    ],
    notasDetalle: ['Sándalo de Nueva Caledonia', 'Cedro', 'Incienso', 'Pomelo', 'Jengibre'],
    estaciones: ['Primavera', 'Otoño', 'Invierno', 'Verano'],
    ocasion: 'Eventos Formales',
    duracionHoras: 9,
    proyeccion: 'Alta',
    alergenosIds: ['limonene', 'citral', 'linalool'],
    imagen: 'https://media.falabella.com/falabellaCL/4524081_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/4192038/bleu-de-chanel-eau-de-parfum-vaporizador',
    colorFrasco: { primario: '#0f172a', secundario: '#1e3a8a', acento: '#93c5fd', forma: 'clasico' },
  },
  {
    id: 'good-girl',
    nombre: 'Good Girl',
    subtitulo: 'Eau de Parfum · 30ml · Cacao, Haba Tonka, Café & Sándalo',
    marca: 'Carolina Herrera',
    precioReferencia: 49990,
    ml: 30,
    concentracion: 'Eau de Parfum (EDP)',
    genero: 'Femenino',
    familia: 'Dulce / Gourmand',
    notas: [
      'Chocolate / Cacao',
      'Madera (Cedro / Sándalo / Oud)',
      'Café / Espresso',
      'Vainilla / Haba Tonka',
      'Jazmín / Rosa / Iris',
    ],
    notasDetalle: ['Cacao Tostado', 'Madera de Sándalo', 'Café', 'Haba Tonka', 'Praliné', 'Nardos'],
    estaciones: ['Otoño', 'Invierno'],
    ocasion: 'Citas Románticas',
    duracionHoras: 10,
    proyeccion: 'Alta',
    alergenosIds: ['coumarin', 'linalool', 'cinnamal'],
    imagen: 'https://media.falabella.com/falabellaCL/50068409_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/50068409/perfume-mujer-good-girl-edp-30ml-carolina-herrera',
    colorFrasco: { primario: '#1e1b4b', secundario: '#312e81', acento: '#f59e0b', forma: 'estilizado' },
  },
  {
    id: 'bad-boy-ch',
    nombre: 'Bad Boy',
    subtitulo: 'Eau de Toilette · 100ml · Cacao, Madera de Cedro & Haba Tonka',
    marca: 'Carolina Herrera',
    precioReferencia: 132990,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Ámbar / Especiado',
    notas: [
      'Chocolate / Cacao',
      'Madera (Cedro / Sándalo / Oud)',
      'Vainilla / Haba Tonka',
      'Pimienta / Especias',
      'Bergamota / Limón',
    ],
    notasDetalle: ['Cacao Absoluto', 'Madera de Cedro', 'Haba Tonka', 'Pimienta Negra y Blanca', 'Salvia'],
    estaciones: ['Otoño', 'Invierno', 'Primavera'],
    ocasion: 'Noche & Fiesta',
    duracionHoras: 9,
    proyeccion: 'Alta',
    alergenosIds: ['coumarin', 'eugenol', 'limonene'],
    imagen: 'https://media.falabella.com/falabellaCL/7918775_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/7918775/Perfume-Hombre-Bad-Boy-Edt-100Ml-Carolina-Herrera',
    colorFrasco: { primario: '#0f172a', secundario: '#1e293b', acento: '#fbbf24', forma: 'estilizado' },
  },
  {
    id: 'mugler-amen',
    nombre: 'A*Men (Angel Men)',
    subtitulo: 'Eau de Toilette · 100ml · Chocolate Amargo, Pachulí Amaderado & Café',
    marca: 'Mugler',
    precioReferencia: 57990,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Dulce / Gourmand',
    notas: [
      'Chocolate / Cacao',
      'Madera (Cedro / Sándalo / Oud)',
      'Café / Espresso',
      'Caramelo / Miel',
      'Vainilla / Haba Tonka',
    ],
    notasDetalle: ['Chocolate Oscuro', 'Pachulí Amaderado', 'Café Tostado', 'Caramelo', 'Sándalo', 'Vainilla'],
    estaciones: ['Invierno', 'Otoño'],
    ocasion: 'Noche & Fiesta',
    duracionHoras: 11,
    proyeccion: 'Bestia',
    alergenosIds: ['coumarin', 'oakmoss', 'linalool'],
    imagen: 'https://media.falabella.com/falabellaCL/119271395_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/119271392/Thierry-Mugler-AMEN-EDT-100-ML-Hombre',
    colorFrasco: { primario: '#18181b', secundario: '#09090b', acento: '#38bdf8', forma: 'lingote' },
  },
  {
    id: 'khamrah-qahwa',
    nombre: 'Khamrah Qahwa',
    subtitulo: 'Eau de Parfum · 100ml · Praliné de Cacao, Café, Maderas & Canela',
    marca: 'Lattafa',
    precioReferencia: 36990,
    ml: 100,
    concentracion: 'Eau de Parfum (EDP)',
    genero: 'Unisex',
    familia: 'Dulce / Gourmand',
    notas: [
      'Chocolate / Cacao',
      'Madera (Cedro / Sándalo / Oud)',
      'Café / Espresso',
      'Pimienta / Especias',
      'Vainilla / Haba Tonka',
      'Caramelo / Miel',
    ],
    notasDetalle: ['Praliné de Cacao', 'Granos de Café', 'Maderas Ambaradas', 'Canela', 'Dátiles', 'Vainilla'],
    estaciones: ['Invierno', 'Otoño'],
    ocasion: 'Citas Románticas',
    duracionHoras: 12,
    proyeccion: 'Bestia',
    alergenosIds: ['cinnamal', 'coumarin', 'eugenol'],
    imagen: 'https://media.falabella.com/falabellaCL/129611109_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/129611105/Lattafa-Khamrah-Qahwa-Edp-100ml-Unisex',
    colorFrasco: { primario: '#78350f', secundario: '#451a03', acento: '#fbbf24', forma: 'esfera' },
  },
  {
    id: 'valentino-uomo',
    nombre: 'Valentino Uomo',
    subtitulo: 'Eau de Toilette · 100ml · Chocolate Gianduja, Cedro & Café Tostado',
    marca: 'Valentino',
    precioReferencia: 144990,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Amaderado / Aromático',
    notas: [
      'Chocolate / Cacao',
      'Madera (Cedro / Sándalo / Oud)',
      'Café / Espresso',
      'Tabaco / Cuero / Incienso',
    ],
    notasDetalle: ['Chocolate y Avellana', 'Madera de Cedro', 'Café Tostado', 'Cuero Suave', 'Bergamota'],
    estaciones: ['Otoño', 'Invierno'],
    ocasion: 'Citas Románticas',
    duracionHoras: 8,
    proyeccion: 'Alta',
    alergenosIds: ['coumarin', 'limonene'],
    imagen: 'https://media.falabella.com/falabellaCL/15109051_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/15109051/Perfume-Hombre-Uomo-EDT-100-ml-Valentino',
    colorFrasco: { primario: '#451a03', secundario: '#1c1917', acento: '#d97706', forma: 'esfera' },
  },
  {
    id: 'black-orchid-tf',
    nombre: 'Black Orchid',
    subtitulo: 'Eau de Parfum · 100ml · Chocolate Mexicano, Sándalo, Pachulí & Trufa',
    marca: 'Tom Ford',
    precioReferencia: 270490,
    ml: 100,
    concentracion: 'Eau de Parfum (EDP)',
    genero: 'Unisex',
    familia: 'Ámbar / Especiado',
    notas: [
      'Chocolate / Cacao',
      'Madera (Cedro / Sándalo / Oud)',
      'Tabaco / Cuero / Incienso',
      'Pimienta / Especias',
      'Vainilla / Haba Tonka',
    ],
    notasDetalle: ['Chocolate Mexicano', 'Sándalo', 'Pachulí', 'Vetiver', 'Incienso', 'Orquídea Negra'],
    estaciones: ['Invierno', 'Otoño'],
    ocasion: 'Eventos Formales',
    duracionHoras: 12,
    proyeccion: 'Bestia',
    alergenosIds: ['cinnamal', 'eugenol', 'oakmoss', 'coumarin'],
    imagen: 'https://media.falabella.com/falabellaCL/151577998_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/151577997/tom-ford-black-orchid-edp-100ml-mujer',
    colorFrasco: { primario: '#18181b', secundario: '#09090b', acento: '#f59e0b', forma: 'cilindro' },
  },
  {
    id: 'versace-eros',
    nombre: 'Versace Eros',
    subtitulo: 'Eau de Toilette · 100ml · Menta, Manzana Verde, Cedro & Vainilla',
    marca: 'Versace',
    precioReferencia: 89990,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Fougère / Azul',
    notas: [
      'Vainilla / Haba Tonka',
      'Lavanda / Menta',
      'Madera (Cedro / Sándalo / Oud)',
      'Frutal / Coco / Manzana',
    ],
    notasDetalle: ['Vainilla de Madagascar', 'Menta Fresca', 'Manzana Verde', 'Cedro del Atlas', 'Vetiver'],
    estaciones: ['Otoño', 'Invierno', 'Primavera'],
    ocasion: 'Noche & Fiesta',
    duracionHoras: 9,
    proyeccion: 'Bestia',
    alergenosIds: ['coumarin', 'limonene', 'oakmoss'],
    imagen: 'https://media.falabella.com/falabellaCL/155713189_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/155713188/perfume-versace-eros-pour-homme-edt-100ml',
    colorFrasco: { primario: '#0284c7', secundario: '#0369a1', acento: '#fbbf24', forma: 'clasico' },
  },
  {
    id: 'nautica-voyage',
    nombre: 'Nautica Voyage',
    subtitulo: 'Eau de Toilette · 100ml · Manzana Verde, Loto Acuático & Cedro',
    marca: 'Nautica',
    precioReferencia: 27990,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Cítrico / Acuático',
    notas: ['Notas Marinas', 'Frutal / Coco / Manzana', 'Madera (Cedro / Sándalo / Oud)'],
    notasDetalle: ['Manzana Verde', 'Hojas Verdes', 'Flor de Loto', 'Cedro', 'Almizcle'],
    estaciones: ['Verano', 'Primavera'],
    ocasion: 'Deporte & Calor',
    duracionHoras: 6,
    proyeccion: 'Moderada',
    alergenosIds: ['oakmoss'],
    imagen: 'https://media.falabella.com/falabellaCL/116201726_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/116201724/Nautica-Voyage-Nautica-EDT-100-ml',
    colorFrasco: { primario: '#38bdf8', secundario: '#0284c7', acento: '#e0f2fe', forma: 'esfera' },
  },
  {
    id: 'one-million',
    nombre: '1 Million',
    subtitulo: 'Eau de Toilette · 200ml · Canela, Cuero, Maderas Blancas & Ámbar',
    marca: 'Rabanne',
    precioReferencia: 99990,
    ml: 200,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Ámbar / Especiado',
    notas: [
      'Pimienta / Especias',
      'Tabaco / Cuero / Incienso',
      'Madera (Cedro / Sándalo / Oud)',
      'Ámbar / Ambroxan',
    ],
    notasDetalle: ['Canela', 'Cuero', 'Maderas Blancas', 'Pachulí Hindú', 'Ámbar', 'Mandarina Roja'],
    estaciones: ['Otoño', 'Invierno'],
    ocasion: 'Noche & Fiesta',
    duracionHoras: 10,
    proyeccion: 'Bestia',
    alergenosIds: ['cinnamal', 'coumarin', 'limonene'],
    imagen: 'https://media.falabella.com/falabellaCL/2284924_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/6229474/Perfume-Hombre-One-Million-Edt-200Ml-Rabanne',
    colorFrasco: { primario: '#f59e0b', secundario: '#b45309', acento: '#fef3c7', forma: 'lingote' },
  },
  {
    id: 'dylan-blue',
    nombre: 'Pour Homme Dylan Blue',
    subtitulo: 'Eau de Toilette · 100ml · Ambroxan, Pomelo, Incienso & Pachulí',
    marca: 'Versace',
    precioReferencia: 89990,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Fougère / Azul',
    notas: [
      'Ámbar / Ambroxan',
      'Bergamota / Limón',
      'Notas Marinas',
      'Tabaco / Cuero / Incienso',
      'Pimienta / Especias',
    ],
    notasDetalle: ['Ambroxan', 'Bergamota', 'Notas Acuáticas', 'Incienso', 'Pimienta Negra'],
    estaciones: ['Primavera', 'Verano', 'Otoño'],
    ocasion: 'Oficina & Diario',
    duracionHoras: 8,
    proyeccion: 'Alta',
    alergenosIds: ['limonene', 'eugenol'],
    imagen: 'https://media.falabella.com/falabellaCL/155717411_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/155717410/perfume-versace-pour-homme-dylan-blue-edt-100ml',
    colorFrasco: { primario: '#1d4ed8', secundario: '#1e3a8a', acento: '#fbbf24', forma: 'clasico' },
  },
  {
    id: 'la-vie-est-belle',
    nombre: 'La Vie Est Belle',
    subtitulo: 'Eau de Parfum · 75ml · Praliné Achocolatado, Iris, Vainilla & Pachulí',
    marca: 'Lancôme',
    precioReferencia: 143990,
    ml: 75,
    concentracion: 'Eau de Parfum (EDP)',
    genero: 'Femenino',
    familia: 'Dulce / Gourmand',
    notas: [
      'Chocolate / Cacao',
      'Vainilla / Haba Tonka',
      'Caramelo / Miel',
      'Jazmín / Rosa / Iris',
    ],
    notasDetalle: ['Praliné Dulce', 'Vainilla', 'Iris Pallida', 'Haba Tonka', 'Pera'],
    estaciones: ['Otoño', 'Invierno', 'Primavera'],
    ocasion: 'Citas Románticas',
    duracionHoras: 10,
    proyeccion: 'Bestia',
    alergenosIds: ['coumarin', 'linalool', 'geraniol'],
    imagen: 'https://media.falabella.com/falabellaCL/80045789_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/3466713/perfume-mujer-lancome-la-vie-est-belle-eau-de-parfum-edicion-75ml',
    colorFrasco: { primario: '#f472b6', secundario: '#db2777', acento: '#fce7f3', forma: 'esfera' },
  },
  {
    id: 'light-blue-dg',
    nombre: 'Light Blue',
    subtitulo: 'Eau de Toilette · 100ml · Limón Siciliano, Manzana & Cedro',
    marca: 'Dolce & Gabbana',
    precioReferencia: 66490,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Unisex',
    familia: 'Cítrico / Acuático',
    notas: [
      'Bergamota / Limón',
      'Madera (Cedro / Sándalo / Oud)',
      'Frutal / Coco / Manzana',
    ],
    notasDetalle: ['Limón Siciliano', 'Manzana Granny Smith', 'Madera de Cedro', 'Bambú'],
    estaciones: ['Verano', 'Primavera'],
    ocasion: 'Deporte & Calor',
    duracionHoras: 6,
    proyeccion: 'Moderada',
    alergenosIds: ['limonene', 'citral'],
    imagen: 'https://media.falabella.com/falabellaCL/148251705_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/148251704/Perfume-Edt-Mujer-Dolce-Gabbana-Light-Blue-New-100ml',
    colorFrasco: { primario: '#7dd3fc', secundario: '#0284c7', acento: '#f0f9ff', forma: 'cilindro' },
  },
  {
    id: 'ck-one',
    nombre: 'CK One',
    subtitulo: 'Eau de Toilette · 200ml · Té Verde, Bergamota, Cedro & Almizcle',
    marca: 'Calvin Klein',
    precioReferencia: 39990,
    ml: 200,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Unisex',
    familia: 'Cítrico / Acuático',
    notas: [
      'Bergamota / Limón',
      'Madera (Cedro / Sándalo / Oud)',
      'Jazmín / Rosa / Iris',
    ],
    notasDetalle: ['Limón', 'Té Verde', 'Bergamota', 'Cedro', 'Sándalo'],
    estaciones: ['Verano', 'Primavera'],
    ocasion: 'Oficina & Diario',
    duracionHoras: 5,
    proyeccion: 'Moderada',
    alergenosIds: ['limonene', 'linalool', 'oakmoss'],
    imagen: 'https://media.falabella.com/falabellaCL/50403020_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/50403020/Perfume-Unisex-Ck-One-Eau-de-Toilette-200-ML',
    colorFrasco: { primario: '#cbd5e1', secundario: '#64748b', acento: '#f8fafc', forma: 'cilindro' },
  },
  {
    id: 'le-male-jpg',
    nombre: 'Le Male',
    subtitulo: 'Eau de Toilette · 125ml · Lavanda, Menta, Vainilla, Sándalo & Cedro',
    marca: 'Jean Paul Gaultier',
    precioReferencia: 136990,
    ml: 125,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Ámbar / Especiado',
    notas: [
      'Lavanda / Menta',
      'Vainilla / Haba Tonka',
      'Madera (Cedro / Sándalo / Oud)',
      'Pimienta / Especias',
    ],
    notasDetalle: ['Lavanda', 'Menta', 'Vainilla', 'Sándalo', 'Cedro', 'Canela'],
    estaciones: ['Otoño', 'Invierno'],
    ocasion: 'Citas Románticas',
    duracionHoras: 9,
    proyeccion: 'Alta',
    alergenosIds: ['coumarin', 'linalool', 'cinnamal'],
    imagen: 'https://media.falabella.com/falabellaCL/283075_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/283075/Perfume-Hombre-Jean-Paul-Gaultier-Le-Male-Edt-125Ml-Jean-Paul-Gaultier',
    colorFrasco: { primario: '#0ea5e9', secundario: '#0369a1', acento: '#e0f2fe', forma: 'estilizado' },
  },
  {
    id: 'le-beau-le-parfum',
    nombre: 'Le Beau Le Parfum',
    subtitulo: 'Eau de Parfum · 125ml · Madera de Coco, Sándalo, Piña & Tonka',
    marca: 'Jean Paul Gaultier',
    precioReferencia: 154990,
    ml: 125,
    concentracion: 'Eau de Parfum (EDP)',
    genero: 'Masculino',
    familia: 'Amaderado / Aromático',
    notas: [
      'Madera (Cedro / Sándalo / Oud)',
      'Frutal / Coco / Manzana',
      'Vainilla / Haba Tonka',
      'Ámbar / Ambroxan',
    ],
    notasDetalle: ['Madera de Sándalo', 'Madera de Coco', 'Haba Tonka', 'Piña', 'Ciprés'],
    estaciones: ['Verano', 'Primavera', 'Otoño'],
    ocasion: 'Citas Románticas',
    duracionHoras: 10,
    proyeccion: 'Alta',
    alergenosIds: ['coumarin', 'limonene'],
    imagen: 'https://media.falabella.com/falabellaCL/50044698_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/50044698/Perfume-Hombre-Le-Beau-Le-Parfum-Edp-125Ml-Jean-Paul-Gaultier',
    colorFrasco: { primario: '#065f46', secundario: '#064e3b', acento: '#fbbf24', forma: 'estilizado' },
  },
  {
    id: 'terre-dhermes',
    nombre: "Terre d'Hermès",
    subtitulo: 'Eau de Toilette · 100ml · Cedro del Atlas, Vetiver Amaderado & Naranja',
    marca: 'Hermès',
    precioReferencia: 151990,
    ml: 100,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Amaderado / Aromático',
    notas: [
      'Madera (Cedro / Sándalo / Oud)',
      'Bergamota / Limón',
      'Pimienta / Especias',
    ],
    notasDetalle: ['Cedro del Atlas', 'Vetiver', 'Naranja Amarga', 'Pomelo', 'Pimienta'],
    estaciones: ['Otoño', 'Primavera'],
    ocasion: 'Oficina & Diario',
    duracionHoras: 9,
    proyeccion: 'Alta',
    alergenosIds: ['limonene', 'oakmoss', 'eugenol'],
    imagen: 'https://media.falabella.com/falabellaCL/16198632_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: "https://www.falabella.com/falabella-cl/product/16198632/Perfume-Hombre-Terre-d'Hermes-Eau-de-Toilette-100-ml-Hermes",
    colorFrasco: { primario: '#d97706', secundario: '#92400e', acento: '#fef3c7', forma: 'clasico' },
  },
  {
    id: 'club-de-nuit-intense',
    nombre: 'Club de Nuit Intense Man',
    subtitulo: 'Eau de Toilette · 105ml · Limón Ahumado, Madera de Abedul & Almizcle',
    marca: 'Armaf',
    precioReferencia: 59990,
    ml: 105,
    concentracion: 'Eau de Toilette (EDT)',
    genero: 'Masculino',
    familia: 'Amaderado / Aromático',
    notas: [
      'Madera (Cedro / Sándalo / Oud)',
      'Bergamota / Limón',
      'Tabaco / Cuero / Incienso',
      'Ámbar / Ambroxan',
    ],
    notasDetalle: ['Madera de Abedul Ahumada', 'Limón', 'Piña', 'Pachulí', 'Almizcle'],
    estaciones: ['Primavera', 'Otoño', 'Verano'],
    ocasion: 'Eventos Formales',
    duracionHoras: 9,
    proyeccion: 'Bestia',
    alergenosIds: ['limonene', 'citral'],
    imagen: 'https://media.falabella.com/falabellaCL/122356253_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/122356251/CLUB-DE-NUIT-INTENSE-MEN-EDT-105-ML-ARMAF',
    colorFrasco: { primario: '#18181b', secundario: '#27272a', acento: '#eab308', forma: 'clasico' },
  },
  {
    id: 'spicebomb-extreme',
    nombre: 'Spicebomb Extreme',
    subtitulo: 'Eau de Parfum · 90ml · Tabaco, Vainilla Negra, Canela & Maderas',
    marca: 'Viktor&Rolf',
    precioReferencia: 159990,
    ml: 90,
    concentracion: 'Eau de Parfum (EDP)',
    genero: 'Masculino',
    familia: 'Ámbar / Especiado',
    notas: [
      'Tabaco / Cuero / Incienso',
      'Madera (Cedro / Sándalo / Oud)',
      'Vainilla / Haba Tonka',
      'Pimienta / Especias',
    ],
    notasDetalle: ['Tabaco', 'Vainilla Negra', 'Pimienta Negra', 'Canela', 'Maderas Ámbar'],
    estaciones: ['Invierno', 'Otoño'],
    ocasion: 'Noche & Fiesta',
    duracionHoras: 11,
    proyeccion: 'Bestia',
    alergenosIds: ['cinnamal', 'coumarin', 'eugenol'],
    imagen: 'https://media.falabella.com/falabellaCL/119815696_01/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/119815695/PERFUME-SPICEBOMB-VARON-EDT-90-ML',
    colorFrasco: { primario: '#27272a', secundario: '#09090b', acento: '#d97706', forma: 'esfera' },
  },
  {
    id: 'sauvage-elixir',
    nombre: 'Sauvage Elixir',
    subtitulo: 'Parfum Concentré · 60ml · Sándalo, Canela, Nuez Moscada & Lavanda',
    marca: 'Dior',
    precioReferencia: 219300,
    ml: 60,
    concentracion: 'Parfum / Elixir',
    genero: 'Masculino',
    familia: 'Ámbar / Especiado',
    notas: [
      'Madera (Cedro / Sándalo / Oud)',
      'Pimienta / Especias',
      'Lavanda / Menta',
    ],
    notasDetalle: ['Sándalo de Haití', 'Canela', 'Nuez Moscada', 'Cardamomo', 'Lavanda'],
    estaciones: ['Invierno', 'Otoño'],
    ocasion: 'Eventos Formales',
    duracionHoras: 12,
    proyeccion: 'Bestia',
    alergenosIds: ['cinnamal', 'eugenol', 'linalool', 'coumarin'],
    imagen: 'https://media.falabella.com/falabellaCL/50190731_1/public',
    tiendaMejorPrecio: 'Falabella',
    urlMejorPrecio: 'https://www.falabella.com/falabella-cl/product/50190731/Perfume%20Hombre%20Sauvage%20Elixir%20-%20Notas%20c%C3%ADtricas,%20especiadas%20y%20amaderadas',
    colorFrasco: { primario: '#0f172a', secundario: '#1e1b4b', acento: '#a5b4fc', forma: 'cilindro' },
  },
];

const RANGOS_PRECIO = [
  { id: 'econ', label: 'Económico (< $45.000)', min: 0, max: 44999 },
  { id: 'medio', label: 'Gama Media ($45.000 - $89.990)', min: 45000, max: 89999 },
  { id: 'lujo', label: 'Diseñador ($90.000 - $130.000)', min: 90000, max: 130000 },
  { id: 'alta', label: 'Alta Gama (> $130.000)', min: 130001, max: Infinity },
];

// Ilustración SVG de frasco de perfumería de autor cuando no hay foto local
function IlustracionFrascoLujo({ item }: { item: FraganciaCatalogoItem }) {
  const { primario, secundario, acento } = item.colorFrasco || {
    primario: '#312e81',
    secundario: '#1e1b4b',
    acento: '#f59e0b',
    forma: 'clasico',
  };
  const gradId = `bottle-grad-${item.id}`;

  return (
    <svg width="110" height="145" viewBox="0 0 110 145" role="img" aria-label={item.nombre}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primario} />
          <stop offset="100%" stopColor={secundario} />
        </linearGradient>
      </defs>
      <ellipse cx="55" cy="136" rx="34" ry="5" fill="rgba(15,23,42,0.12)" />
      <rect x="43" y="10" width="24" height="16" rx="3" fill={acento} stroke={secundario} strokeWidth="1.2" />
      <rect x="48" y="26" width="14" height="7" fill="#94a3b8" />
      <rect
        x="23"
        y="33"
        width="64"
        height="96"
        rx={item.colorFrasco?.forma === 'esfera' ? '26' : item.colorFrasco?.forma === 'lingote' ? '4' : '12'}
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.5"
      />
      <rect x="29" y="40" width="6" height="80" rx="3" fill="rgba(255,255,255,0.22)" />
      <rect x="31" y="60" width="48" height="38" rx="4" fill="rgba(255,255,255,0.92)" stroke={acento} strokeWidth="1" />
      <text
        x="55"
        y="75"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="800"
        fill="#0f172a"
        letterSpacing="0.08em"
      >
        {(item.marca || 'PARFUM').slice(0, 14).toUpperCase()}
      </text>
      <text
        x="55"
        y="86"
        textAnchor="middle"
        fontSize="7.5"
        fontFamily="Georgia, serif"
        fontWeight="700"
        fill="#334155"
      >
        {item.nombre.slice(0, 12)}
      </text>
      <text x="55" y="94" textAnchor="middle" fontSize="5.5" fill="#64748b">
        {item.ml ? `${item.ml} ML` : ''}
      </text>
    </svg>
  );
}

interface SeccionAcordeonProps {
  titulo: string;
  abiertoInicial?: boolean;
  children: React.ReactNode;
}

function SeccionAcordeonFiltro({ titulo, abiertoInicial = true, children }: SeccionAcordeonProps) {
  const [abierto, setAbierto] = useState(abiertoInicial);

  return (
    <div className="m3-facet-section">
      <button
        type="button"
        className="m3-facet-header"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
      >
        <span>{titulo}</span>
        {abierto ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {abierto && <div className="m3-facet-body">{children}</div>}
    </div>
  );
}

// v2: la v1 guardaba perfumes sin precio de tienda (con $79.990 inventado); se descarta
const CLAVE_CATALOGO_APRENDIDO_LOCAL = 'perfumescan_catalogo_aprendido_v2';
try {
  localStorage.removeItem('perfumescan_catalogo_aprendido_v1');
} catch {}

const DICCIONARIO_MARCAS_FRONTEND: Array<{ marca: string; keywords: string[] }> = [
  { marca: 'Carolina Herrera', keywords: ['carolina herrera', 'good girl', 'bad boy', '212 vip', '212 men', '212 heroes', '212 sexy', 'ch men'] },
  { marca: 'Giorgio Armani', keywords: ['giorgio armani', 'armani', 'acqua di gio', 'acqua di giò', 'stronger with you', 'my way', 'armani code', 'si passioni'] },
  { marca: 'Jean Paul Gaultier', keywords: ['jean paul gaultier', 'gaultier', 'le male', 'le beau', 'scandal', 'la belle', 'divine'] },
  { marca: 'Dolce & Gabbana', keywords: ['dolce & gabbana', 'dolce gabbana', 'd&g', 'light blue', 'the one', 'devotion', 'pour homme intenso'] },
  { marca: 'Yves Saint Laurent', keywords: ['yves saint laurent', 'saint laurent', 'ysl', 'black opium', 'libre', 'myslf', 'kouros', "la nuit de l'homme"] },
  { marca: 'Rabanne', keywords: ['paco rabanne', 'rabanne', '1 million', 'one million', 'invictus', 'phantom', 'fame', 'olympea', 'black xs'] },
  { marca: 'Dior', keywords: ['christian dior', 'dior', 'sauvage', 'dior homme', 'miss dior', "j'adore", 'fahrenheit', 'poison'] },
  { marca: 'Chanel', keywords: ['chanel', 'bleu de chanel', 'coco mademoiselle', 'allure homme', 'chance'] },
  { marca: 'Versace', keywords: ['versace', 'eros', 'dylan blue', 'bright crystal', 'crystal noir'] },
  { marca: 'Tom Ford', keywords: ['tom ford', 'black orchid', 'ombre leather', 'tobacco vanille', 'oud wood', 'lost cherry'] },
  { marca: 'Valentino', keywords: ['valentino', 'born in roma', 'valentino uomo', 'voce viva'] },
  { marca: 'Lattafa', keywords: ['lattafa', 'khamrah', 'asad', 'yara', 'badee al oud', 'fakhar', 'qaed'] },
  { marca: 'Armaf', keywords: ['armaf', 'club de nuit', 'odyssey'] },
  { marca: 'Afnan', keywords: ['afnan', '9pm', 'supremacy', 'turathi'] },
  { marca: 'Rasasi', keywords: ['rasasi', 'hawas'] },
  { marca: 'Al Haramain', keywords: ['al haramain', 'amber oud', 'detour noir'] },
  { marca: 'Mugler', keywords: ['thierry mugler', 'mugler', 'a*men', 'angel', 'alien'] },
  { marca: 'Lancôme', keywords: ['lancôme', 'lancome', 'la vie est belle', 'idole', 'tresor'] },
  { marca: 'Calvin Klein', keywords: ['calvin klein', 'ck one', 'eternity', 'euphoria'] },
  { marca: 'Nautica', keywords: ['nautica', 'voyage'] },
  { marca: 'Hermès', keywords: ['hermès', 'hermes', "terre d'hermes", "terre d'hermès", 'h24', 'twilly'] },
  { marca: 'Viktor&Rolf', keywords: ['viktor&rolf', 'viktor & rolf', 'spicebomb', 'flowerbomb'] },
  { marca: 'Lacoste', keywords: ['lacoste', 'l.12.12'] },
  { marca: 'Trussardi', keywords: ['trussardi', 'my name'] },
  { marca: 'Billie Eilish', keywords: ['billie eilish', 'eilish'] },
  { marca: 'Hugo Boss', keywords: ['hugo boss', 'boss bottled', 'boss the scent', 'hugo man'] },
  { marca: 'Montblanc', keywords: ['montblanc', 'mont blanc', 'explorer', 'legend', 'individuel'] },
  { marca: 'Givenchy', keywords: ['givenchy', 'gentleman', 'irresistible', "l'interdit"] },
  { marca: 'Prada', keywords: ['prada', 'paradoxe', 'luna rossa', "l'homme"] },
  { marca: 'Burberry', keywords: ['burberry', 'burberry hero', 'burberry her', 'goddess'] },
  { marca: 'Gucci', keywords: ['gucci', 'gucci guilty', 'gucci bloom', 'gucci flora'] },
  { marca: 'Azzaro', keywords: ['azzaro', 'the most wanted', 'wanted', 'chrome'] },
  { marca: 'Ralph Lauren', keywords: ['ralph lauren', 'polo blue', 'polo black', 'polo red', 'polo green'] },
  { marca: 'Creed', keywords: ['creed', 'aventus', 'silver mountain', 'green irish'] },
  { marca: 'Parfums de Marly', keywords: ['parfums de marly', 'layton', 'althair', 'delina', 'pegasus'] },
  { marca: 'Loewe', keywords: ['loewe', 'solo loewe', '7 loewe', 'esencia'] },
  { marca: 'Kenzo', keywords: ['kenzo', 'flower by kenzo', 'kenzo homme'] },
  { marca: 'Moschino', keywords: ['moschino', 'toy boy', 'toy 2'] },
  { marca: 'Bvlgari', keywords: ['bvlgari', 'bulgari', 'man in black', 'omnia', 'aqva'] },
  { marca: 'Guerlain', keywords: ['guerlain', "l'homme ideal", 'shalimar', 'mon guerlain'] },
  { marca: 'Issey Miyake', keywords: ['issey miyake', "l'eau d'issey"] },
  { marca: 'Narciso Rodriguez', keywords: ['narciso rodriguez', 'for her'] },
  { marca: 'Antonio Banderas', keywords: ['antonio banderas', 'the icon', 'blue seduction', 'king of seduction'] },
  { marca: 'Halloween', keywords: ['halloween'] },
  { marca: 'Tous', keywords: ['tous'] },
  { marca: 'Natura', keywords: ['natura', 'kaiak', 'essencial', 'homem'] },
  { marca: 'Benetton', keywords: ['benetton', 'united dreams'] },
  { marca: 'Tommy Hilfiger', keywords: ['tommy hilfiger', 'tommy girl', 'impact'] },
  { marca: 'Coach', keywords: ['coach'] },
  { marca: 'Jimmy Choo', keywords: ['jimmy choo'] },
  { marca: 'Ferragamo', keywords: ['salvatore ferragamo', 'ferragamo'] },
];

const PALABRAS_GENERICAS_FRONTEND = new Set([
  'perfume', 'fragancia', 'colonia', 'hombre', 'mujer', 'unisex', 'para', 'de', 'del', 'la', 'el',
  'eau', 'parfum', 'toilette', 'edp', 'edt', 'edc', 'parfums', 'maison', 'diseñador', 'set', 'spray',
  'ml', '100ml', '50ml', '200ml', '125ml', '90ml', '80ml', '75ml', '60ml',
]);

function capitalizarTexto(txt: string): string {
  return txt
    .trim()
    .split(/\s+/)
    .map(w => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export function detectarMarcaDesdeBusqueda(query: string, precios: any[] = [], fichaMarca?: string): string {
  const titulos = (precios || []).slice(0, 3).map(p => p?.nombre || '').join(' ');
  const combinado = `${fichaMarca || ''} ${query || ''} ${titulos}`.toLowerCase();

  for (const item of DICCIONARIO_MARCAS_FRONTEND) {
    if (item.keywords.some(kw => combinado.includes(kw))) {
      return item.marca;
    }
  }

  if (fichaMarca && fichaMarca.trim().length >= 2) {
    const fl = fichaMarca.trim().toLowerCase();
    if (!PALABRAS_GENERICAS_FRONTEND.has(fl) && fl !== 'maison parfums') {
      return capitalizarTexto(fichaMarca);
    }
  }

  const tokens = `${query} ${precios?.[0]?.nombre || ''}`
    .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ&\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !PALABRAS_GENERICAS_FRONTEND.has(t.toLowerCase()));

  return tokens.length > 0 ? capitalizarTexto(tokens[0]) : 'Diseñador';
}

// Fusiona catálogos por marca + nombre; ante el mismo perfume gana la versión nueva (datos más recientes)
export function fusionarCatalogos(previos: FraganciaCatalogoItem[], nuevos: FraganciaCatalogoItem[]): FraganciaCatalogoItem[] {
  const mapa = new Map<string, FraganciaCatalogoItem>();
  for (const item of [...previos, ...nuevos]) {
    if (item && item.nombre) {
      mapa.set(`${(item.marca || '').toLowerCase()}-${item.nombre.toLowerCase()}`, item);
    }
  }
  return Array.from(mapa.values());
}

// Tamaño en ml escrito en un nombre o URL de producto (ej: "Edt 40 Ml", "...-75-ml-..."); null si no aparece
export function mlDesdeTexto(texto: string): number | null {
  const m = (texto || '').match(/\b(\d{1,3})\s*ml\b/i);
  const ml = m ? parseInt(m[1], 10) : NaN;
  return ml >= 5 && ml <= 500 ? ml : null;
}

// Traduce notas en texto libre (de la IA o de la tienda) a las etiquetas del catálogo
export function etiquetasDeNotas(texto: string): string[] {
  const t = texto.toLowerCase();
  const tiene = (...kws: string[]) => kws.some(k => t.includes(k));
  const etiquetas: string[] = [];
  if (tiene('chocolate', 'cacao', 'pralin', 'avellana')) etiquetas.push('Chocolate / Cacao');
  if (tiene('madera', 'cedro', 'sándalo', 'sandalo', 'oud', 'vetiver', 'pachul')) etiquetas.push('Madera (Cedro / Sándalo / Oud)');
  if (tiene('café', 'cafe', 'espresso')) etiquetas.push('Café / Espresso');
  if (tiene('vainilla', 'tonka', 'almendra')) etiquetas.push('Vainilla / Haba Tonka');
  if (tiene('tabaco', 'cuero', 'incienso')) etiquetas.push('Tabaco / Cuero / Incienso');
  if (tiene('caramelo', 'miel', 'dátil')) etiquetas.push('Caramelo / Miel');
  if (tiene('bergamota', 'limón', 'limon', 'pomelo', 'naranja')) etiquetas.push('Bergamota / Limón');
  if (tiene('marin', 'acuát', 'acuat')) etiquetas.push('Notas Marinas');
  if (tiene('pimienta', 'canela', 'cardamomo', 'especia')) etiquetas.push('Pimienta / Especias');
  if (tiene('lavanda', 'menta')) etiquetas.push('Lavanda / Menta');
  if (tiene('ámbar', 'ambar', 'ambroxan', 'almizcle')) etiquetas.push('Ámbar / Ambroxan');
  if (tiene('rosa', 'jazmín', 'jazmin', 'iris', 'azahar')) etiquetas.push('Jazmín / Rosa / Iris');
  if (tiene('coco', 'piña', 'manzana', 'pera', 'cereza')) etiquetas.push('Frutal / Coco / Manzana');
  return etiquetas;
}

// Traduce una familia olfativa en texto libre (ej: "Aromática Fougère Especiada") a una familia del catálogo
export function familiaCatalogoDesde(familiaTexto: string): FraganciaCatalogoItem['familia'] {
  const f = familiaTexto.toLowerCase();
  if (!f) return 'Sin clasificar';
  if (f.includes('acuát') || f.includes('cítric')) return 'Cítrico / Acuático';
  if (f.includes('gourmand') || f.includes('dulce') || f.includes('vainilla')) return 'Dulce / Gourmand';
  if (f.includes('foug') || f.includes('azul')) return 'Fougère / Azul';
  if (f.includes('especiad') || f.includes('ámbar') || f.includes('oriental')) return 'Ámbar / Especiado';
  if (f.includes('floral') || f.includes('frutal')) return 'Floral / Frutal';
  return 'Amaderado / Aromático';
}

export function aprenderPerfumeEnCatalogoLocal(query: string, precios: any[] = [], ficha: any = null): FraganciaCatalogoItem | null {
  try {
    const validos = (precios || []).filter(p => typeof p?.precio === 'number' && p.precio > 0);
    // Sin precio de una tienda real no se aprende (evita perfumes inexistentes o con precio inventado)
    if (validos.length === 0) return null;

    validos.sort((a, b) => a.precio - b.precio);
    const mejor = validos[0];
    const marca = detectarMarcaDesdeBusqueda(query, validos, ficha?.marca);

    let nombreLimpio = (ficha?.nombre || mejor?.nombre || query)
      .replace(/\b(perfume|para|hombre|mujer|unisex|eau de parfum|eau de toilette|edp|edt|spray|\d+\s*ml)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const regexMarca = new RegExp(`^${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
    nombreLimpio = nombreLimpio.replace(regexMarca, '').trim();
    const nombreFinal = capitalizarTexto(nombreLimpio || query);

    const todasNotasRaw: string[] = [
      ...(ficha?.notas_salida || []),
      ...(ficha?.notas_corazon || []),
      ...(ficha?.notas_fondo || []),
    ];
    const textoNotas = `${todasNotasRaw.join(' ')} ${(ficha?.acordes_principales || []).join(' ')} ${ficha?.familia_olfativa || ''} ${nombreFinal}`.toLowerCase();

    const notasEstandar = etiquetasDeNotas(textoNotas);
    const familia = familiaCatalogoDesde(ficha?.familia_olfativa || '');

    const concRaw = (ficha?.concentracion || mejor?.nombre || query).toLowerCase();
    const concentracion: FraganciaCatalogoItem['concentracion'] = concRaw.includes('elixir')
      ? 'Parfum / Elixir'
      : concRaw.includes('toilette') || concRaw.includes('edt')
      ? 'Eau de Toilette (EDT)'
      : 'Eau de Parfum (EDP)';

    const genRaw = (ficha?.genero || mejor?.nombre || query).toLowerCase();
    const genero: FraganciaCatalogoItem['genero'] = genRaw.includes('femenin') || genRaw.includes('mujer') || genRaw.includes('femme')
      ? 'Femenino'
      : genRaw.includes('masculin') || genRaw.includes('hombre') || genRaw.includes('homme')
      ? 'Masculino'
      : 'Unisex';

    const nuevoItem: FraganciaCatalogoItem = {
      id: `local-${marca.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${nombreFinal.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      nombre: nombreFinal,
      subtitulo: `${concentracion.split(' ')[0]} · ${todasNotasRaw.slice(0, 3).join(', ') || ficha?.familia_olfativa || 'Registrado en búsqueda'}`,
      marca,
      precioReferencia: mejor.precio,
      ml: mlDesdeTexto(mejor.nombre) ?? mlDesdeTexto((mejor.url || '').replace(/[-_]/g, ' ')),
      concentracion,
      genero,
      familia,
      notas: notasEstandar,
      notasDetalle: todasNotasRaw.slice(0, 5),
      estaciones: ['Otoño', 'Primavera'],
      ocasion: 'Oficina & Diario',
      duracionHoras: ficha?.duracion_horas || 8,
      proyeccion: ficha?.proyeccion === 'Bestia' ? 'Bestia' : ficha?.proyeccion === 'Alta' ? 'Alta' : 'Moderada',
      alergenosIds: (ficha?.alergenos_detectados || []).map((a: any) => a.id),
      imagen: mejor?.imagen || null,
      tiendaMejorPrecio: mejor?.tienda || undefined,
      urlMejorPrecio: mejor?.url || undefined,
      descubiertoEnVivo: true,
      colorFrasco: { primario: '#312e81', secundario: '#1e1b4b', acento: '#f59e0b', forma: 'clasico' },
    };

    const guardadosRaw = localStorage.getItem(CLAVE_CATALOGO_APRENDIDO_LOCAL);
    const guardados: FraganciaCatalogoItem[] = guardadosRaw ? JSON.parse(guardadosRaw) : [];
    const sinDuplicado = guardados.filter(
      g => g.id !== nuevoItem.id && g.nombre.toLowerCase() !== nuevoItem.nombre.toLowerCase()
    );
    const actualizados = [nuevoItem, ...sinDuplicado].slice(0, 120);
    localStorage.setItem(CLAVE_CATALOGO_APRENDIDO_LOCAL, JSON.stringify(actualizados));
    return nuevoItem;
  } catch {
    return null;
  }
}

const MARCAS_INICIALES_SET = new Set(CATALOGO_FRAGANCIAS_CHILE.map(p => p.marca.toLowerCase()));

interface Props {
  apiBase?: string;
  alergiasUsuario: string[];
  notasPersonalizadas: string[];
  listaGuardadosNombres: string[];
  onCotizarEnVivo: (nombre: string) => void;
  onInspeccionarPerfume?: (item: FraganciaCatalogoItem, catalogoCompleto: FraganciaCatalogoItem[]) => void;
  onGuardarEnLista: (item: FraganciaCatalogoItem) => void;
  onComparar: (nombre: string) => void;
  onCatalogoActualizado?: (catalogo: FraganciaCatalogoItem[]) => void;
}

const ITEMS_POR_PAGINA = 30;

export const CatalogoFiltrosSidebar: React.FC<Props> = ({
  apiBase = 'http://localhost:8000',
  alergiasUsuario,
  notasPersonalizadas,
  listaGuardadosNombres,
  onCotizarEnVivo,
  onInspeccionarPerfume,
  onGuardarEnLista,
  onComparar,
  onCatalogoActualizado,
}) => {
  const refInicioCatalogo = useRef<HTMLElement | null>(null);
  const [paginaActual, setPaginaActual] = useState<number>(1);
  // Catálogo dinámico (Perfumes aprendidos en localStorage + Perfumes auto-descubiertos en el servidor)
  const [itemsDinamicos, setItemsDinamicos] = useState<FraganciaCatalogoItem[]>(() => {
    try {
      const raw = localStorage.getItem(CLAVE_CATALOGO_APRENDIDO_LOCAL);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [descubriendoEnVivo, setDescubriendoEnVivo] = useState(false);
  const [mensajeDescubrimiento, setMensajeDescubrimiento] = useState<string | null>(null);

  // Estados de los Checkboxes de Filtros
  const [notasSel, setNotasSel] = useState<string[]>([]);
  const [modoNotas, setModoNotas] = useState<'AND' | 'OR'>('AND');
  const [notaLibreInput, setNotaLibreInput] = useState<string>('');
  const [familiasSel, setFamiliasSel] = useState<string[]>([]);
  const [rangosPrecioSel, setRangosPrecioSel] = useState<string[]>([]);
  const [marcasSel, setMarcasSel] = useState<string[]>([]);
  const [generosSel, setGenerosSel] = useState<string[]>([]);
  const [concentracionSel, setConcentracionSel] = useState<string[]>([]);
  const [ocasionesSel, setOcasionesSel] = useState<string[]>([]);
  const [soloSinAlergenos, setSoloSinAlergenos] = useState<boolean>(false);
  const [filtroTextoRapido, setFiltroTextoRapido] = useState<string>('');
  const [orden, setOrden] = useState<'destacados' | 'precio_asc' | 'precio_desc' | 'duracion' | 'ml_eficiencia'>('destacados');

  const [mostrarTodasMarcas, setMostrarTodasMarcas] = useState(false);
  const [mostrarTodasNotas, setMostrarTodasNotas] = useState(true);
  const [sidebarMovilAbierto, setSidebarMovilAbierto] = useState(false);

  // Cargar catálogo masivo pre-indexado (estilo Knasta) + perfumes auto-aprendidos en servidor/localStorage
  useEffect(() => {
    const fusionarItems = (nuevos: FraganciaCatalogoItem[]) => {
      if (!Array.isArray(nuevos) || nuevos.length === 0) return;
      setItemsDinamicos(prev => {
        const combinados = fusionarCatalogos(prev, nuevos);
        try {
          localStorage.setItem(CLAVE_CATALOGO_APRENDIDO_LOCAL, JSON.stringify(combinados));
        } catch {}
        return combinados;
      });
    };

    // 1. Snapshot indexado (/catalogo_knasta.json) y 2. después el backend, que tiene los precios más recientes
    // y por eso se aplica último (encadenado para que no dependa de cuál respuesta llega primero)
    const cargarDelBackend = () =>
      fetch(`${apiBase}/api/catalogo`)
        .then(r => r.json())
        .then(data => {
          if (data.success && Array.isArray(data.items)) {
            fusionarItems(data.items);
          }
        })
        .catch(() => {});

    fetch('/catalogo_knasta.json')
      .then(r => (r.ok ? r.json() : []))
      .then(items => {
        if (Array.isArray(items)) fusionarItems(items);
      })
      .catch(() => {})
      .then(cargarDelBackend);

    // Al terminar el refresco diario se vuelven a pedir los precios (lo avisa el indicador de la barra superior)
    window.addEventListener('catalogo-actualizado', cargarDelBackend);
    return () => window.removeEventListener('catalogo-actualizado', cargarDelBackend);
  }, [apiBase]);

  // Ejecutar crawler masivo de categorías en las 4 tiendas (Estilo Knasta)
  const sincronizarCatalogoKnasta = async () => {
    setDescubriendoEnVivo(true);
    setMensajeDescubrimiento('Indexando catálogos completos de Falabella, DBS, Alisha y Ahumada (Modo Knasta)...');
    try {
      const resp = await fetch(`${apiBase}/api/indexar-knasta`, { method: 'POST' });
      const data = await resp.json();
      if (data.success && Array.isArray(data.items)) {
        setItemsDinamicos(prev => {
          const combinados = fusionarCatalogos(prev, data.items);
          try {
            localStorage.setItem(CLAVE_CATALOGO_APRENDIDO_LOCAL, JSON.stringify(combinados));
          } catch {}
          return combinados;
        });
        setMensajeDescubrimiento(data.mensaje || '¡Catálogo masivo sincronizado con éxito!');
      }
    } catch {
      // Si el backend no fue reiniciado aún, recargar desde el snapshot /catalogo_knasta.json
      try {
        const r = await fetch('/catalogo_knasta.json');
        const items = await r.json();
        if (Array.isArray(items)) {
          setMensajeDescubrimiento(`Catálogo sincronizado: ${items.length} perfumes y múltiples marcas cargadas.`);
        }
      } catch {}
    } finally {
      setDescubriendoEnVivo(false);
      setTimeout(() => setMensajeDescubrimiento(null), 5000);
    }
  };

  // Combinar catálogo base + descubiertos dinámicamente sin duplicar
  const catalogoCompleto = useMemo(() => {
    const mapa = new Map<string, FraganciaCatalogoItem>();
    for (const item of CATALOGO_FRAGANCIAS_CHILE) {
      mapa.set(item.nombre.toLowerCase(), item);
    }
    for (const dyn of itemsDinamicos) {
      const k = dyn.nombre.toLowerCase();
      if (!mapa.has(k)) {
        mapa.set(k, dyn);
      } else if (dyn.precioReferencia && dyn.urlMejorPrecio) {
        // La oferta (precio, tienda, URL, ml e imagen) se toma completa de una sola fuente:
        // mezclar el precio de una tienda con la URL de otra mostraba datos que no coincidían
        const existente = mapa.get(k)!;
        mapa.set(k, {
          ...existente,
          precioReferencia: dyn.precioReferencia,
          tiendaMejorPrecio: dyn.tiendaMejorPrecio,
          urlMejorPrecio: dyn.urlMejorPrecio,
          ml: dyn.ml,
          imagen: dyn.imagen || existente.imagen,
        });
      }
    }
    return Array.from(mapa.values());
  }, [itemsDinamicos]);

  useEffect(() => {
    onCatalogoActualizado?.(catalogoCompleto);
  }, [catalogoCompleto, onCatalogoActualizado]);

  const toggleValor =(setLista: React.Dispatch<React.SetStateAction<string[]>>, valor: string) => {
    setLista(prev => (prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]));
  };

  // Descubrir más perfumes reales con IA + Scraper de las 4 tiendas según los filtros marcados
  const descubrirMasEnTiendasConIA = async () => {
    setDescubriendoEnVivo(true);
    setMensajeDescubrimiento('Consultando al Sommelier IA y cotizando en Falabella, DBS, Alisha y Ahumada...');
    try {
      const resp = await fetch(`${apiBase}/api/descubrir-por-filtros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notas: notasSel,
          modoNotas,
          notaPersonalizada: notaLibreInput.trim(),
          familias: familiasSel,
          marcas: marcasSel,
          generos: generosSel,
        }),
      });
      const data = await resp.json();
      if (data.success && Array.isArray(data.items)) {
        setItemsDinamicos(prev => {
          const mapa = new Map<string, FraganciaCatalogoItem>();
          for (const p of [...data.items, ...prev]) {
            mapa.set(p.nombre.toLowerCase(), p);
          }
          return Array.from(mapa.values());
        });
        setMensajeDescubrimiento(data.mensaje || `¡Nuevas fragancias añadidas al catálogo!`);
      } else {
        setMensajeDescubrimiento('No se encontraron fragancias adicionales.');
      }
    } catch {
      setMensajeDescubrimiento('El servidor local no respondió; filtrando sobre el catálogo integrado.');
    } finally {
      setDescubriendoEnVivo(false);
      setTimeout(() => setMensajeDescubrimiento(null), 5000);
    }
  };

  const chocaConAlergia = (item: FraganciaCatalogoItem): boolean => {
    if (alergiasUsuario.some(id => (item.alergenosIds || []).includes(id))) return true;
    if (notasPersonalizadas.length > 0) {
      const txt = `${item.nombre} ${item.subtitulo} ${(item.notas || []).join(' ')} ${(item.notasDetalle || []).join(' ')}`.toLowerCase();
      if (notasPersonalizadas.some(n => txt.includes(n.toLowerCase()))) return true;
    }
    return false;
  };

  // Listas de opciones únicas con su conteo "(N)"
  const conteoPorNota = useMemo(() => {
    const mapa = new Map<string, number>();
    catalogoCompleto.forEach(p => {
      (p.notas || []).forEach(n => mapa.set(n, (mapa.get(n) || 0) + 1));
    });
    // Poner Chocolate y Madera arriba para acceso inmediato
    const prioridad = [
      'Chocolate / Cacao',
      'Madera (Cedro / Sándalo / Oud)',
      'Café / Espresso',
      'Vainilla / Haba Tonka',
      'Tabaco / Cuero / Incienso',
      'Caramelo / Miel',
    ];
    return Array.from(mapa.entries()).sort((a, b) => {
      const ia = prioridad.indexOf(a[0]);
      const ib = prioridad.indexOf(b[0]);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return b[1] - a[1];
    });
  }, [catalogoCompleto]);

  const conteoPorFamilia = useMemo(() => {
    const mapa = new Map<string, number>();
    catalogoCompleto.forEach(p => mapa.set(p.familia, (mapa.get(p.familia) || 0) + 1));
    return Array.from(mapa.entries());
  }, [catalogoCompleto]);

  const conteoPorMarca = useMemo(() => {
    const mapa = new Map<string, number>();
    catalogoCompleto.forEach(p => mapa.set(p.marca, (mapa.get(p.marca) || 0) + 1));
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [catalogoCompleto]);

  const conteoPorGenero = useMemo(() => {
    const mapa = new Map<string, number>();
    catalogoCompleto.forEach(p => mapa.set(p.genero, (mapa.get(p.genero) || 0) + 1));
    return Array.from(mapa.entries());
  }, [catalogoCompleto]);

  const conteoPorConcentracion = useMemo(() => {
    const mapa = new Map<string, number>();
    catalogoCompleto.forEach(p => mapa.set(p.concentracion, (mapa.get(p.concentracion) || 0) + 1));
    return Array.from(mapa.entries());
  }, [catalogoCompleto]);

  const conteoPorOcasion = useMemo(() => {
    const mapa = new Map<string, number>();
    catalogoCompleto.forEach(p => mapa.set(p.ocasion, (mapa.get(p.ocasion) || 0) + 1));
    return Array.from(mapa.entries());
  }, [catalogoCompleto]);

  // Filtrado combinado con soporte para Notas en modo AND ("Ambas/Todas") u OR ("Cualquiera")
  const fraganciasFiltradas = useMemo(() => {
    const filtradas = catalogoCompleto.filter(item => {
      const textoCompletoItem = `${item.nombre} ${item.marca} ${item.subtitulo} ${(item.notas || []).join(' ')} ${(item.notasDetalle || []).join(' ')}`.toLowerCase();

      if (filtroTextoRapido.trim()) {
        const q = filtroTextoRapido.toLowerCase();
        if (!textoCompletoItem.includes(q)) return false;
      }

      if (notaLibreInput.trim()) {
        const terminosLibres = notaLibreInput
          .toLowerCase()
          .split(/[,+]+/)
          .map(s => s.trim())
          .filter(Boolean);
        const cumpleLibre =
          modoNotas === 'AND'
            ? terminosLibres.every(t => textoCompletoItem.includes(t))
            : terminosLibres.some(t => textoCompletoItem.includes(t));
        if (!cumpleLibre) return false;
      }

      if (soloSinAlergenos && chocaConAlergia(item)) return false;
      if (familiasSel.length > 0 && !familiasSel.includes(item.familia)) return false;
      if (marcasSel.length > 0 && !marcasSel.includes(item.marca)) return false;
      if (generosSel.length > 0 && !generosSel.includes(item.genero)) return false;
      if (concentracionSel.length > 0 && !concentracionSel.includes(item.concentracion)) return false;
      if (ocasionesSel.length > 0 && !ocasionesSel.includes(item.ocasion)) return false;

      if (notasSel.length > 0) {
        if (modoNotas === 'AND') {
          // Debe tener TODAS las notas seleccionadas (ej: Chocolate Y Madera a la vez)
          const tieneTodas = notasSel.every(n => (item.notas || []).includes(n));
          if (!tieneTodas) return false;
        } else {
          // Debe tener AL MENOS UNA de las notas seleccionadas (ej: Chocolate O Madera)
          const tieneAlguna = notasSel.some(n => (item.notas || []).includes(n));
          if (!tieneAlguna) return false;
        }
      }

      if (rangosPrecioSel.length > 0) {
        const caeEnRango = rangosPrecioSel.some(rId => {
          const r = RANGOS_PRECIO.find(x => x.id === rId);
          return r ? item.precioReferencia >= r.min && item.precioReferencia <= r.max : false;
        });
        if (!caeEnRango) return false;
      }

      return true;
    });

    return [...filtradas].sort((a, b) => {
      if (orden === 'precio_asc') return a.precioReferencia - b.precioReferencia;
      if (orden === 'precio_desc') return b.precioReferencia - a.precioReferencia;
      if (orden === 'duracion') return b.duracionHoras - a.duracionHoras;
      if (orden === 'ml_eficiencia') {
        // Sin tamaño conocido no hay precio por ml: van al final
        const pa = a.ml ? a.precioReferencia / a.ml : Infinity;
        const pb = b.ml ? b.precioReferencia / b.ml : Infinity;
        return pa - pb;
      }
      return 0;
    });
  }, [
    catalogoCompleto,
    filtroTextoRapido,
    notaLibreInput,
    soloSinAlergenos,
    familiasSel,
    marcasSel,
    generosSel,
    concentracionSel,
    ocasionesSel,
    notasSel,
    modoNotas,
    rangosPrecioSel,
    orden,
    alergiasUsuario,
    notasPersonalizadas,
  ]);

  const totalFiltrosActivos =
    familiasSel.length +
    rangosPrecioSel.length +
    marcasSel.length +
    notasSel.length +
    generosSel.length +
    concentracionSel.length +
    ocasionesSel.length +
    (soloSinAlergenos ? 1 : 0) +
    (filtroTextoRapido.trim() ? 1 : 0) +
    (notaLibreInput.trim() ? 1 : 0);

  const limpiarTodosLosFiltros = () => {
    setFamiliasSel([]);
    setRangosPrecioSel([]);
    setMarcasSel([]);
    setNotasSel([]);
    setGenerosSel([]);
    setConcentracionSel([]);
    setOcasionesSel([]);
    setSoloSinAlergenos(false);
    setFiltroTextoRapido('');
    setNotaLibreInput('');
    setPaginaActual(1);
  };

  // Reiniciar a la página 1 cuando cambian los filtros o el ordenamiento
  useEffect(() => {
    setPaginaActual(1);
  }, [
    familiasSel,
    rangosPrecioSel,
    marcasSel,
    notasSel,
    modoNotas,
    generosSel,
    concentracionSel,
    ocasionesSel,
    soloSinAlergenos,
    filtroTextoRapido,
    notaLibreInput,
    orden,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(fraganciasFiltradas.length / ITEMS_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceInicio = (paginaSegura - 1) * ITEMS_POR_PAGINA;
  const fraganciasPaginadas = fraganciasFiltradas.slice(indiceInicio, indiceInicio + ITEMS_POR_PAGINA);

  const irAPagina = (nuevaPag: number) => {
    const p = Math.max(1, Math.min(totalPaginas, nuevaPag));
    setPaginaActual(p);
    refInicioCatalogo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const abrirInspectorPerfume = (item: FraganciaCatalogoItem) => {
    if (onInspeccionarPerfume) {
      onInspeccionarPerfume(item, catalogoCompleto);
    } else {
      onCotizarEnVivo(`${item.marca} ${item.nombre}`);
    }
  };

  const marcasVisibles = mostrarTodasMarcas ? conteoPorMarca : conteoPorMarca.slice(0, 7);
  const notasVisibles = mostrarTodasNotas ? conteoPorNota : conteoPorNota.slice(0, 6);

  return (
    <section ref={refInicioCatalogo} className="m3-catalog-explorer-wrap" aria-label="Explorador de Fragancias por Notas y Filtros">
      {/* Cabecera limpia del Catálogo */}
      <div className="m3-catalog-topbar">
        <div>
          <h3 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.3rem', color: 'var(--m3-text-primary)', fontWeight: 800 }}>
            Catálogo de Fragancias ({fraganciasFiltradas.length})
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)', fontWeight: 600 }}>
            {fraganciasFiltradas.length > 0
              ? `Mostrando ${indiceInicio + 1}–${Math.min(indiceInicio + ITEMS_POR_PAGINA, fraganciasFiltradas.length)} de ${fraganciasFiltradas.length} · Página ${paginaSegura} de ${totalPaginas}`
              : 'Sin coincidencias con los filtros actuales'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="m3-btn m3-btn-tonal m3-mobile-filter-toggle"
            onClick={() => setSidebarMovilAbierto(!sidebarMovilAbierto)}
          >
            <SlidersHorizontal size={14} /> Filtros {totalFiltrosActivos > 0 ? `(${totalFiltrosActivos})` : ''}
          </button>

          {totalFiltrosActivos > 0 && (
            <button
              type="button"
              onClick={limpiarTodosLosFiltros}
              className="m3-btn m3-btn-tonal"
              style={{ fontSize: '12px', padding: '7px 12px', color: '#dc2626' }}
            >
              <RotateCcw size={13} /> Limpiar ({totalFiltrosActivos})
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="select-orden-catalogo" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--m3-text-secondary)' }}>
              Ordenar:
            </label>
            <select
              id="select-orden-catalogo"
              value={orden}
              onChange={e => setOrden(e.target.value as any)}
              style={{
                padding: '7px 12px',
                borderRadius: '10px',
                border: '1px solid var(--m3-outline-variant)',
                background: 'var(--m3-surface-container-lowest)',
                color: 'var(--m3-text-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="destacados">Más Cotizados en Chile</option>
              <option value="precio_asc">Precio: Menor a Mayor</option>
              <option value="precio_desc">Precio: Mayor a Menor</option>
              <option value="duracion">Mayor Fijación (Horas)</option>
              <option value="ml_eficiencia">Mejor Eficiencia ($/ml)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mensaje de estado cuando el motor IA + Scraper descubre nuevas fragancias */}
      {mensajeDescubrimiento && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--m3-primary-container)',
            color: 'var(--m3-primary)',
            fontSize: '12.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={15} /> {mensajeDescubrimiento}
        </div>
      )}

      {/* Layout Principal 2 Columnas: Sidebar Izquierdo (Checkboxes) + Grilla Derecha */}
      <div className="m3-catalog-layout">
        {/* COLUMNA IZQUIERDA: SIDEBAR DE FILTROS CON CHECKBOXES Y CONTEOS */}
        <aside className={`m3-facet-sidebar ${sidebarMovilAbierto ? 'open-mobile' : ''}`}>
          {/* Filtro Especial: Seguridad Dermatológica IFRA */}
          <div style={{ paddingBottom: '10px', marginBottom: '4px', borderBottom: '1px solid var(--m3-outline-variant)' }}>
            <label className="m3-facet-checkbox-row" style={{ fontWeight: 700, color: 'var(--m3-primary)' }}>
              <input
                type="checkbox"
                className="m3-facet-checkbox"
                checked={soloSinAlergenos}
                onChange={e => setSoloSinAlergenos(e.target.checked)}
              />
              <span className="m3-facet-label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <ShieldCheck size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                Solo compatibles con mi piel
              </span>
            </label>
          </div>

          {/* 1. NOTAS OLFATIVAS (Chocolate, Madera, Café, Vainilla... con selector Y / O) */}
          <SeccionAcordeonFiltro titulo="Notas y Aromas (Ej: Chocolate + Madera)" abiertoInicial={true}>
            {/* Selector de combinación: Que tenga TODAS las notas (Y) vs Cualquiera (O) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px',
                background: 'var(--m3-surface-container)',
                padding: '3px',
                borderRadius: '8px',
                marginBottom: '6px',
              }}
            >
              <button
                type="button"
                onClick={() => setModoNotas('AND')}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 6px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: modoNotas === 'AND' ? 'var(--m3-primary)' : 'transparent',
                  color: modoNotas === 'AND' ? '#ffffff' : 'var(--m3-text-secondary)',
                }}
                title="Muestra perfumes que contengan TODAS las notas marcadas al mismo tiempo (ej: Chocolate Y Madera)"
              >
                Combinar todas (Y)
              </button>
              <button
                type="button"
                onClick={() => setModoNotas('OR')}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 6px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: modoNotas === 'OR' ? 'var(--m3-primary)' : 'transparent',
                  color: modoNotas === 'OR' ? '#ffffff' : 'var(--m3-text-secondary)',
                }}
                title="Muestra perfumes que tengan cualquiera de las notas marcadas (ej: Chocolate O Madera)"
              >
                Cualquiera (O)
              </button>
            </div>

            {notasVisibles.map(([nota, count]) => (
              <label key={nota} className="m3-facet-checkbox-row">
                <input
                  type="checkbox"
                  className="m3-facet-checkbox"
                  checked={notasSel.includes(nota)}
                  onChange={() => toggleValor(setNotasSel, nota)}
                />
                <span className="m3-facet-label-text">
                  {nota} <span className="m3-facet-count">({count})</span>
                </span>
              </label>
            ))}

            {conteoPorNota.length > 6 && (
              <button
                type="button"
                className="m3-facet-show-more"
                onClick={() => setMostrarTodasNotas(!mostrarTodasNotas)}
              >
                {mostrarTodasNotas ? '- Mostrar menos' : `+ Mostrar más (${conteoPorNota.length - 6})`}
              </button>
            )}

            {/* Buscador de nota libre (ej: pistacho, cereza, avellana, ron...) + Botón directo de Descubrimiento */}
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                placeholder="Otra nota (ej: cacao, cedro, miel...)"
                value={notaLibreInput}
                onChange={e => setNotaLibreInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && descubrirMasEnTiendasConIA()}
                style={{
                  width: '100%',
                  padding: '6px 9px',
                  fontSize: '11.5px',
                  borderRadius: '7px',
                  border: '1px solid var(--m3-outline-variant)',
                  background: 'var(--m3-surface-container-low)',
                  color: 'var(--m3-text-primary)',
                }}
              />
              <button
                type="button"
                onClick={descubrirMasEnTiendasConIA}
                disabled={descubriendoEnVivo}
                className="m3-btn m3-btn-primary"
                style={{ width: '100%', padding: '7px 10px', fontSize: '11.5px', justifyContent: 'center' }}
              >
                <Sparkles size={13} />
                {descubriendoEnVivo ? 'Buscando en tiendas...' : '+ Descubrir más con estos filtros'}
              </button>
            </div>
          </SeccionAcordeonFiltro>

          {/* 2. Categoría / Familia Olfativa */}
          <SeccionAcordeonFiltro titulo="Familia Olfativa" abiertoInicial={true}>
            {conteoPorFamilia.map(([familia, count]) => (
              <label key={familia} className="m3-facet-checkbox-row">
                <input
                  type="checkbox"
                  className="m3-facet-checkbox"
                  checked={familiasSel.includes(familia)}
                  onChange={() => toggleValor(setFamiliasSel, familia)}
                />
                <span className="m3-facet-label-text">
                  {familia} <span className="m3-facet-count">({count})</span>
                </span>
              </label>
            ))}
          </SeccionAcordeonFiltro>

          {/* 3. Precio */}
          <SeccionAcordeonFiltro titulo="Precio" abiertoInicial={true}>
            {RANGOS_PRECIO.map(r => {
              const count = catalogoCompleto.filter(
                p => p.precioReferencia >= r.min && p.precioReferencia <= r.max
              ).length;
              return (
                <label key={r.id} className="m3-facet-checkbox-row">
                  <input
                    type="checkbox"
                    className="m3-facet-checkbox"
                    checked={rangosPrecioSel.includes(r.id)}
                    onChange={() => toggleValor(setRangosPrecioSel, r.id)}
                  />
                  <span className="m3-facet-label-text">
                    {r.label} <span className="m3-facet-count">({count})</span>
                  </span>
                </label>
              );
            })}
          </SeccionAcordeonFiltro>

          {/* 4. Casa Perfumista / Marca (auto-aprende nuevas marcas buscadas o registradas) */}
          <SeccionAcordeonFiltro titulo={`Casa Perfumista / Marca (${conteoPorMarca.length})`} abiertoInicial={true}>
            {marcasVisibles.map(([marca, count]) => {
              const esMarcaAprendida = !MARCAS_INICIALES_SET.has(marca.toLowerCase());
              return (
                <label key={marca} className="m3-facet-checkbox-row">
                  <input
                    type="checkbox"
                    className="m3-facet-checkbox"
                    checked={marcasSel.includes(marca)}
                    onChange={() => toggleValor(setMarcasSel, marca)}
                  />
                  <span className="m3-facet-label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    {marca} <span className="m3-facet-count">({count})</span>
                    {esMarcaAprendida && (
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '1px 5px',
                          borderRadius: '6px',
                          background: 'var(--m3-primary-container)',
                          color: 'var(--m3-primary)',
                          fontWeight: 800,
                        }}
                        title="Marca aprendida automáticamente a partir de búsquedas registradas"
                      >
                        Aprendida
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
            {conteoPorMarca.length > 7 && (
              <button
                type="button"
                className="m3-facet-show-more"
                onClick={() => setMostrarTodasMarcas(!mostrarTodasMarcas)}
              >
                {mostrarTodasMarcas ? '- Mostrar menos' : `+ Mostrar más (${conteoPorMarca.length - 7})`}
              </button>
            )}
            <button
              type="button"
              onClick={sincronizarCatalogoKnasta}
              disabled={descubriendoEnVivo}
              className="m3-btn m3-btn-tonal"
              style={{ width: '100%', marginTop: '6px', padding: '6px 8px', fontSize: '11px', justifyContent: 'center' }}
              title="Recorre las páginas de categoría de Falabella, DBS, Alisha y Ahumada para indexar decenas de marcas y perfumes"
            >
              {descubriendoEnVivo ? 'Indexando tiendas...' : '↻ Sincronizar tiendas (Modo Knasta)'}
            </button>
          </SeccionAcordeonFiltro>

          {/* 5. Concentración */}
          <SeccionAcordeonFiltro titulo="Concentración" abiertoInicial={false}>
            {conteoPorConcentracion.map(([conc, count]) => (
              <label key={conc} className="m3-facet-checkbox-row">
                <input
                  type="checkbox"
                  className="m3-facet-checkbox"
                  checked={concentracionSel.includes(conc)}
                  onChange={() => toggleValor(setConcentracionSel, conc)}
                />
                <span className="m3-facet-label-text">
                  {conc} <span className="m3-facet-count">({count})</span>
                </span>
              </label>
            ))}
          </SeccionAcordeonFiltro>

          {/* 6. Género */}
          <SeccionAcordeonFiltro titulo="Género" abiertoInicial={false}>
            {conteoPorGenero.map(([gen, count]) => (
              <label key={gen} className="m3-facet-checkbox-row">
                <input
                  type="checkbox"
                  className="m3-facet-checkbox"
                  checked={generosSel.includes(gen)}
                  onChange={() => toggleValor(setGenerosSel, gen)}
                />
                <span className="m3-facet-label-text">
                  {gen} <span className="m3-facet-count">({count})</span>
                </span>
              </label>
            ))}
          </SeccionAcordeonFiltro>

          {/* 7. Ocasión Ideal */}
          <SeccionAcordeonFiltro titulo="Ocasión de Uso" abiertoInicial={false}>
            {conteoPorOcasion.map(([oc, count]) => (
              <label key={oc} className="m3-facet-checkbox-row">
                <input
                  type="checkbox"
                  className="m3-facet-checkbox"
                  checked={ocasionesSel.includes(oc)}
                  onChange={() => toggleValor(setOcasionesSel, oc)}
                />
                <span className="m3-facet-label-text">
                  {oc} <span className="m3-facet-count">({count})</span>
                </span>
              </label>
            ))}
          </SeccionAcordeonFiltro>
        </aside>

        {/* COLUMNA DERECHA: GRILLA DE TARJETAS ESTILO VITRINA E-COMMERCE */}
        <div className="m3-catalog-grid-area">
          {/* Píldoras de filtros activos para ver claramente qué combinación se está aplicando */}
          {notasSel.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', padding: '10px 14px', background: 'var(--m3-surface-container-low)', borderRadius: '10px', border: '1px solid var(--m3-outline-variant)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '12px' }}>
                <strong style={{ color: 'var(--m3-text-primary)' }}>
                  Buscando fragancias con ({modoNotas === 'AND' ? 'TODAS estas notas' : 'cualquiera de estas notas'}):
                </strong>
                {notasSel.map((n, idx) => (
                  <React.Fragment key={n}>
                    {idx > 0 && (
                      <span style={{ fontWeight: 800, color: 'var(--m3-primary)' }}>
                        {modoNotas === 'AND' ? '+' : 'o'}
                      </span>
                    )}
                    <span style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', padding: '2px 9px', borderRadius: '99px', fontWeight: 700 }}>
                      {n}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {fraganciasFiltradas.length === 0 ? (
            <div
              style={{
                background: 'var(--m3-surface-container-lowest)',
                border: '1px solid var(--m3-outline-variant)',
                borderRadius: 'var(--m3-shape-lg)',
                padding: '42px 24px',
                textAlign: 'center',
              }}
            >
              <p className="m3-editorial-title" style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--m3-text-primary)' }}>
                No hay fragancias locales con esa combinación exacta todavía
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--m3-text-secondary)' }}>
                Pulsa el botón para que nuestro Sommelier IA busque en el mercado chileno perfumes que tengan exactamente esas notas y los agregue al catálogo:
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={descubrirMasEnTiendasConIA}
                  disabled={descubriendoEnVivo}
                  className="m3-btn m3-btn-primary"
                >
                  <Sparkles size={14} />
                  {descubriendoEnVivo ? 'Buscando en tiendas e IA...' : 'Descubrir perfumes con estos filtros (IA + Tiendas)'}
                </button>
                <button type="button" onClick={limpiarTodosLosFiltros} className="m3-btn m3-btn-tonal">
                  <RotateCcw size={14} /> Restablecer filtros
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="m3-showcase-grid">
                {fraganciasPaginadas.map(item => {
                  const tieneConflictoAlergia = chocaConAlergia(item);
                  const yaEnLista = listaGuardadosNombres.some(
                    n => n.toLowerCase() === item.nombre.toLowerCase()
                  );
                  const abrevConc = item.concentracion.includes('Elixir')
                    ? 'Parfum'
                    : item.concentracion.includes('Toilette')
                    ? 'EDT'
                    : 'EDP';

                  const tiendaLabel = item.tiendaMejorPrecio
                    ? item.tiendaMejorPrecio.replace(' Beauty Store', '').replace(' Perfumes', '').replace('Farmacias ', '')
                    : 'Falabella';
                  const colorPuntoTienda =
                    tiendaLabel.includes('Falabella')
                      ? '#84cc16'
                      : tiendaLabel.includes('DBS')
                      ? '#ec4899'
                      : tiendaLabel.includes('Alisha')
                      ? '#a855f7'
                      : '#0ea5e9';

                  return (
                    <article
                      key={item.id}
                      className="m3-showcase-card knasta-card"
                      onClick={() => abrirInspectorPerfume(item)}
                      style={{
                        cursor: 'pointer',
                        borderColor: tieneConflictoAlergia ? 'rgba(239, 68, 68, 0.5)' : undefined,
                      }}
                    >
                      {/* Vitrina Blanca Superior Estilo Knasta */}
                      <div
                        className="m3-showcase-img-box knasta-img-stage"
                        title={`Ver ficha, historial de precios y radar de ${item.nombre}`}
                      >
                        {/* Píldora Superior Izquierda: Tienda */}
                        <span className="knasta-store-pill">
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: colorPuntoTienda,
                              display: 'inline-block',
                            }}
                          />
                          {tiendaLabel}
                        </span>

                        {/* Botón Superior Derecho: Corazón / Favorito */}
                        <button
                          type="button"
                          className={`knasta-heart-btn ${yaEnLista ? 'active' : ''}`}
                          onClick={e => {
                            e.stopPropagation();
                            onGuardarEnLista(item);
                          }}
                          title={yaEnLista ? 'En tu lista de seguimiento' : 'Guardar en mi lista de seguimiento'}
                        >
                          <Heart size={15} fill={yaEnLista ? '#ef4444' : 'none'} color={yaEnLista ? '#ef4444' : '#334155'} />
                        </button>

                        {/* Imagen del Perfume */}
                        {item.imagen ? (
                          <img
                            src={item.imagen}
                            alt={item.nombre}
                            className="m3-showcase-img"
                            loading="lazy"
                          />
                        ) : (
                          <IlustracionFrascoLujo item={item} />
                        )}

                        {/* Píldora Inferior Izquierda: Su mejor precio o Alerta Alergia */}
                        {tieneConflictoAlergia ? (
                          <span className="knasta-best-price-pill danger">
                            <ShieldAlert size={11} /> Contiene alérgeno
                          </span>
                        ) : (
                          <span className="knasta-best-price-pill">
                            ✓ {abrevConc}{item.ml ? ` ${item.ml}ml` : ''}
                          </span>
                        )}
                      </div>

                      {/* Cuerpo Inferior Estilo Knasta */}
                      <div className="m3-showcase-body knasta-card-body">
                        <div>
                          {/* Fila Marca */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span className="knasta-brand-text">{item.marca}</span>
                          </div>

                          {/* Título del Perfume */}
                          <h4 className="knasta-product-title">{item.nombre}</h4>
                        </div>

                        <div>
                          {/* Precio publicado en la tienda */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <span className="knasta-main-price">
                              $ {item.precioReferencia.toLocaleString('es-CL')}
                            </span>
                          </div>

                          {/* Fuente del dato */}
                          <div className="knasta-old-price" style={{ textDecoration: 'none' }}>
                            Precio publicado en {item.tiendaMejorPrecio || 'Falabella'}
                            {item.fechaPrecio ? ` · al ${item.fechaPrecio.split('-').reverse().join('/')}` : ''}
                          </div>

                          {/* Botones de Acción Estilo Knasta */}
                          <div style={{ display: 'flex', gap: '7px', marginTop: '10px' }}>
                            <button
                              type="button"
                              className="knasta-cta-green"
                              onClick={e => {
                                e.stopPropagation();
                                abrirInspectorPerfume(item);
                              }}
                            >
                              Ver Ficha y Oferta <ExternalLink size={13} />
                            </button>
                            <button
                              type="button"
                              className="knasta-secondary-icon-btn"
                              onClick={e => {
                                e.stopPropagation();
                                onComparar(`${item.marca} ${item.nombre}`);
                              }}
                              title="Comparar frente a otro perfume (VS)"
                            >
                              <Scale size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Barra de Paginación (de 30 en 30: Página 1 de N) */}
              {totalPaginas > 1 && (
                <nav
                  aria-label="Paginación del catálogo"
                  style={{
                    marginTop: '24px',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    background: 'var(--m3-surface-container-lowest)',
                    border: '1px solid var(--m3-outline-variant)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--m3-text-secondary)' }}>
                    Página <strong>{paginaSegura}</strong> de <strong>{totalPaginas}</strong> · Mostrando {indiceInicio + 1}–{Math.min(indiceInicio + ITEMS_POR_PAGINA, fraganciasFiltradas.length)} de {fraganciasFiltradas.length} perfumes
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="m3-btn m3-btn-tonal"
                      disabled={paginaSegura <= 1}
                      onClick={() => irAPagina(paginaSegura - 1)}
                      style={{ padding: '6px 12px', fontSize: '12px', opacity: paginaSegura <= 1 ? 0.45 : 1 }}
                    >
                      <ChevronLeft size={14} /> Anterior
                    </button>

                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => irAPagina(num)}
                        style={{
                          minWidth: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          border: num === paginaSegura ? 'none' : '1px solid var(--m3-outline-variant)',
                          background: num === paginaSegura ? 'var(--m3-primary)' : 'var(--m3-surface-container-low)',
                          color: num === paginaSegura ? '#ffffff' : 'var(--m3-text-primary)',
                          fontWeight: 800,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                        }}
                      >
                        {num}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="m3-btn m3-btn-tonal"
                      disabled={paginaSegura >= totalPaginas}
                      onClick={() => irAPagina(paginaSegura + 1)}
                      style={{ padding: '6px 12px', fontSize: '12px', opacity: paginaSegura >= totalPaginas ? 0.45 : 1 }}
                    >
                      Siguiente <ChevronRight size={14} />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};
