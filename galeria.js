// Galería estilo Instagram: perfil del cumpleaños, grilla de 3 columnas y visor a pantalla completa.

const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

export function crearGaleria(raiz, { api, evento }) {
  let fotos = [];
  let total = 0;
  let siguiente = 0;
  let cargando = false;
  let abierta = -1;

  raiz.innerHTML = `
    <div class="perfil">
      <div class="perfil-avatar" aria-hidden="true"><span></span></div>
      <div class="perfil-datos">
        <p class="perfil-nombre"></p>
        <p class="perfil-cuenta"><strong data-total>0</strong> <span data-unidad>fotos</span></p>
      </div>
      <button type="button" class="boton-icono" data-actualizar aria-label="Actualizar galería">↻</button>
    </div>
    <p class="galeria-vacia" hidden>Todavía no hay fotos. ¡Sé la primera persona en cumplir un desafío!</p>
    <p class="mensaje-error" role="alert" hidden></p>
    <ul class="grilla" aria-label="Fotos del cumpleaños"></ul>
    <button type="button" class="boton boton-secundario" data-mas hidden>Ver más fotos</button>
    <dialog class="visor" aria-label="Foto ampliada">
      <button type="button" class="visor-cerrar" aria-label="Cerrar">✕</button>
      <button type="button" class="visor-flecha anterior" aria-label="Foto anterior">‹</button>
      <img alt="">
      <button type="button" class="visor-flecha siguiente" aria-label="Foto siguiente">›</button>
      <p class="visor-pie"></p>
    </dialog>`;

  const $ = sel => raiz.querySelector(sel);
  $('.perfil-avatar span').textContent = evento.emoji;
  $('.perfil-nombre').textContent = evento.titulo;
  const grilla = $('.grilla');
  const visor = $('.visor');
  const error = $('.mensaje-error');

  function pie(foto) {
    const hora = formatoHora.format(new Date(foto.fecha));
    return foto.desafioId === 'libre' ? `📸 Foto libre · ${hora}` : `🎯 Desafío: ${foto.desafioNombre} · ${hora}`;
  }

  // Si la miniatura no carga, se muestra la foto completa.
  function conRespaldo(img, foto, ancho) {
    if (ancho > 600) return;
    img.onerror = () => {
      img.onerror = null;
      img.src = api.urlFoto(foto, 1600);
    };
  }

  function dibujar() {
    $('[data-total]').textContent = total;
    $('[data-unidad]').textContent = total === 1 ? 'foto' : 'fotos';
    $('.galeria-vacia').hidden = fotos.length > 0 || cargando;
    $('[data-mas]').hidden = siguiente === null;
    grilla.replaceChildren(...fotos.map((foto, i) => {
      const li = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'grilla-foto';
      boton.setAttribute('aria-label', `Abrir foto: ${pie(foto)}`);
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      img.src = api.urlFoto(foto, 600);
      conRespaldo(img, foto, 600);
      boton.append(img);
      boton.addEventListener('click', () => abrir(i));
      li.append(boton);
      return li;
    }));
  }

  async function cargar(reiniciar) {
    if (cargando || (!reiniciar && siguiente === null)) return;
    cargando = true;
    error.hidden = true;
    try {
      const pagina = await api.galeria(evento.id, reiniciar ? 0 : siguiente);
      fotos = reiniciar ? pagina.fotos : fotos.concat(pagina.fotos);
      total = pagina.total;
      siguiente = pagina.siguiente;
    } catch (err) {
      Object.assign(error, { textContent: `No pudimos cargar la galería. ${err.message}`, hidden: false });
    } finally {
      cargando = false;
      dibujar();
    }
  }

  function abrir(i) {
    abierta = i;
    const foto = fotos[i];
    const img = visor.querySelector('img');
    img.src = api.urlFoto(foto, 1600);
    conRespaldo(img, foto, 1600);
    img.alt = pie(foto);
    visor.querySelector('.visor-pie').textContent = pie(foto);
    visor.querySelector('.anterior').disabled = i === 0;
    visor.querySelector('.siguiente').disabled = i === fotos.length - 1;
    if (!visor.open) visor.showModal();
  }
  const mover = paso => { const i = abierta + paso; if (i >= 0 && i < fotos.length) abrir(i); };

  visor.querySelector('.visor-cerrar').addEventListener('click', () => visor.close());
  visor.querySelector('.anterior').addEventListener('click', () => mover(-1));
  visor.querySelector('.siguiente').addEventListener('click', () => mover(1));
  visor.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') mover(-1);
    if (e.key === 'ArrowRight') mover(1);
  });
  // Deslizar con el dedo para pasar de foto.
  let inicioX = null;
  visor.addEventListener('pointerdown', e => { inicioX = e.clientX; });
  visor.addEventListener('pointerup', e => {
    if (inicioX === null) return;
    const dx = e.clientX - inicioX;
    inicioX = null;
    if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
  });
  visor.addEventListener('click', e => { if (e.target === visor) visor.close(); });

  $('[data-mas]').addEventListener('click', () => cargar(false));
  $('[data-actualizar]').addEventListener('click', () => cargar(true));

  cargar(true);
  return { recargar: () => cargar(true) };
}
