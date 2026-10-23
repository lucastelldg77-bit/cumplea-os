/**
 * Flujo del invitado:
 * QR → cumpleaños → girar ruleta → desafío → sacar/elegir foto → vista previa → subir → galería.
 *
 * El progreso se guarda en el celular (localStorage + IndexedDB) con un identificador de sesión,
 * así que si la página se recarga se retoma en el mismo paso, con la misma foto y el mismo desafío.
 */
import { crearApi } from './api.js';
import { crearRuleta } from './ruleta.js';
import { usarDesafios, buscarDesafio, FOTO_LIBRE, AVISO_CONSENTIMIENTO } from './desafios.js';
import { prepararFoto } from './imagen.js';
import { crearGaleria } from './galeria.js';
import * as idb from './idb.js';

const $ = sel => document.querySelector(sel);
const api = crearApi();
const parametros = new URLSearchParams(location.search);
const eventoId = parametros.get('e') || (api.modoDemo ? 'demo' : '');
const CLAVE_ESTADO = `cumple:${eventoId}`;

let evento;
let ruleta;
let galeria;
let subiendo = false;
let urlPrevia;

/* ---------- Estado persistente ---------- */

function nuevoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('').replace(/(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
}

function cargarEstado() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_ESTADO));
    if (guardado && guardado.sesion) return guardado;
  } catch { /* sin almacenamiento: se empieza de cero */ }
  return { sesion: nuevoId(), paso: 'ruleta' };
}

let estado = cargarEstado();

function actualizarEstado(cambios) {
  estado = { ...estado, ...cambios };
  try { localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado)); } catch { /* modo privado */ }
}

// La foto elegida se guarda junto con su desafío y su id de subida, en un mismo registro.
const claveBorrador = () => `${eventoId}:${estado.sesion}`;
const leerBorrador = () => idb.leer('borradores', claveBorrador()).catch(() => null);
let borradorEnMemoria = null; // respaldo si IndexedDB no está disponible

/* ---------- Pantallas ---------- */

