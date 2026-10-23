/**
 * Lógica compartida de las funciones de Vercel.
 *
 * Todo se guarda en Vercel Blob, una carpeta por cumpleaños:
 *   cumples/<evento>/evento.json                          configuración (título, colores, moderación…)
 *   cumples/<evento>/fotos/<subida>.jpg                   foto (1600 px)
 *   cumples/<evento>/mini/<subida>.jpg                    miniatura para la grilla
 *   cumples/<evento>/subidas/<subida>.json                datos de la foto (desafío, fecha, sesión…)
 *   cumples/<evento>/estado/<estado>/<fecha>_<subida>_<desafio>.json
 *       marcador del estado (publicada / pendiente / rechazada). La galería lista esta carpeta.
 *
 * Los nombres dependen solo del id de subida que genera el celular, así que si la misma
 * foto llega dos veces (reintento por corte de conexión) se pisa a sí misma y no se duplica.
 */
const { put, head, list, del } = require('@vercel/blob');
const crypto = require('crypto');

const ESTADOS = ['publicada', 'pendiente', 'rechazada'];
const RE_EVENTO = /^[a-z0-9-]{3,60}$/;
const RE_SUBIDA = /^[A-Za-z0-9-]{8,64}$/;
const RE_DESAFIO = /^[a-z0-9-]{1,40}$/;
const RE_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_CUERPO = 4 * 1024 * 1024; // Vercel acepta hasta 4,5 MB por pedido

class ErrorUsuario extends Error {
  constructor(mensaje, status = 400) { super(mensaje); this.status = status; }
}

/* ---------- HTTP ---------- */

function enviar(res, status, datos) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(datos));
}

// Envuelve una función: responde { ok: true, ... } o { ok: false, error } con un mensaje claro.
function manejar(fn) {
  return async (req, res) => {
    try {
      enviar(res, 200, { ok: true, ...(await fn(req, res)) });
    } catch (err) {
      if (err instanceof ErrorUsuario) return enviar(res, err.status, { ok: false, error: err.message });
      console.error(err);
      enviar(res, 500, { ok: false, error: 'Hubo un problema en el servidor. Probá de nuevo en un momento.' });
    }
  };
}

function parametros(req) {
  return new URL(req.url, 'http://local').searchParams;
}

async function leerJson(req) {
  if (req.method !== 'POST') throw new ErrorUsuario('Método no permitido.', 405);
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > MAX_CUERPO) throw new ErrorUsuario('La foto es demasiado grande.', 413);
    partes.push(parte);
  }
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch {
    throw new ErrorUsuario('Pedido inválido.');
  }
}

function verificarClave(req) {
  const esperada = process.env.CLAVE_ADMIN || '';
  if (!esperada) throw new ErrorUsuario('Falta configurar CLAVE_ADMIN en Vercel.', 500);
  const recibida = String(req.headers['x-clave-admin'] || '');
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new ErrorUsuario('Clave incorrecta.', 401);
}

/* ---------- Blob ---------- */

const ruta = (evento, ...partes) => ['cumples', evento, ...partes].join('/');
const rutaMarcador = (evento, estado, sub) =>
  ruta(evento, 'estado', estado, `${String(sub.fecha).padStart(13, '0')}_${sub.uploadId}_${sub.desafioId}.json`);

async function existe(pathname) {
  try {
    return await head(pathname);
  } catch (err) {
    if (err && (err.name === 'BlobNotFoundError' || /not.?found/i.test(err.message))) return null;
    throw err;
  }
}

async function leerBlobJson(pathname) {
  const info = await existe(pathname);
  if (!info) return null;
  // El parámetro evita leer una copia vieja guardada en la CDN.
  const respuesta = await fetch(`${info.url}?v=${new Date(info.uploadedAt).getTime()}`, { cache: 'no-store' });
  if (!respuesta.ok) throw new Error(`No se pudo leer ${pathname}: ${respuesta.status}`);
  return respuesta.json();
}

