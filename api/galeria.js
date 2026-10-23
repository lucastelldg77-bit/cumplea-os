// GET /api/galeria?e=<id>&desde=<n> → fotos publicadas, de la más nueva a la más vieja.
const { manejar, parametros, leerEvento, listarFotos, paginar } = require('./_lib/comun');

module.exports = manejar(async req => {
  const p = parametros(req);
  const evento = await leerEvento(p.get('e'), { incluirInactivo: true });
  return paginar(await listarFotos(evento.id, 'publicada'), p.get('desde'));
});
