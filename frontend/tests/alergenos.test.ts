// Ejecutar con: node tests/alergenos.test.ts
import { ALERGENOS_UE, alergenosEnTexto, migrarAlergiasGuardadas } from '../src/alergenos.ts';

function asegurar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(mensaje);
}

asegurar(ALERGENOS_UE.length === 26, `la norma europea lista 26 alérgenos: ${ALERGENOS_UE.length}`);
asegurar(new Set(ALERGENOS_UE.map((a) => a.id)).size === 26, 'ids repetidos');
asegurar(alergenosEnTexto('Hexil Cinamal').join() === 'hexyl_cinnamal', 'hexil cinamal no es cinnamal');
asegurar(alergenosEnTexto('Amyl Cinnamal').join() === 'amyl_cinnamal', 'amyl cinnamal no es cinnamal');
asegurar(alergenosEnTexto('Cinnamal').join() === 'cinnamal', 'cinnamal');
asegurar(alergenosEnTexto('Isoeugenol').join() === 'isoeugenol', 'isoeugenol no es eugenol');
asegurar(alergenosEnTexto('Alcohol Cinamílico').join() === 'cinnamyl_alcohol', 'alcohol cinamílico con tilde');
asegurar(alergenosEnTexto('Alcohol Amilcinamílico').join() === 'amylcinnamyl_alcohol', 'alcohol amilcinamílico');
asegurar(alergenosEnTexto('Alcohol').length === 0, 'el alcohol de la base no es alérgeno');
asegurar(
  migrarAlergiasGuardadas(['eugenol', 'geraniol']).join() === 'eugenol,geraniol,isoeugenol,citronellol',
  'quien marcó eugenol y geraniol conserva isoeugenol y citronellol',
);
asegurar(migrarAlergiasGuardadas(['linalool']).join() === 'linalool', 'sin cambios para el resto');

console.log('ok: alergenos');