function guardarJson(pathname, datos) {
  return put(pathname, JSON.stringify(datos), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60,
  });
}

function guardarImagen(pathname, bytes) {
  return put(pathname, bytes, {
    access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'image/jpeg',
  });
}

async function listarTodo(prefix, opciones = {}) {
  const blobs = [];
  const carpetas = [];
  let cursor;
  do {
    const pagina = await list({ prefix, cursor, limit: 1000, ...opciones });
    blobs.push(...pagina.blobs);
    if (pagina.folders) carpetas.push(...pagina.folders);
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  return { blobs, carpetas };
}

/* ---------- Eventos ---------- */

async function leerEvento(id, { incluirInactivo = false } = {}) {
  if (!RE_EVENTO.test(String(id || ''))) throw new ErrorUsuario('No encontramos este cumpleaños.', 404);
  const evento = await leerBlobJson(ruta(id, 'evento.json'));
  if (!evento) throw new ErrorUsuario('No encontramos este cumpleaños.', 404);
  if (!incluirInactivo && evento.activo === false) throw new ErrorUsuario('Este cumpleaños ya no recibe fotos.', 410);
  return evento;
}

function limpiarEvento(datos, id) {
  const texto = (v, max) => String(v || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
  return {
    id,
    titulo: texto(datos.titulo, 60) || 'Cumpleaños',
    subtitulo: texto(datos.subtitulo, 90),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ? datos.fecha : '',
    emoji: texto(datos.emoji, 8) || '🎉',
    colorPrincipal: RE_COLOR.test(datos.colorPrincipal) ? datos.colorPrincipal : '#e5007d',
    colorSecundario: RE_COLOR.test(datos.colorSecundario) ? datos.colorSecundario : '#ffb703',
    publicacion: datos.publicacion === 'moderada' ? 'moderada' : 'automatica',
    desafios: Array.isArray(datos.desafios) ? datos.desafios.filter(d => RE_DESAFIO.test(d)).slice(0, 50) : [],
    activo: datos.activo !== false,
  };
}

function nuevoIdEvento(titulo) {
  const base = String(titulo || 'cumple').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cumple';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

/* ---------- Fotos ---------- */

// Busca en qué estado está una subida (o null si todavía no tiene marcador).
async function estadoDeSubida(evento, sub) {
  for (const estado of ESTADOS) {
    if (await existe(rutaMarcador(evento, estado, sub))) return estado;
  }
  return null;
}

async function listarFotos(evento, estado) {
  const prefijo = ruta(evento, 'estado', estado) + '/';
  const { blobs } = await listarTodo(prefijo);
  return blobs.map(b => {
    const [fecha, uploadId, desafioId] = b.pathname.slice(prefijo.length).replace(/\.json$/, '').split('_');
    const base = b.url.slice(0, b.url.length - b.pathname.length);
    return {
      id: uploadId,
      desafioId,
      fecha: new Date(Number(fecha)).toISOString(),
      url: base + ruta(evento, 'fotos', `${uploadId}.jpg`),
      mini: base + ruta(evento, 'mini', `${uploadId}.jpg`),
    };
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function paginar(fotos, desde, cantidad = 60) {
  const inicio = Math.max(0, Number(desde) || 0);
  const parte = fotos.slice(inicio, inicio + cantidad);
  return { fotos: parte, total: fotos.length, siguiente: inicio + parte.length < fotos.length ? inicio + parte.length : null };
}

module.exports = {
  ESTADOS, RE_EVENTO, RE_SUBIDA, RE_DESAFIO, ErrorUsuario,
  manejar, parametros, leerJson, verificarClave,
  ruta, rutaMarcador, existe, leerBlobJson, guardarJson, guardarImagen, listarTodo, del,
  leerEvento, limpiarEvento, nuevoIdEvento, estadoDeSubida, listarFotos, paginar,
};
