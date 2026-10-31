import assert from 'node:assert/strict';
import {FEATURES} from '../src/main/resources/static/js/features.js';
import {homeCommunity} from '../src/main/resources/static/js/home-community.js';
import {articleDescription} from '../src/main/resources/static/js/cards.js';

// Misiones y personalización quedan aplazadas en este curso.
assert.equal(FEATURES.misiones, false);
assert.equal(FEATURES.personalizacion, false);
const home = homeCommunity();
assert(!home.includes('#misiones'));
assert(home.includes('#perfil') && home.includes('#amigos') && home.includes('#ranking'));
// Cada tipo de artículo explica su diseño en la ventana de detalle.
for (const name of ['Artículo Ecológico','Artículo Transversal','Casos y Controles','Cohortes','Revisión Sistemática','Ensayo Clínico Aleatorizado','Ensayo Comunitario','Patente'])
  assert(articleDescription(name).length > 80, name);
assert.equal(articleDescription('Desconocido'), '');
console.log('Secciones aplazadas ocultas y descripciones de artículos verificadas');
