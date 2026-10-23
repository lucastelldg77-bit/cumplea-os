/**
 * Comunicación con el servidor (funciones de Vercel + Vercel Blob).
 * Con `?demo` en la dirección se usa un servidor de demostración que guarda todo
 * en este navegador, para probar la web sin publicarla.
 */
import { API_URL } from './config.js';
import { buscarDesafio } from './desafios.js';
import * as idb from './idb.js';

export class ErrorApi extends Error {}

const SIN_CONEXION = 'No pudimos subir la foto. Revisá tu conexión (wifi o datos) y tocá Reintentar.';

function blobABase64(blob) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).split(',')[1]);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(blob);
  });
}

function interpretar(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorApi('El servidor respondió algo inesperado. Probá de nuevo.');
  }
  if (!datos.ok) throw new ErrorApi(datos.error || 'Hubo un problema. Probá de nuevo.');
  return datos;
}

// El servidor guarda solo el id del desafío en el nombre; el nombre visible sale del catálogo.
function conNombres(pagina) {
  return {
    ...pagina,
    fotos: pagina.fotos.map(f => ({ ...f, desafioNombre: (buscarDesafio(f.desafioId) || { nombre: f.desafioId }).nombre })),
  };
}

/* ---------- Servidor real ---------- */

function crearApiReal() {
  async function obtener(ruta, parametros) {
    let respuesta;
    try {
      respuesta = await fetch(`${API_URL}/${ruta}?${new URLSearchParams(parametros)}`);
    } catch {
      throw new ErrorApi('No hay conexión con el servidor. Revisá tu internet.');
    }
    return interpretar(await respuesta.text());
  }

  function enviar(ruta, cuerpo, { clave, alProgresar } = {}) {
    return new Promise((resolver, rechazar) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/${ruta}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (clave) xhr.setRequestHeader('X-Clave-Admin', clave);
      xhr.timeout = 120000;
      if (alProgresar) xhr.upload.onprogress = e => e.lengthComputable && alProgresar(e.loaded / e.total);
      xhr.onload = () => {
        try { resolver(interpretar(xhr.responseText)); } catch (err) { rechazar(err); }
      };
      xhr.onerror = () => rechazar(new ErrorApi(SIN_CONEXION));
      xhr.ontimeout = () => rechazar(new ErrorApi('La subida tardó demasiado. Revisá tu conexión y tocá Reintentar.'));
      xhr.send(JSON.stringify(cuerpo));
    });
  }

  return {
    modoDemo: false,
    evento: async e => (await obtener('evento', { e })).evento,
    galeria: async (e, desde = 0) => conNombres(await obtener('galeria', { e, desde })),
    async subir({ evento, uploadId, sesion, desafio, blob, mini }, alProgresar) {
      const [imagen, miniatura] = await Promise.all([blobABase64(blob), blobABase64(mini || blob)]);
      return enviar('subir', {
        e: evento, uploadId, sesion, desafioId: desafio.id, desafioNombre: desafio.nombre, imagen, miniatura,
      }, { alProgresar });
    },
    eventos: async clave => (await enviar('admin', { accion: 'eventos' }, { clave })).eventos,
    guardarEvento: async (clave, evento) => (await enviar('admin', { accion: 'guardarEvento', evento }, { clave })).evento,
    listar: async (e, clave, estado, desde = 0) => conNombres(await enviar('admin', { accion: 'listar', e, estado, desde }, { clave })),
    moderar: (e, clave, id, estado) => enviar('admin', { accion: 'moderar', e, id, estado }, { clave }),
    urlFoto: (foto, ancho) => (ancho <= 600 ? foto.mini : foto.url),
  };
}

/* ---------- Servidor de demostración ---------- */

const EVENTOS_DEMO = {
  demo: {
    id: 'demo', titulo: 'Cumple de Martina', subtitulo: '¡Gracias por venir a festejar!',
    fecha: '2026-11-14', emoji: '🎂', colorPrincipal: '#e5007d', colorSecundario: '#ffb703',
    publicacion: 'automatica', desafios: [], activo: true,
  },
  'demo-moderado': {
    id: 'demo-moderado', titulo: 'Los 40 de Pablo', subtitulo: 'Fiesta sorpresa',
    fecha: '2026-12-05', emoji: '🥳', colorPrincipal: '#3a0ca3', colorSecundario: '#4cc9f0',
    publicacion: 'moderada', desafios: [], activo: true,
  },
};
const CLAVE_DEMO = 'demo';
const CLAVE_EVENTOS_DEMO = 'cumple-demo:eventos';

