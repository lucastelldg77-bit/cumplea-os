/**
 * Desafíos de la ruleta.
 *
 * Los desafíos se administran desde el panel (admin.html → Desafíos): se pueden agregar,
 * editar y borrar sin tocar código. Los 9 originales están en desafios-base.json y son
 * los que aparecen hasta que se edite la lista por primera vez.
 *
 * Cada desafío tiene un `id` que queda guardado con cada foto, por eso un desafío borrado
 * no se elimina del todo: se marca como inactivo y su nombre se sigue viendo en la galería.
 *
 * Campos: id, nombre, emoji, instrucciones, y opcionales
 *   contacto: true  → muestra el aviso de consentimiento.
 *   aviso: '…'      → texto extra que se muestra con el desafío.
 */

// Para quien prefiere no jugar: sube una foto sin desafío.
export const FOTO_LIBRE = {
  id: 'libre',
  nombre: 'Foto libre',
  emoji: '📸',
  instrucciones: 'Subí la foto que quieras de la fiesta. No hace falta cumplir ningún desafío.',
};

export const AVISO_CONSENTIMIENTO = 'Hacelo solo si la otra persona está de acuerdo.';

// Desafíos del cumpleaños abierto (los manda el servidor junto con el evento).
let catalogo = [];

export function usarDesafios(lista) {
  catalogo = Array.isArray(lista) ? lista : [];
}

export function buscarDesafio(id) {
  if (id === FOTO_LIBRE.id) return FOTO_LIBRE;
  return catalogo.find(d => d.id === id) || null;
}

/** Desafíos que entran en la ruleta de un evento: los activos que eligió (ninguno elegido = todos). */
export function desafiosDelEvento(catalogoCompleto, ids) {
  const activos = catalogoCompleto.filter(d => d.activo !== false);
  if (!ids || !ids.length) return activos;
  const elegidos = activos.filter(d => ids.includes(d.id));
  return elegidos.length ? elegidos : activos;
}
