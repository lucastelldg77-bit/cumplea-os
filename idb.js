// Almacenamiento mínimo en IndexedDB para guardar fotos (Blob) en el celular.
// Si el navegador no lo permite (modo privado, etc.) las funciones fallan sin romper la app.

const BASE = 'cumple';
const ALMACENES = ['borradores', 'demo'];
let abierta;

function abrir() {
  if (!abierta) {
    abierta = new Promise((resolver, rechazar) => {
      const pedido = indexedDB.open(BASE, 1);
      pedido.onupgradeneeded = () => {
        for (const nombre of ALMACENES) {
          if (!pedido.result.objectStoreNames.contains(nombre)) pedido.result.createObjectStore(nombre);
        }
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => rechazar(pedido.error);
    });
    abierta.catch(() => { abierta = null; });
  }
  return abierta;
}

async function operar(almacen, modo, fn) {
  const base = await abrir();
  return new Promise((resolver, rechazar) => {
    const tx = base.transaction(almacen, modo);
    const pedido = fn(tx.objectStore(almacen));
    tx.oncomplete = () => resolver(pedido && pedido.result);
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error);
  });
}

export const leer = (almacen, clave) => operar(almacen, 'readonly', s => s.get(clave));
export const leerTodo = almacen => operar(almacen, 'readonly', s => s.getAll());
export const guardar = (almacen, clave, valor) => operar(almacen, 'readwrite', s => s.put(valor, clave));
export const borrar = (almacen, clave) => operar(almacen, 'readwrite', s => s.delete(clave));
