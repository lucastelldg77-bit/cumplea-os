/**
 * Ruleta reutilizable.
 *
 *   const ruleta = crearRuleta(contenedor, {
 *     items: [{ id, nombre }, …],          // una porción por item
 *     alTerminar: (item, indice) => {},     // se llama recién cuando la ruleta se detuvo
 *     centro: '🎂',                         // opcional
 *   });
 *   ruleta.girar();
 *
 * El resultado se elige primero (al azar y en forma pareja entre todos los items)
 * y la animación se calcula para frenar en el centro de esa porción, nunca en un borde.
 */

const COLORES = ['#ff006e', '#fb5607', '#ffbe0b', '#8ac926', '#06d6a0', '#00bbf9', '#3a86ff', '#8338ec', '#f15bb5'];
const SVG = 'http://www.w3.org/2000/svg';
const RADIO = 100;
const LUCES = 18;

/** Entero al azar en [0, n) sin sesgo (descarta los valores que harían el módulo desparejo). */
export function enteroAleatorio(n) {
  const limite = Math.floor(0x100000000 / n) * n;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= limite);
  return buffer[0] % n;
}

function fraccionAleatoria() {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 0x100000000;
}

const modulo = (a, n) => ((a % n) + n) % n;

// Ángulo en grados medido en sentido horario desde arriba.
function punto(angulo, radio) {
  const rad = (angulo * Math.PI) / 180;
  return [radio * Math.sin(rad), -radio * Math.cos(rad)];
}

function crear(tag, atributos = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  return el;
}

function partirEnLineas(texto, maximo = 11) {
  const lineas = [''];
  for (const palabra of texto.split(' ')) {
    const actual = lineas[lineas.length - 1];
    if (actual && (actual + ' ' + palabra).length > maximo) lineas.push(palabra);
    else lineas[lineas.length - 1] = actual ? actual + ' ' + palabra : palabra;
  }
  return lineas.slice(0, 2);
}

function colorDeTexto(fondo) {
  const n = parseInt(fondo.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#2a1638' : '#ffffff';
}

function dibujarDisco(items, colores) {
  const n = items.length;
  const porcion = 360 / n;
  const svg = crear('svg', { viewBox: '-112 -112 224 224', class: 'ruleta-svg', focusable: 'false' });

  svg.appendChild(crear('circle', { r: 110, class: 'ruleta-borde' }));
  items.forEach((item, i) => {
    const color = colores[i % colores.length];
    const desde = i * porcion;
    const hasta = desde + porcion;
    if (n === 1) {
      svg.appendChild(crear('circle', { r: RADIO, fill: color }));
    } else {
      const [x0, y0] = punto(desde, RADIO);
      const [x1, y1] = punto(hasta, RADIO);
      svg.appendChild(crear('path', {
        d: `M0 0 L${x0} ${y0} A${RADIO} ${RADIO} 0 ${porcion > 180 ? 1 : 0} 1 ${x1} ${y1} Z`,
        fill: color, class: 'ruleta-porcion',
      }));
    }
    // El texto va en forma radial, desde el centro hacia el borde.
    const grupo = crear('g', { transform: `rotate(${desde + porcion / 2 - 90})` });
    const texto = crear('text', {
      x: RADIO - 10, 'text-anchor': 'end', class: 'ruleta-texto', fill: colorDeTexto(color),
    });
    const lineas = partirEnLineas(item.nombre);
    lineas.forEach((linea, j) => {
      const tspan = crear('tspan', { x: RADIO - 10, dy: j === 0 ? (lineas.length === 1 ? 3 : -2.5) : 10 });
      tspan.textContent = linea;
      texto.appendChild(tspan);
    });
    grupo.appendChild(texto);
    svg.appendChild(grupo);
  });
  for (let i = 0; i < LUCES; i++) {
    const [x, y] = punto((i * 360) / LUCES, 105.5);
    svg.appendChild(crear('circle', { cx: x, cy: y, r: 2.6, class: `ruleta-luz ${i % 2 ? 'impar' : 'par'}` }));
  }
  return svg;
}

export function crearRuleta(contenedor, opciones) {
  const { items, alTerminar, centro = '★', etiquetaBoton = 'GIRAR RULETA', colores = COLORES } = opciones;
  if (!items || !items.length) throw new Error('La ruleta necesita al menos un item.');

  const n = items.length;
  const porcion = 360 / n;
  let rotacion = 0;
  let girando = false;

  const raiz = document.createElement('div');
  raiz.className = 'ruleta';
  raiz.innerHTML = `
    <div class="ruleta-marco">
      <div class="ruleta-disco" aria-hidden="true"></div>
      <div class="ruleta-puntero" aria-hidden="true"></div>
      <div class="ruleta-centro" aria-hidden="true"></div>
    </div>
    <button type="button" class="boton boton-girar"></button>
    <p class="sr-only" role="status" aria-live="polite"></p>`;
  const disco = raiz.querySelector('.ruleta-disco');
  const boton = raiz.querySelector('.boton-girar');
  const anuncio = raiz.querySelector('[role=status]');
  raiz.querySelector('.ruleta-centro').textContent = centro;
  boton.textContent = etiquetaBoton;
  disco.appendChild(dibujarDisco(items, colores));
  contenedor.replaceChildren(raiz);

  // Qué porción queda bajo el puntero (arriba) para una rotación dada.
  function indiceEnPuntero(grados) {
    return Math.floor(modulo(-grados, 360) / porcion) % n;
  }

  function girar() {
    if (girando) return;
    girando = true;
    boton.disabled = true;
    raiz.classList.add('girando');
    anuncio.textContent = 'Girando la ruleta…';

    const indice = enteroAleatorio(n);
    // Frena dentro del 60 % central de la porción: nunca queda sobre una línea divisoria.
    const desvio = (fraccionAleatoria() * 2 - 1) * porcion * 0.3;
    const destino = modulo(360 - (indice * porcion + porcion / 2) - desvio, 360);
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vueltas = reducido ? 1 : 5 + enteroAleatorio(3);
    const duracion = reducido ? 1200 : 5000 + enteroAleatorio(1200);
    rotacion = rotacion - modulo(rotacion, 360) + (vueltas + 1) * 360 + destino;

    disco.style.transition = `transform ${duracion}ms cubic-bezier(.12,.75,.15,1)`;
    disco.style.transform = `rotate(${rotacion}deg)`;

    let terminado = false;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      disco.removeEventListener('transitionend', alFinalizarTransicion);
      const enPuntero = indiceEnPuntero(rotacion);
      if (enPuntero !== indice) console.error('La ruleta frenó en una porción distinta a la elegida', { indice, enPuntero });
      girando = false;
      boton.disabled = false;
      raiz.classList.remove('girando');
      raiz.classList.add('frenada');
      setTimeout(() => raiz.classList.remove('frenada'), 700);
      anuncio.textContent = `Salió: ${items[indice].nombre}`;
      if (navigator.vibrate) navigator.vibrate(80);
      alTerminar(items[indice], indice);
    };
    const alFinalizarTransicion = e => { if (e.target === disco && e.propertyName === 'transform') terminar(); };
    disco.addEventListener('transitionend', alFinalizarTransicion);
    // Respaldo por si el navegador no dispara transitionend (pestaña en segundo plano, etc.).
    setTimeout(terminar, duracion + 300);
  }

  boton.addEventListener('click', girar);

  return {
    girar,
    get girando() { return girando; },
    enfocar() { boton.focus(); },
    destruir() { raiz.remove(); },
  };
}
