// GET /api/evento?e=<id> → datos públicos del cumpleaños (encabezado, colores, desafíos).
const { manejar, parametros, leerEvento } = require('./_lib/comun');

module.exports = manejar(async req => ({ evento: await leerEvento(parametros(req).get('e')) }));
