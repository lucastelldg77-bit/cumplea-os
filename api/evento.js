// GET /api/evento?e=<id> → datos públicos del cumpleaños (encabezado, colores) y los desafíos de su ruleta.
const { manejar, parametros, leerEvento, leerDesafios, desafiosDelEvento } = require('./_lib/comun');

module.exports = manejar(async req => {
  const [evento, catalogo] = await Promise.all([leerEvento(parametros(req).get('e')), leerDesafios()]);
  return { evento: { ...evento, desafios: desafiosDelEvento(catalogo, evento.desafios) } };
});
