// Ejecutar con: node tests/nombres.test.ts
import { esMismoPerfume, nombreSegunOferta, terminoDeBusqueda } from '../src/nombres.ts';

function igual(real: string, esperado: string) {
  if (real !== esperado) throw new Error(`esperaba "${esperado}", salió "${real}"`);
}

const armani = 'Giorgio Armani';
igual(nombreSegunOferta('My Way', 'GIORGIO ARMANI MY WAY YLANG WOMAN EDP 30ML', armani), 'My Way Ylang');
igual(nombreSegunOferta('My Way', 'Perfume Mujer My Way Eau De Parfum 30ml - GIORGIO ARMANI', armani), 'My Way');
igual(nombreSegunOferta('My Way', 'My Way Edp V90+V10+Bl50 H26 - GIORGIO ARMANI', armani), 'My Way');
igual(nombreSegunOferta('My Way', 'GIORGIO ARMANI ACQUA DI GIO MEN EDT 100ML REFILLABLE', armani), 'Acqua di Gio');
igual(nombreSegunOferta('Acqua di Giò', 'GIORGIO ARMANI ACQUA DI GIO PROFONDO MEN EDT 100ML', armani), 'Acqua di Giò Profondo');
igual(nombreSegunOferta('Light Blue Pour Homme', 'Dolce & Gabbana Light Blue Pour Homme 100ML EDT - DOLCE&GABBANA', 'Dolce & Gabbana'), 'Light Blue Pour Homme');
igual(nombreSegunOferta('Bleu de Chanel', 'Bleu Chanel EDP 100 ml', 'Chanel'), 'Bleu de Chanel');
igual(nombreSegunOferta('Sauvage', undefined, 'Dior'), 'Sauvage');

function es(real: boolean, esperado: boolean, caso: string) {
  if (real !== esperado) throw new Error(`esMismoPerfume(${caso}) debía ser ${esperado}`);
}
es(esMismoPerfume('My Way', 'GIORGIO ARMANI ACQUA DI GIO MEN EDT 100ML REFILLABLE', armani), false, 'Acqua di Gio');
es(esMismoPerfume('My Way', 'GIORGIO ARMANI MY WAY YLANG WOMAN EDP 30ML', armani), false, 'My Way Ylang');
es(esMismoPerfume('My Way', 'Perfume Mujer My Way Eau De Parfum 30ml - GIORGIO ARMANI', armani), true, 'My Way EDP');
es(esMismoPerfume('My Way', 'My Way Edp V90+V10+Bl50 H26 - GIORGIO ARMANI', armani), true, 'set');
es(esMismoPerfume('Bleu de Chanel', 'Bleu Chanel EDP 100 ml', 'Chanel'), true, 'Bleu Chanel');
es(esMismoPerfume('Sauvage', 'Sauvage Vaporizador Original 100 ml', 'Dior'), true, 'vaporizador');
es(esMismoPerfume('Sauvage', undefined, 'Dior'), true, 'sin oferta');
es(esMismoPerfume('1 Million', 'PACO RABANNE ONE MILLION MEN EDT 100ML TESTER', 'Paco Rabanne', 'Masculino'), true, 'One Million');
es(esMismoPerfume('Eros', 'Versace Eros Flame Eau de Parfum 50 Ml', 'Versace', 'Masculino'), false, 'Eros Flame');
es(esMismoPerfume('Black Orchid', 'BLACK ORCHID BODY SPR UNISEX 150ML - TOM FORD', 'Tom Ford', 'Unisex'), false, 'body spray');
// La IA le agrega la concentración o el género al nombre oficial; las tiendas lo escriben de otra forma
es(esMismoPerfume('Sauvage Eau de Toilette', 'DIOR SAUVAGE MEN EDT 100ML', 'Dior', 'Masculino'), true, 'Sauvage Eau de Toilette');
es(esMismoPerfume('Sauvage Eau de Toilette', 'DIOR SAUVAGE ELIXIR MEN 60ML', 'Dior', 'Masculino'), false, 'Sauvage Elixir');
es(esMismoPerfume('Acqua di Giò Pour Homme', 'Perfume Hombre Acqua Di Gio EDT 50ml - GIORGIO ARMANI', armani, 'Masculino'), true, 'Pour Homme');
es(esMismoPerfume('Acqua di Giò Pour Homme', 'Acqua Di Gio Pour Homme Eau de Toilette 100ml', armani, 'Masculino'), true, 'Pour Homme repetido');
es(esMismoPerfume('Libre Eau de Parfum', 'YVES SAINT LAURENT LIBRE WOMAN EDP 90ML', 'Yves Saint Laurent', 'Femenino'), true, 'Libre');
es(esMismoPerfume('Burberry Her Eau de Parfum', 'PERFUME BURBERRY HER DAMA EDP 100 ML', 'Burberry', 'Femenino'), true, 'Her dama');
es(esMismoPerfume('Burberry Her Eau de Parfum', 'Burberry Her Eau de Parfum 100 ml', 'Burberry', 'Femenino'), true, 'Her');
es(esMismoPerfume('Pour Homme', 'Dolce & Gabbana Pour Homme EDT 125ml', 'Dolce & Gabbana', 'Masculino'), true, 'el nombre es solo el género');
es(esMismoPerfume('Dior Homme Intense', 'DIOR SAUVAGE EDP INTENSE 100ML', 'Dior', 'Masculino'), false, 'Dior Homme Intense');
igual(nombreSegunOferta('Sauvage Eau de Toilette', 'DIOR SAUVAGE MEN EDP 100ML', 'Dior'), 'Sauvage Eau de Toilette');
igual(nombreSegunOferta('Acqua di Giò Pour Homme', 'GIORGIO ARMANI ACQUA DI GIO PROFONDO MEN EDT 50ML', armani), 'Acqua di Giò Profondo');
es(esMismoPerfume('Bleu de Chanel', 'Perfume Mujer Armani Privé Iris Bleu EDT 100ml - GIORGIO ARMANI', 'Chanel'), false, 'Iris Bleu');
es(esMismoPerfume('Light Blue', 'DOLCE & GABBANA LIGHT BLUE WOMAN EDP 100ML', 'Dolce & Gabbana', 'Masculino'), false, 'Light Blue Woman');
es(esMismoPerfume('Light Blue', 'DOLCE & GABBANA LIGHT BLUE MEN EDT 100ML', 'Dolce & Gabbana', 'Masculino'), true, 'Light Blue Men');
es(esMismoPerfume('Eros', 'VERSACE EROS WOMAN EDP 100ML', 'Versace', 'Unisex'), true, 'unisex no filtra');

