// Panel del organizador: crear cumpleaños, código QR único de cada uno, moderación y descarga de fotos.
import { crearApi } from './api.js';
import { DESAFIOS } from './desafios.js';

const $ = sel => document.querySelector(sel);
const api = crearApi();
const formatoFecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const CLAVE_SESION = 'cumple-admin:clave';

let clave = '';
let eventos = [];
let evento = null;
let estadoActual = 'pendiente';
let siguiente = null;

$('#aviso-demo').hidden = !api.modoDemo;

function mostrarError(selector, err) {
  Object.assign($(selector), { textContent: err ? err.message || String(err) : '', hidden: !err });
}

/* ---------- Entrar ---------- */

async function entrar(valor) {
  eventos = await api.eventos(valor); // también verifica la clave
  clave = valor;
  try { sessionStorage.setItem(CLAVE_SESION, clave); } catch { /* sin almacenamiento */ }
  $('#form-entrar').hidden = true;
  $('#sec-eventos').hidden = false;
  dibujarEventos();
  const pedido = new URLSearchParams(location.search).get('e');
  const elegido = eventos.find(ev => ev.id === pedido);
  if (elegido) abrirEvento(elegido);
}

$('#form-entrar').addEventListener('submit', async e => {
  e.preventDefault();
  mostrarError('#error-entrar', null);
  try {
    await entrar($('#in-clave').value);
  } catch (err) {
    mostrarError('#error-entrar', err);
  }
});

/* ---------- Lista de cumpleaños ---------- */

