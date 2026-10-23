/**
 * Catálogo de desafíos de la ruleta.
 *
 * Para agregar uno nuevo, sumá un objeto al final con un `id` que no exista.
 * El id queda guardado junto a cada foto (en Drive y en la planilla), así que
 * no se cambia ni se reutiliza una vez que el desafío se usó en una fiesta.
 *
 * Campos opcionales:
 *   contacto: true  → muestra el aviso de consentimiento.
 *   sensible: true  → muestra que es opcional y sugiere volver a girar.
 *   aviso: '…'      → texto extra que se muestra con el desafío.
 */
export const DESAFIOS = [
  {
    id: 'perreando',
    nombre: 'Perreando',
    emoji: '💃',
    instrucciones: 'Te deberás sacar una foto perreando hasta el piso en cualquier momento de la fiesta.',
  },
  {
    id: 'con-anteojos',
    nombre: 'Con anteojos',
    emoji: '🕶️',
    instrucciones: 'Te deberás sacar una foto usando los anteojos de alguien más en cualquier momento de la fiesta.',
    aviso: 'Pedí permiso antes de usar los anteojos de otra persona.',
  },
  {
    id: 'con-el-morfi',
    nombre: 'Con el morfi',
    emoji: '🍕',
    instrucciones: 'Te deberás sacar una foto comiendo algo en cualquier momento de la fiesta.',
  },
  {
    id: 'con-el-amargado',
    nombre: 'Con el amargado',
    emoji: '😒',
    instrucciones: 'Te deberás sacar una foto con el más amargado de la fiesta. ¡Vamos a sacarle una sonrisa!',
    aviso: 'Sacala solo si la otra persona quiere salir en la foto.',
  },
  {
    id: 'con-la-abuela',
    nombre: 'Con la abuela',
    emoji: '👵',
    instrucciones: 'Te deberás sacar una foto dándole un beso a una abuela en cualquier momento de la fiesta.',
    contacto: true,
  },
  {
    id: 'con-un-desconocido',
    nombre: 'Con un desconocido',
    emoji: '🤝',
    instrucciones: 'Te deberás sacar una foto con alguien que no conozcas en cualquier momento de la fiesta.',
    aviso: 'Sacala solo si la otra persona quiere salir en la foto.',
  },
  {
    id: 'con-el-borracho',
    nombre: 'Con el borracho',
    emoji: '🥴',
    instrucciones: 'Te deberás sacar una foto con alguien pasado de copas en cualquier momento de la fiesta. Si vos sos el borracho, te aceptamos una selfie.',
    sensible: true,
    aviso: 'Este desafío es opcional y nadie tiene que tomar alcohol para cumplirlo. Si no te copa, volvé a girar o subí una foto libre.',
  },
  {
    id: 'beso-en-la-pelada',
    nombre: 'Beso en la pelada',
    emoji: '😘',
    instrucciones: 'Te deberás sacar una foto dándole un beso a un pelado en cualquier momento de la fiesta.',
    contacto: true,
  },
  {
    id: 'en-el-bano',
    nombre: 'En el baño',
    emoji: '🪞',
    instrucciones: 'Te deberás sacar una foto en el espejo del baño haciendo trompita en cualquier momento de la fiesta.',
  },
];

// Para quien prefiere no jugar: sube una foto sin desafío.
export const FOTO_LIBRE = {
  id: 'libre',
  nombre: 'Foto libre',
  emoji: '📸',
  instrucciones: 'Subí la foto que quieras de la fiesta. No hace falta cumplir ningún desafío.',
};

export const AVISO_CONSENTIMIENTO = 'Hacelo solo si la otra persona está de acuerdo.';

/** Desafíos que entran en la ruleta. `ids` vacío = todos. */
export function desafiosHabilitados(ids) {
  if (!ids || !ids.length) return DESAFIOS.slice();
  const elegidos = DESAFIOS.filter(d => ids.includes(d.id));
  return elegidos.length ? elegidos : DESAFIOS.slice();
}

export function buscarDesafio(id) {
  if (id === FOTO_LIBRE.id) return FOTO_LIBRE;
  return DESAFIOS.find(d => d.id === id) || null;
}
