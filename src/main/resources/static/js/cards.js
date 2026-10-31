import {img, esc} from './dom.js';

// Texto didáctico que acompaña a cada tipo de artículo en su ventana de detalle.
const ARTICLE_DESCRIPTIONS = {
  'Artículo Ecológico': 'Son estudios observacionales que utilizan datos agregados para estudiar una población. Al relacionar exclusivamente variables a nivel grupal, sus conclusiones quedan expuestas a la falacia ecológica.',
  'Artículo Transversal': 'Son estudios observacionales que recopilan datos de una muestra en un único punto temporal. Pueden establecer prevalencias y correlaciones entre variables, pero son incapaces de establecer relaciones de causalidad debido a que sufren de ambigüedad temporal.',
  'Casos y Controles': 'Son estudios observacionales retrospectivos que evalúan las exposiciones pasadas de una muestra que presenta una determinada enfermedad o condición (casos) frente a un grupo que ejerce de control al no presentarla.',
  'Cohortes': 'Son estudios observacionales que consisten en seguir a una muestra a lo largo del tiempo, dividiéndola en grupos en función de una determinada exposición para observar la aparición o modificación de una variable.',
  'Revisión Sistemática': 'Son estudios de revisión donde la unidad de análisis son estudios primarios, a partir de los cuales se pretende contestar a una pregunta de investigación claramente formulada mediante un proceso sistemático, explícito y reproducible.',
  'Ensayo Clínico Aleatorizado': 'Son estudios experimentales que se caracterizan porque la asignación de los sujetos a los grupos de estudio (experimental y control) se realiza mediante aleatorización. Se consideran el Gold Standard de la investigación primaria para establecer relaciones de causalidad.',
  'Ensayo Comunitario': 'Son estudios experimentales donde la unidad de asignación de la intervención no es el individuo, sino una comunidad completa. El investigador selecciona comunidades enteras y asigna al azar cuál recibe la intervención y cuál sirve de control, recogiendo datos agregados.',
  'Patente': 'Documento legal que describe una invención original. No es un artículo científico, sino un título de propiedad industrial que concede el derecho exclusivo de explotación comercial temporal a cambio de hacer públicos sus detalles técnicos.'
};
export const articleDescription = name => ARTICLE_DESCRIPTIONS[name] || '';

export function ideaCard(c, {command = 'inspect', disabled = false, selected = false} = {}) {
  return `<button class="game-card idea-card ${selected ? 'selected' : ''}" data-command="${command}" data-index="${c.indice}" ${disabled ? 'disabled' : ''}
    aria-label="${esc(c.nombre)}. Coste ${c.coste}, trabajo ${c.trabajo}, prestigio ${c.prestigio}" data-tip="${esc(c.nombre)} · ${c.coste} monedas · ${c.trabajo} trabajo · ${c.prestigio} prestigio">
    ${ideaCardContents(c)}
  </button>`;
}
export function ideaCardContents(c) {
  return `${img(c.marco, 'card-frame')}${c.legendaria ? '' : img(c.arte, 'card-art')}
    <span class="card-name">${esc(c.nombre)}</span>
    <span class="card-stats" aria-hidden="true">${[c.coste,c.trabajo,c.prestigio].map(value => `<span class="card-stat"><b>${value}</b></span>`).join('')}</span>
    ${c.ingresoPorTurno ? `<span class="card-income">+${c.ingresoPorTurno} monedas / turno</span>` : ''}`;
}
export function roleCard(r, {command = 'role', selected = false, unavailable = false} = {}) {
  const cadence = r.habilidad.match(/(?:Una vez por turno\.|Automática\.|sin límite de usos\.)$/i)?.[0] || '';
  const ability = r.habilidad.replace(/\s*(Una vez por turno\.|Automática\.)$/i, '').replace(/, sin límite de usos\.$/i, '.');
  return `<button class="game-card role-card ${selected ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}" data-command="${command}" data-index="${r.indice}" data-order="${r.orden}" aria-label="${unavailable ? 'No disponible. ' : ''}${esc(r.nombre)}, orden ${r.orden}. ${esc(r.habilidad)}">
    ${unavailable ? '<span class="role-unavailable">No disponible</span>' : ''}
    ${img(r.arte, 'role-art')}${img('cartas/marco_personaje.webp', 'card-frame')}
    <span class="role-order"><b>${r.orden}</b></span><span class="card-name">${esc(r.nombre)}</span>
    <span class="role-ability">${esc(ability)}</span><span class="role-cadence">${esc(cadence)}</span>
  </button>`;
}