function crearApiDemo() {
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const urls = new Map();
  // `?fallar=1` hace fallar la primera subida, para probar el reintento.
  let fallasPendientes = new URLSearchParams(location.search).get('fallar') === '1' ? 1 : 0;

  function eventosDemo() {
    try {
      return { ...EVENTOS_DEMO, ...JSON.parse(localStorage.getItem(CLAVE_EVENTOS_DEMO) || '{}') };
    } catch {
      return { ...EVENTOS_DEMO };
    }
  }
  function urlDe(id, blob) {
    if (!urls.has(id) && blob) urls.set(id, URL.createObjectURL(blob));
    return urls.get(id) || '';
  }
  async function pagina(e, estado, desde) {
    const fotos = (await idb.leerTodo('demo'))
      .filter(f => f.evento === e && f.estado === estado)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(f => ({ id: f.id, desafioId: f.desafioId, fecha: f.fecha, url: urlDe(f.id, f.blob), mini: urlDe(`${f.id}-mini`, f.mini || f.blob) }));
    const parte = fotos.slice(desde, desde + 60);
    return conNombres({ fotos: parte, total: fotos.length, siguiente: desde + parte.length < fotos.length ? desde + parte.length : null });
  }
  function verificar(clave) {
    if (clave !== CLAVE_DEMO) throw new ErrorApi('Clave incorrecta. En la demostración la clave es "demo".');
  }

  return {
    modoDemo: true,
    async evento(e) {
      await espera(250);
      const evento = eventosDemo()[e];
      if (!evento) throw new ErrorApi('No encontramos este cumpleaños.');
      return evento;
    },
    galeria: async (e, desde = 0) => { await espera(200); return pagina(e, 'publicada', desde); },
    async subir({ evento, uploadId, sesion, desafio, blob, mini }, alProgresar) {
      const repetida = await idb.leer('demo', uploadId);
      for (let i = 1; i <= 10; i++) { await espera(120); alProgresar && alProgresar(i / 10); }
      if (fallasPendientes > 0) { fallasPendientes--; throw new ErrorApi(SIN_CONEXION); }
      if (repetida) return { id: uploadId, estado: repetida.estado, repetida: true };
      const foto = {
        id: uploadId, evento, sesion, desafioId: desafio.id, fecha: new Date().toISOString(),
        estado: eventosDemo()[evento].publicacion === 'moderada' ? 'pendiente' : 'publicada', blob, mini,
      };
      await idb.guardar('demo', uploadId, foto);
      return { id: uploadId, estado: foto.estado, repetida: false };
    },
    async eventos(clave) { verificar(clave); return Object.values(eventosDemo()); },
    async guardarEvento(clave, datos) {
      verificar(clave);
      const id = datos.id || `${(datos.titulo || 'cumple').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(16).slice(2, 8)}`;
      const evento = { ...datos, id, activo: datos.activo !== false };
      const propios = JSON.parse(localStorage.getItem(CLAVE_EVENTOS_DEMO) || '{}');
      propios[id] = evento;
      localStorage.setItem(CLAVE_EVENTOS_DEMO, JSON.stringify(propios));
      return evento;
    },
    async listar(e, clave, estado, desde = 0) { verificar(clave); return pagina(e, estado, desde); },
    async moderar(e, clave, id, estado) {
      verificar(clave);
      const foto = await idb.leer('demo', id);
      if (!foto || foto.evento !== e) throw new ErrorApi('No encontramos esa foto en este evento.');
      await idb.guardar('demo', id, { ...foto, estado });
      return { id, estado };
    },
    urlFoto: (foto, ancho) => (ancho <= 600 ? foto.mini : foto.url),
  };
}

// En esta PC (localhost) no hay servidor de Vercel: se usa la demostración automáticamente.
const ES_LOCAL = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export function crearApi() {
  const forzarDemo = new URLSearchParams(location.search).has('demo');
  return !API_URL || forzarDemo || ES_LOCAL ? crearApiDemo() : crearApiReal();
}