igual(terminoDeBusqueda('Perfume Hombre Acqua Di Gio EDT 50ml - GIORGIO ARMANI', armani), 'Giorgio Armani Acqua di Gio');
igual(terminoDeBusqueda('Sauvage', 'Dior'), 'Dior Sauvage');
igual(terminoDeBusqueda('Versace Eros', 'Versace'), 'Versace Eros');
igual(terminoDeBusqueda('Light Blue'), 'Light Blue');
igual(terminoDeBusqueda('Bleu de Chanel', 'Chanel'), 'Bleu de Chanel');
// título de un set: el nombre termina donde empieza el contenido del set, y el "1" es parte del nombre
igual(
  terminoDeBusqueda('Paco 1 Million Golden Oud Set de Regalo 3 Piezas para Hombre 100 ml Perfume + 150 ml Desodorante + 10 ml Travel - RABANNE', 'Rabanne'),
  'Rabanne Paco 1 Million Golden Oud',
);
igual(terminoDeBusqueda('Set Perfume Mujer My Way EDP 30ml + 10ml - GIORGIO ARMANI', armani), 'Giorgio Armani My Way');
igual(nombreSegunOferta('Sauvage', 'CAROLINA HERRERA 212 VIP BLACK MEN EDP 100ML', 'Carolina Herrera'), '212 Vip Black');

// La concentración en medio del nombre ("Black Opium EDP Over Red") no lo corta; las otras versiones siguen aparte
const ysl = 'Yves Saint Laurent';
igual(esMismoPerfume('Black Opium Over Red', 'Perfume Mujer Black Opium EDP Over Red - YVES SAINT LAURENT 30ml', ysl, 'Femenino'), true);
igual(esMismoPerfume('Black Opium Over Red', 'Perfume Mujer Black Opium EDP - YVES SAINT LAURENT 50ml', ysl, 'Femenino'), false);
igual(esMismoPerfume('Black Opium Over Red', 'YVES SAINT LAURENT BLACK OPIUM GLITTER WOMAN EDP 50ML', ysl, 'Femenino'), false);
// Sin la marca conocida, lo que sigue al guion de Falabella es la marca y no una versión
igual(esMismoPerfume('Black Opium Over Red', 'Perfume Mujer Black Opium EDP Over Red - YVES SAINT LAURENT 30ml'), true);
// El tamaño al final no se lleva la marca al limpiar el título
igual(terminoDeBusqueda('Perfume Mujer Black Opium EDP Over Red - YVES SAINT LAURENT 30ml'), 'Black Opium Over Red Yves Saint Laurent');

console.log('ok: nombres');