function dibujarEventos() {
  const lista = $('#lista-eventos');
  if (!eventos.length) {
    lista.innerHTML = '<li class="lista-vacia">Todavía no hay cumpleaños. Tocá "+ Nuevo" para crear el primero.</li>';
    return;
  }
  lista.replaceChildren(...eventos.map(ev => {
    const li = document.createElement('li');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'evento-item' + (evento && evento.id === ev.id ? ' activo' : '');
    const fecha = ev.fecha ? new Date(`${ev.fecha}T12:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';
    boton.innerHTML = '<span class="evento-emoji" aria-hidden="true"></span><span><strong></strong><small></small></span>';
    boton.querySelector('.evento-emoji').textContent = ev.emoji;
    boton.querySelector('strong').textContent = ev.titulo;
    boton.querySelector('small').textContent = `${fecha}${ev.activo === false ? ' · cerrado' : ''}`;
    boton.addEventListener('click', () => abrirEvento(ev));
    li.append(boton);
    return li;
  }));
}

/* ---------- Crear o editar ---------- */

const form = $('#form-evento');
$('#checks-desafios').replaceChildren(...DESAFIOS.map(d => {
  const label = document.createElement('label');
  label.className = 'opcion';
  label.innerHTML = '<input type="checkbox" name="desafio" checked> <span></span>';
  label.querySelector('input').value = d.id;
  label.querySelector('span').textContent = `${d.emoji} ${d.nombre}`;
  return label;
}));

function abrirFormulario(ev) {
  form.reset();
  form.dataset.id = ev ? ev.id : '';
  $('#form-evento-titulo').textContent = ev ? `Editar · ${ev.titulo}` : 'Nuevo cumpleaños';
  if (ev) {
    for (const campo of ['titulo', 'subtitulo', 'fecha', 'emoji', 'colorPrincipal', 'colorSecundario']) {
      if (ev[campo]) form.elements[campo].value = ev[campo];
    }
    form.querySelector(`[name=publicacion][value=${ev.publicacion === 'moderada' ? 'moderada' : 'automatica'}]`).checked = true;
    const habilitados = ev.desafios && ev.desafios.length ? ev.desafios : DESAFIOS.map(d => d.id);
    form.querySelectorAll('[name=desafio]').forEach(c => { c.checked = habilitados.includes(c.value); });
    form.elements.activo.checked = ev.activo !== false;
  }
  mostrarError('#error-evento', null);
  form.hidden = false;
  $('#panel').hidden = true;
  form.elements.titulo.focus();
}

$('#btn-nuevo').addEventListener('click', () => abrirFormulario(null));
$('#btn-editar').addEventListener('click', () => abrirFormulario(evento));
$('#btn-cancelar-evento').addEventListener('click', () => {
  form.hidden = true;
  if (evento) $('#panel').hidden = false;
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const elegidos = [...form.querySelectorAll('[name=desafio]:checked')].map(c => c.value);
  if (!elegidos.length) return mostrarError('#error-evento', new Error('Elegí al menos un desafío.'));
  const datos = {
    id: form.dataset.id || undefined,
    titulo: form.elements.titulo.value,
    subtitulo: form.elements.subtitulo.value,
    fecha: form.elements.fecha.value,
    emoji: form.elements.emoji.value,
    colorPrincipal: form.elements.colorPrincipal.value,
    colorSecundario: form.elements.colorSecundario.value,
    publicacion: form.querySelector('[name=publicacion]:checked').value,
    // Todos marcados = lista vacía, así los desafíos nuevos que se agreguen entran solos.
    desafios: elegidos.length === DESAFIOS.length ? [] : elegidos,
    activo: form.elements.activo.checked,
  };
  const boton = form.querySelector('[type=submit]');
  boton.disabled = true;
  try {
    const guardado = await api.guardarEvento(clave, datos);
    eventos = [guardado, ...eventos.filter(ev => ev.id !== guardado.id)];
    form.hidden = true;
    abrirEvento(guardado);
  } catch (err) {
    mostrarError('#error-evento', err);
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Código QR ---------- */

function abrirEvento(ev) {
  evento = ev;
  history.replaceState(null, '', `?${new URLSearchParams({ e: ev.id, ...(api.modoDemo ? { demo: '' } : {}) })}`);
  form.hidden = true;
  $('#panel').hidden = false;
  dibujarEventos();
  $('#panel-titulo').textContent = `${ev.emoji} ${ev.titulo}`;
  $('#panel-publicacion').textContent = ev.publicacion === 'moderada'
    ? 'Con moderación: las fotos aparecen en la galería cuando las publicás acá abajo.'
    : 'Publicación automática: las fotos aparecen apenas se suben. Desde acá podés ocultar las que no quieras mostrar.';
  const enlace = enlaceDelEvento();
  Object.assign($('#enlace-evento'), { href: enlace, textContent: enlace });
  dibujarQr(enlace);
  $('#estado-zip').textContent = '';
  seleccionarPestana(ev.publicacion === 'moderada' ? 'pendiente' : 'publicada');
  $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function enlaceDelEvento() {
  const url = new URL('./', location.href);
  url.search = '';
  url.searchParams.set('e', evento.id);
  if (api.modoDemo) url.searchParams.set('demo', '');
  return url.toString();
}

function dibujarQr(texto) {
  const lienzo = $('#qr');
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.textAlign = 'center';
  if (typeof qrcode !== 'function') {
    ctx.fillStyle = '#b00030';
    ctx.font = 'bold 28px system-ui';
    ctx.fillText('No se pudo generar el QR (sin internet).', lienzo.width / 2, 320);
    return;
  }
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const modulos = qr.getModuleCount();
  const tam = Math.floor((lienzo.width - 80) / modulos);
  const inicio = Math.floor((lienzo.width - tam * modulos) / 2);
  ctx.fillStyle = '#000';
  for (let f = 0; f < modulos; f++) {
    for (let c = 0; c < modulos; c++) {
      if (qr.isDark(f, c)) ctx.fillRect(inicio + c * tam, inicio + f * tam, tam, tam);
    }
  }
  ctx.fillStyle = '#24123a';
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillText(`${evento.emoji} ${evento.titulo}`.slice(0, 32), lienzo.width / 2, lienzo.width + 30);
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText('Escaneá, girá la ruleta y subí tu foto', lienzo.width / 2, lienzo.width + 72);
}

$('#btn-descargar-qr').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `QR_${evento.id}.png`;
  a.href = $('#qr').toDataURL('image/png');
  a.click();
});

$('#btn-copiar').addEventListener('click', async () => {
  const boton = $('#btn-copiar');
  try {
    await navigator.clipboard.writeText(enlaceDelEvento());
    boton.textContent = '¡Copiado!';
  } catch {
    boton.textContent = 'No se pudo copiar';
  }
  setTimeout(() => { boton.textContent = 'Copiar enlace'; }, 2000);
});

/* ---------- Moderación ---------- */

const AYUDAS = {
  pendiente: 'Fotos que esperan tu aprobación. No aparecen en la galería hasta que las publiques.',
  publicada: 'Fotos visibles en la galería.',
  rechazada: 'Fotos que no se muestran en la galería. Siguen guardadas por si cambiás de idea.',
};

function seleccionarPestana(estado) {
  estadoActual = estado;
  document.querySelectorAll('.pestanas [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.estado === estado)));
  $('#ayuda-fotos').textContent = AYUDAS[estado];
  cargarFotos(true);
}
document.querySelectorAll('.pestanas [role=tab]').forEach(b => b.addEventListener('click', () => seleccionarPestana(b.dataset.estado)));

function tarjetaFoto(foto) {
  const li = document.createElement('li');
  const enlace = Object.assign(document.createElement('a'), { href: api.urlFoto(foto, 1600), target: '_blank', rel: 'noopener' });
  const img = Object.assign(document.createElement('img'), { loading: 'lazy', alt: `Foto del desafío ${foto.desafioNombre}`, src: api.urlFoto(foto, 400) });
  enlace.append(img);
  const texto = document.createElement('p');
  texto.textContent = `${foto.desafioNombre} · ${formatoFecha.format(new Date(foto.fecha))}`;
  const botones = document.createElement('div');
  botones.className = 'botones';
  const acciones = {
    pendiente: [['Publicar', 'publicada', 'btn-publicar'], ['Ocultar', 'rechazada', 'btn-rechazar']],
    publicada: [['Ocultar', 'rechazada', 'btn-rechazar']],
    rechazada: [['Publicar', 'publicada', 'btn-publicar']],
  }[estadoActual];
  for (const [etiqueta, nuevoEstado, clase] of acciones) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: clase, textContent: etiqueta });
    b.addEventListener('click', async () => {
      botones.querySelectorAll('button').forEach(x => { x.disabled = true; });
      try {
        await api.moderar(evento.id, clave, foto.id, nuevoEstado);
        li.remove();
        if (!$('#lista-fotos').children.length) cargarFotos(true);
      } catch (err) {
        mostrarError('#error-fotos', err);
        botones.querySelectorAll('button').forEach(x => { x.disabled = false; });
      }
    });
    botones.append(b);
  }
  li.append(enlace, texto, botones);
  return li;
}

async function cargarFotos(reiniciar) {
  const lista = $('#lista-fotos');
  mostrarError('#error-fotos', null);
  try {
    const pagina = await api.listar(evento.id, clave, estadoActual, reiniciar ? 0 : siguiente);
    if (reiniciar) lista.replaceChildren();
    lista.append(...pagina.fotos.map(tarjetaFoto));
    siguiente = pagina.siguiente;
    if (!lista.children.length) lista.innerHTML = '<li class="lista-vacia">No hay fotos acá.</li>';
  } catch (err) {
    mostrarError('#error-fotos', err);
  }
  $('#btn-mas').hidden = siguiente === null;
}
$('#btn-mas').addEventListener('click', () => cargarFotos(false));

/* ---------- Descargar todas ---------- */

async function todasLasFotos(estado) {
  const fotos = [];
  let desde = 0;
  do {
    const pagina = await api.listar(evento.id, clave, estado, desde);
    fotos.push(...pagina.fotos);
    desde = pagina.siguiente;
  } while (desde !== null);
  return fotos;
}

$('#btn-zip').addEventListener('click', async () => {
  const boton = $('#btn-zip');
  const estado = $('#estado-zip');
  if (typeof JSZip !== 'function') { estado.textContent = 'No se pudo cargar el compresor (sin internet).'; return; }
  boton.disabled = true;
  try {
    const zip = new JSZip();
    const carpetas = { publicada: 'publicadas', pendiente: 'pendientes', rechazada: 'ocultas' };
    let hechas = 0;
    let fallidas = 0;
    for (const [estadoFoto, carpeta] of Object.entries(carpetas)) {
      const fotos = await todasLasFotos(estadoFoto);
      for (const foto of fotos) {
        estado.textContent = `Descargando foto ${++hechas}…`;
        try {
          const respuesta = await fetch(api.urlFoto(foto, 1600));
          if (!respuesta.ok) throw new Error(respuesta.status);
          const fecha = foto.fecha.slice(0, 19).replace(/[T:]/g, '-');
          zip.file(`${carpeta}/${fecha}_${foto.desafioId}_${foto.id.slice(0, 8)}.jpg`, await respuesta.blob());
        } catch {
          fallidas++;
        }
      }
    }
    if (!hechas) { estado.textContent = 'Todavía no hay fotos para descargar.'; return; }
    estado.textContent = 'Armando el archivo .zip…';
    const contenido = await zip.generateAsync({ type: 'blob' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(contenido), download: `Fotos_${evento.id}.zip` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    const fotos = n => (n === 1 ? '1 foto' : `${n} fotos`);
    estado.textContent = fallidas
      ? `Listo: ${fotos(hechas - fallidas)}. ${fallidas} no se pudieron bajar; probá de nuevo.`
      : `Listo: ${fotos(hechas)} en el archivo.`;
  } catch (err) {
    estado.textContent = `No se pudo armar la descarga: ${err.message}`;
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Inicio ---------- */

try {
  const guardada = sessionStorage.getItem(CLAVE_SESION);
  if (guardada) entrar(guardada).catch(() => sessionStorage.removeItem(CLAVE_SESION));
} catch { /* sin almacenamiento */ }
