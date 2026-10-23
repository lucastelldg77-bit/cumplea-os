/**
 * POST /api/admin  (JSON, con el encabezado x-clave-admin)
 *   { accion: 'eventos' }                                  → lista de cumpleaños
 *   { accion: 'guardarEvento', evento: {...} }             → crea (sin id) o edita un cumpleaños
 *   { accion: 'listar', e, estado, desde }                 → fotos de un estado
 *   { accion: 'moderar', e, id, estado }                   → publica, oculta o rechaza una foto
 *   { accion: 'borrarEvento', e, confirmar: e }            → borra el cumpleaños y todas sus fotos
 *   { accion: 'desafios' }                                 → lista de desafíos (sin los borrados)
 *   { accion: 'guardarDesafio', desafio: {...} }           → crea (sin id) o edita un desafío
 *   { accion: 'borrarDesafio', id }                        → saca un desafío de la lista
 */
const {
  ESTADOS, RE_SUBIDA, RE_DESAFIO, ErrorUsuario, manejar, leerJson, verificarClave,
  ruta, rutaMarcador, leerBlobJson, guardarJson, listarTodo, del,
  leerEvento, limpiarEvento, nuevoIdEvento, borrarEvento, estadoDeSubida, listarFotos, paginar,
  leerDesafios, guardarDesafios, limpiarDesafio, nuevoIdDesafio,
} = require('./_lib/comun');

const visibles = catalogo => catalogo.filter(d => d.activo !== false);

async function guardarDesafio(datos) {
  if (!datos || typeof datos !== 'object') throw new ErrorUsuario('Faltan los datos del desafío.');
  const catalogo = await leerDesafios();
  let id = datos.id;
  if (id) {
    if (!RE_DESAFIO.test(String(id)) || !catalogo.some(d => d.id === id)) throw new ErrorUsuario('No encontramos ese desafío.', 404);
  } else {
    id = nuevoIdDesafio(datos.nombre, catalogo);
  }
  const desafio = limpiarDesafio(datos, id);
  const nuevo = catalogo.some(d => d.id === id) ? catalogo.map(d => (d.id === id ? desafio : d)) : [...catalogo, desafio];
  await guardarDesafios(nuevo);
  return { desafio, desafios: visibles(nuevo) };
}

// No se elimina: queda inactivo para que las fotos que ya lo cumplieron sigan mostrando su nombre.
async function borrarDesafio(id) {
  const catalogo = await leerDesafios();
  if (!catalogo.some(d => d.id === id && d.activo !== false)) throw new ErrorUsuario('No encontramos ese desafío.', 404);
  if (visibles(catalogo).length <= 1) throw new ErrorUsuario('La ruleta necesita al menos un desafío.');
  const nuevo = catalogo.map(d => (d.id === id ? { ...d, activo: false } : d));
  await guardarDesafios(nuevo);
  return { desafios: visibles(nuevo) };
}

async function eventos() {
  const { carpetas } = await listarTodo('cumples/', { mode: 'folded' });
  const lista = await Promise.all(carpetas.map(c => leerBlobJson(`${c.replace(/\/$/, '')}/evento.json`).catch(() => null)));
  return { eventos: lista.filter(Boolean).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))) };
}

async function guardarEvento(datos) {
  if (!datos || typeof datos !== 'object') throw new ErrorUsuario('Faltan los datos del cumpleaños.');
  let id = datos.id;
  if (id) await leerEvento(id, { incluirInactivo: true }); // tiene que existir
  else id = nuevoIdEvento(datos.titulo);
  const evento = limpiarEvento(datos, id);
  await guardarJson(ruta(id, 'evento.json'), evento);
  return { evento };
}

async function moderar(d) {
  const evento = await leerEvento(d.e, { incluirInactivo: true });
  if (!RE_SUBIDA.test(String(d.id))) throw new ErrorUsuario('Foto inválida.');
  if (!ESTADOS.includes(d.estado)) throw new ErrorUsuario('Estado inválido.');
  const rutaSubida = ruta(evento.id, 'subidas', `${d.id}.json`);
  const subida = await leerBlobJson(rutaSubida);
  if (!subida) throw new ErrorUsuario('No encontramos esa foto en este cumpleaños.', 404);
  const actual = await estadoDeSubida(evento.id, subida);
  if (actual === d.estado) return { id: d.id, estado: d.estado };

  const nueva = { ...subida, estado: d.estado, moderada: new Date().toISOString() };
  await guardarJson(rutaMarcador(evento.id, d.estado, nueva), nueva);
  await guardarJson(rutaSubida, nueva);
  if (actual) await del(rutaMarcador(evento.id, actual, subida));
  return { id: d.id, estado: d.estado };
}

module.exports = manejar(async req => {
  const d = await leerJson(req);
  verificarClave(req);
  switch (d.accion) {
    case 'eventos': return eventos();
    case 'guardarEvento': return guardarEvento(d.evento);
    case 'listar': {
      const evento = await leerEvento(d.e, { incluirInactivo: true });
      const estado = ESTADOS.includes(d.estado) ? d.estado : 'pendiente';
      return paginar(await listarFotos(evento.id, estado), d.desde);
    }
    case 'moderar': return moderar(d);
    case 'borrarEvento': {
      if (!d.e || d.confirmar !== d.e) throw new ErrorUsuario('Falta confirmar el borrado.');
      return { borrados: await borrarEvento(d.e) };
    }
    case 'desafios': return { desafios: visibles(await leerDesafios()) };
    case 'guardarDesafio': return guardarDesafio(d.desafio);
    case 'borrarDesafio': return borrarDesafio(d.id);
    default: throw new ErrorUsuario('Acción desconocida.');
  }
});
