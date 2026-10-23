// Achica la foto en el celular antes de subirla: sube más rápido con el wifi de la fiesta
// y siempre llega como JPEG (también las HEIC del iPhone). Además arma una miniatura para la galería.

const LADO_FOTO = 1600;
const LADO_MINI = 480;

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('imagen ilegible')); };
    img.src = url;
  });
}

async function redimensionar(img, ladoMaximo, calidad) {
  const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', calidad));
  if (!blob) throw new Error('No pudimos procesar esa foto. Probá con otra.');
  return blob;
}

/** Devuelve { blob, mini }: la foto para guardar y su miniatura. */
export async function prepararFoto(archivo) {
  if (!archivo || !/^image\//.test(archivo.type || 'image/')) {
    throw new Error('Ese archivo no es una foto. Elegí una imagen.');
  }
  let img;
  try {
    img = await cargarImagen(archivo);
  } catch {
    throw new Error('No pudimos abrir esa foto. Probá con otra o sacala de nuevo.');
  }
  return {
    blob: await redimensionar(img, LADO_FOTO, 0.84),
    mini: await redimensionar(img, LADO_MINI, 0.78),
  };
}