function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => { p.hidden = p.id !== id; });
  const titulo = $(`#${id} h2`);
  if (titulo) titulo.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function aplicarCabecera() {
  document.title = `${evento.titulo} · Ruleta de desafíos`;
  $('#cab-emoji').textContent = evento.emoji;
  $('#cab-titulo').textContent = evento.titulo;
  $('#cab-subtitulo').textContent = evento.subtitulo;
  if (evento.fecha) {
    const [a, m, d] = evento.fecha.split('-').map(Number);
    $('#cab-fecha').textContent = new Date(a, m - 1, d)
      .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  const raiz = document.documentElement.style;
  if (/^#[0-9a-f]{6}$/i.test(evento.colorPrincipal)) {
    raiz.setProperty('--principal', evento.colorPrincipal);
    $('meta[name=theme-color]').content = evento.colorPrincipal;
  }
  if (/^#[0-9a-f]{6}$/i.test(evento.colorSecundario)) raiz.setProperty('--secundario', evento.colorSecundario);

  const privacidad = evento.publicacion === 'moderada'
    ? 'Participar es opcional. Las fotos que subas se van a ver en la galería del cumpleaños cuando las aprueben los organizadores.'
    : 'Participar es opcional. Las fotos que subas se ven al instante en la galería del cumpleaños, que pueden mirar todos los invitados.';
  document.querySelectorAll('[data-privacidad]').forEach(p => { p.textContent = privacidad; });
}

function textoDeAviso(desafio) {
  return [desafio.contacto ? AVISO_CONSENTIMIENTO : '', desafio.aviso || ''].filter(Boolean).join(' ');
}

function htmlDesafio(desafio) {
  const tarjeta = document.createElement('div');
  tarjeta.innerHTML = `<div class="tarjeta-emoji" aria-hidden="true"></div><h3></h3><p></p><p class="aviso" hidden></p>`;
  tarjeta.querySelector('.tarjeta-emoji').textContent = desafio.emoji;
  tarjeta.querySelector('h3').textContent = desafio.nombre;
  tarjeta.querySelector('p').textContent = desafio.instrucciones;
  const aviso = textoDeAviso(desafio);
  if (aviso) Object.assign(tarjeta.querySelector('.aviso'), { textContent: aviso, hidden: false });
  return tarjeta.childNodes;
}

/* ---------- Ruleta y resultado ---------- */

const modal = $('#modal-resultado');
let focoAntesDelModal = null;

function abrirModal(desafio) {
  focoAntesDelModal = document.activeElement;
  $('#modal-emoji').textContent = desafio.emoji;
  $('#modal-desafio').textContent = desafio.nombre;
  $('#modal-instrucciones').textContent = desafio.instrucciones;
  const aviso = textoDeAviso(desafio);
  Object.assign($('#modal-aviso'), { textContent: aviso, hidden: !aviso });
  const confeti = modal.querySelector('.confeti');
  confeti.replaceChildren(...Array.from({ length: 24 }, (_, i) => {
    const pieza = document.createElement('i');
    pieza.style.setProperty('--x', `${(i * 37) % 100}%`);
    pieza.style.setProperty('--d', `${(i % 6) * 0.12}s`);
    pieza.style.setProperty('--c', ['#ff006e', '#ffbe0b', '#3a86ff', '#8ac926', '#8338ec'][i % 5]);
    return pieza;
  }));
  modal.hidden = false;
  document.body.classList.add('con-modal');
  $('#modal-titulo').focus();
}

function cerrarModal() {
  modal.hidden = true;
  document.body.classList.remove('con-modal');
}

modal.addEventListener('keydown', e => {
  if (e.key === 'Escape') { cerrarModal(); actualizarEstado({ paso: 'ruleta', desafioId: null }); ruleta.enfocar(); }
  if (e.key !== 'Tab') return;
  // Mantiene el foco dentro del cuadro mientras está abierto.
  const botones = [...modal.querySelectorAll('button')];
  const [primero, ultimo] = [botones[0], botones[botones.length - 1]];
  if (e.shiftKey && (document.activeElement === primero || document.activeElement === $('#modal-titulo'))) {
    e.preventDefault(); ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault(); primero.focus();
  }
});

function alSalirDesafio(desafio) {
  // Se guarda recién cuando la animación terminó y el resultado se muestra.
  actualizarEstado({ paso: 'resultado', desafioId: desafio.id });
  abrirModal(desafio);
}

$('#btn-aceptar').addEventListener('click', () => {
  cerrarModal();
  actualizarEstado({ paso: 'desafio' });
  mostrarDesafio();
});

$('#btn-volver-girar').addEventListener('click', () => {
  cerrarModal();
  actualizarEstado({ paso: 'ruleta', desafioId: null });
  ruleta.girar();
  ruleta.enfocar();
});

$('#btn-sin-desafio').addEventListener('click', () => {
  actualizarEstado({ paso: 'desafio', desafioId: FOTO_LIBRE.id });
  mostrarDesafio();
});

/* ---------- Desafío y foto ---------- */

function desafioActual() {
  return buscarDesafio(estado.desafioId);
}

function mostrarDesafio({ abrirOpciones = false } = {}) {
  const desafio = desafioActual();
  if (!desafio) return volverARuleta();
  $('#desafio-tarjeta').replaceChildren(...htmlDesafio(desafio));
  $('#btn-tengo-foto').hidden = abrirOpciones;
  $('#opciones-foto').hidden = !abrirOpciones;
  $('#error-foto').hidden = true;
  $('#btn-cambiar').textContent = desafio.id === FOTO_LIBRE.id ? 'Mejor quiero jugar a la ruleta' : 'Cambiar de desafío';
  mostrarPantalla('p-desafio');
}

$('#btn-tengo-foto').addEventListener('click', () => {
  $('#btn-tengo-foto').hidden = true;
  $('#opciones-foto').hidden = false;
  $('#in-camara').focus();
});

$('#btn-cambiar').addEventListener('click', volverARuleta);

async function alElegirArchivo(e) {
  const archivo = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!archivo) return;
  const error = $('#error-foto');
  error.hidden = true;
  try {
    const { blob, mini } = await prepararFoto(archivo);
    const desafio = desafioActual();
    // Foto nueva = subida nueva. Los reintentos de esta misma foto reusan este id.
    const borrador = { uploadId: nuevoId(), desafioId: desafio.id, desafioNombre: desafio.nombre, blob, mini };
    borradorEnMemoria = borrador;
    await idb.guardar('borradores', claveBorrador(), borrador).catch(() => {});
    actualizarEstado({ paso: 'foto', uploadId: borrador.uploadId });
    mostrarVistaPrevia(borrador);
  } catch (err) {
    Object.assign(error, { textContent: err.message, hidden: false });
  }
}
$('#in-camara').addEventListener('change', alElegirArchivo);
$('#in-galeria').addEventListener('change', alElegirArchivo);

function mostrarVistaPrevia(borrador, { mensaje } = {}) {
  if (urlPrevia) URL.revokeObjectURL(urlPrevia);
  urlPrevia = URL.createObjectURL(borrador.blob);
  $('#previa-img').src = urlPrevia;
  const desafio = buscarDesafio(borrador.desafioId) || { emoji: '📸', nombre: borrador.desafioNombre };
  $('#previa-desafio').textContent = `${desafio.emoji} ${desafio.nombre}`;
  $('#progreso').hidden = true;
  $('#acciones-previa').hidden = false;
  $('#btn-subir').textContent = 'Confirmar y subir';
  Object.assign($('#error-subida'), { textContent: mensaje || '', hidden: !mensaje });
  mostrarPantalla('p-vista-previa');
}

$('#btn-otra').addEventListener('click', () => {
  if (subiendo) return;
  actualizarEstado({ paso: 'desafio' });
  mostrarDesafio({ abrirOpciones: true });
});

async function subirFoto() {
  if (subiendo) return;
  const borrador = (await leerBorrador()) || borradorEnMemoria;
  if (!borrador) {
    actualizarEstado({ paso: 'desafio' });
    return mostrarDesafio({ abrirOpciones: true });
  }
  subiendo = true;
  actualizarEstado({ paso: 'subiendo' });
  $('#acciones-previa').hidden = true;
  $('#error-subida').hidden = true;
  $('#progreso').hidden = false;
  const relleno = $('#progreso-relleno');
  const texto = $('#progreso-texto');
  relleno.style.width = '0%';
  texto.textContent = 'Subiendo tu foto…';

  try {
    const resultado = await api.subir({
      evento: eventoId, uploadId: borrador.uploadId, sesion: estado.sesion,
      desafio: { id: borrador.desafioId, nombre: borrador.desafioNombre }, blob: borrador.blob, mini: borrador.mini,
    }, fraccion => {
      relleno.style.width = `${Math.round(fraccion * 90)}%`;
      if (fraccion >= 1) texto.textContent = 'Guardando en el álbum del cumple…';
    });
    relleno.style.width = '100%';
    await idb.borrar('borradores', claveBorrador()).catch(() => {});
    borradorEnMemoria = null;
    actualizarEstado({ paso: 'listo', uploadId: null, ultimaSubida: { desafioId: borrador.desafioId, estado: resultado.estado } });
    if (galeria) galeria.recargar();
    mostrarListo();
  } catch (err) {
    actualizarEstado({ paso: 'foto' });
    mostrarVistaPrevia(borrador, { mensaje: err.message || 'No pudimos subir la foto. Tocá Reintentar.' });
    $('#btn-subir').textContent = 'Reintentar';
    $('#btn-subir').focus();
  } finally {
    subiendo = false;
  }
}
$('#btn-subir').addEventListener('click', subirFoto);

function mostrarListo() {
  const ultima = estado.ultimaSubida || {};
  const libre = ultima.desafioId === FOTO_LIBRE.id;
  $('#listo-titulo').textContent = libre ? '¡Foto subida!' : '¡Desafío cumplido!';
  $('#listo-texto').textContent = ultima.estado === 'pendiente'
    ? 'Tu recuerdo ya forma parte de la fiesta. Se va a ver en la galería cuando lo aprueben los organizadores.'
    : 'Tu recuerdo ya forma parte de la fiesta.';
  mostrarPantalla('p-listo');
}

$('#btn-otra-vez').addEventListener('click', volverARuleta);

function volverARuleta() {
  actualizarEstado({ paso: 'ruleta', desafioId: null, uploadId: null });
  mostrarPantalla('p-ruleta');
}

/* ---------- Galería y navegación ---------- */

$('#btn-volver-jugar').addEventListener('click', () => {
  history.replaceState(null, '', location.pathname + location.search);
  enrutar();
});

async function enrutar() {
  if (location.hash === '#galeria') {
    cerrarModal();
    if (!galeria) galeria = crearGaleria($('#galeria'), { api, evento });
    else galeria.recargar();
    return mostrarPantalla('p-galeria');
  }
  await retomar();
}

// Vuelve al paso en el que estaba el invitado (también después de recargar la página).
async function retomar() {
  const desafio = desafioActual();
  switch (estado.paso) {
    case 'resultado':
      if (!desafio) return volverARuleta();
      mostrarPantalla('p-ruleta');
      return abrirModal(desafio);
    case 'desafio':
      return mostrarDesafio();
    case 'foto':
    case 'subiendo': {
      if (subiendo) return mostrarPantalla('p-vista-previa');
      const borrador = (await leerBorrador()) || borradorEnMemoria;
      if (!borrador) {
        actualizarEstado({ paso: desafio ? 'desafio' : 'ruleta' });
        return desafio ? mostrarDesafio({ abrirOpciones: true }) : volverARuleta();
      }
      if (estado.paso === 'subiendo') {
        // Se cortó a mitad de la subida: se reintenta con el mismo id, sin duplicar.
        mostrarVistaPrevia(borrador);
        return subirFoto();
      }
      return mostrarVistaPrevia(borrador);
    }
    case 'listo':
      return mostrarListo();
    default:
      return mostrarPantalla('p-ruleta');
  }
}

/* ---------- Inicio ---------- */

async function iniciar() {
  $('#aviso-demo').hidden = !api.modoDemo;
  if (!eventoId) {
    $('#error-texto').textContent = 'Escaneá el código QR de la fiesta para entrar al cumpleaños.';
    $('#btn-reintentar-carga').hidden = true;
    return mostrarPantalla('p-error');
  }
  mostrarPantalla('p-cargando');
  try {
    evento = await api.evento(eventoId);
  } catch (err) {
    $('#error-texto').textContent = err.message;
    return mostrarPantalla('p-error');
  }
  aplicarCabecera();

  // El servidor manda los desafíos de este cumple, tal como los dejó el organizador en el panel.
  const desafios = evento.desafios || [];
  usarDesafios(desafios);
  if (!desafios.length) {
    $('#error-texto').textContent = 'Este cumpleaños todavía no tiene desafíos cargados.';
    return mostrarPantalla('p-error');
  }
  ruleta = crearRuleta($('#ruleta'), { items: desafios, centro: evento.emoji, alTerminar: alSalirDesafio });
  $('#lista-desafios').replaceChildren(...desafios.map(d => {
    const li = document.createElement('li');
    li.textContent = `${d.emoji} ${d.nombre}`;
    return li;
  }));

  window.addEventListener('hashchange', enrutar);
  await enrutar();
}

$('#btn-reintentar-carga').addEventListener('click', iniciar);
iniciar();
