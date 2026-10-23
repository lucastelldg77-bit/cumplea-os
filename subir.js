/**
 * POST /api/subir  (JSON)
 * { e, uploadId, sesion, desafioId, desafioNombre, imagen: base64, miniatura: base64 }
 *
 * Si la misma subida llega de nuevo (reintento), responde con la que ya está guardada.
 */
const {
  RE_SUBIDA, RE_DESAFIO, ErrorUsuario, manejar, leerJson, ruta, rutaMarcador,
  leerBlobJson, guardarJson, guardarImagen, leerEvento, estadoDeSubida,
} = require('./_lib/comun');

function decodificarJpeg(base64, nombre) {
  const bytes = Buffer.from(String(base64 || ''), 'base64');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new ErrorUsuario(`La ${nombre} no es una imagen válida.`);
  }
  return bytes;
}

module.exports = manejar(async req => {
  const d = await leerJson(req);
  const evento = await leerEvento(d.e);
  if (!RE_SUBIDA.test(String(d.uploadId))) throw new ErrorUsuario('Identificador de subida inválido.');
  if (!RE_SUBIDA.test(String(d.sesion))) throw new ErrorUsuario('Identificador de sesión inválido.');
  if (!RE_DESAFIO.test(String(d.desafioId))) throw new ErrorUsuario('Desafío inválido.');

  const rutaSubida = ruta(evento.id, 'subidas', `${d.uploadId}.json`);
  const anterior = await leerBlobJson(rutaSubida);
  if (anterior) {
    const estado = await estadoDeSubida(evento.id, anterior);
    if (estado) return { id: d.uploadId, estado, repetida: true };
  }

  const foto = decodificarJpeg(d.imagen, 'foto');
  const mini = decodificarJpeg(d.miniatura, 'miniatura');
  const estado = evento.publicacion === 'moderada' ? 'pendiente' : 'publicada';
  const subida = {
    evento: evento.id,
    uploadId: d.uploadId,
    sesion: d.sesion,
    desafioId: d.desafioId,
    desafioNombre: String(d.desafioNombre || '').replace(/[\r\n\t]/g, ' ').slice(0, 60),
    // Un reintento de una subida que quedó a medias conserva su fecha original.
    fecha: anterior ? anterior.fecha : Date.now(),
    fechaTexto: new Date(anterior ? anterior.fecha : Date.now()).toISOString(),
    estado,
  };

  // Orden: primero las imágenes, al final el marcador que la hace aparecer en la galería.
  const [guardada] = await Promise.all([
    guardarImagen(ruta(evento.id, 'fotos', `${d.uploadId}.jpg`), foto),
    guardarImagen(ruta(evento.id, 'mini', `${d.uploadId}.jpg`), mini),
  ]);
  subida.url = guardada.url;
  await guardarJson(rutaSubida, subida);
  await guardarJson(rutaMarcador(evento.id, estado, subida), subida);
  return { id: d.uploadId, estado, repetida: false };
});
