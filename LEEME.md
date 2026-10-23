# Ruleta de desafíos del cumpleaños

Web para invitados: escanean el QR, giran la ruleta, les toca un desafío fotográfico, sacan o eligen la foto, la confirman y queda guardada en la página (Vercel Blob) y publicada en la galería del cumple.

**Flujo:** QR → cumpleaños → girar ruleta → desafío → sacar/elegir foto → vista previa → subir → galería.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La web de los invitados (ruleta, desafío, subida y galería). |
| `admin.html` | Panel del organizador: crear cumpleaños, código QR, moderar y descargar fotos. |
| `js/desafios.js` | **Los desafíos.** Para agregar uno nuevo, sumalo al final con un `id` nuevo. |
| `js/ruleta.js` | La ruleta como componente independiente (se puede usar en otras webs). |
| `api/` | El servidor (funciones de Vercel) que guarda las fotos en Vercel Blob. |

## Probarlo sin publicar (modo demostración)

Agregá `?demo` a la dirección y todo queda guardado en ese navegador:

- Invitados: `index.html?demo&e=demo` (publicación automática) o `index.html?demo&e=demo-moderado` (con moderación).
- Panel: `admin.html?demo`, clave `demo`.
- `&fallar=1` hace fallar la primera subida, para ver el mensaje de error y el botón Reintentar.

## Publicar en Vercel (una sola vez)

### 1. Instalar Node
Bajalo de **nodejs.org**, la versión que dice **LTS**, e instalalo con "Siguiente → Siguiente".

### 2. Subir el proyecto
Abrí una terminal en la carpeta `Presupuesto` y ejecutá:

```bash
npx vercel cumple
```

- La primera vez pide iniciar sesión en Vercel (se abre el navegador).
- Cuando pregunte, respondé: *Set up and deploy?* → **Y**. *Link to existing project?* → **N**. Nombre del proyecto: por ejemplo **cumple-ruleta**. *In which directory is your code located?* → dejá `./` y apretá Enter.

### 3. Crear el almacenamiento de fotos (Blob)
1. Entrá a **vercel.com**, abrí el proyecto **cumple-ruleta** y andá a la pestaña **Storage**.
2. Tocá **Create Database** (o **Create**), elegí **Blob** y tocá **Continue**.
3. Ponele un nombre (por ejemplo `fotos-cumples`). Si pregunta el tipo de acceso, elegí **Public**.
4. Tocá **Create** y después **Connect** al proyecto. Vercel agrega solo la clave `BLOB_READ_WRITE_TOKEN`.

### 4. Poner la clave del panel
1. En el proyecto: **Settings → Environment Variables**.
2. Agregá una variable con nombre **`CLAVE_ADMIN`**. En el valor poné una clave que inventes, larga y difícil de adivinar. Guardala: es la que vas a usar para entrar a `admin.html`.
3. Tocá **Save**.

### 5. Publicar la versión final
De nuevo en la terminal:

```bash
npx vercel cumple --prod
```

Al terminar muestra la dirección, por ejemplo `https://cumple-ruleta.vercel.app`.

## Cada cumpleaños nuevo

1. Entrá a `https://<tu-dirección>/admin.html` con la clave `CLAVE_ADMIN`.
2. Tocá **+ Nuevo** y completá: título, subtítulo, fecha, emoji, colores, si las fotos se publican **al instante** o **después de aprobarlas**, y qué desafíos entran en la ruleta.
3. Tocá **Guardar**. Aparece el **código QR** único de ese cumple: **Descargar QR** para imprimirlo.
4. Después de la fiesta: **Descargar todas** baja un `.zip` con todas las fotos, separadas en publicadas, pendientes y ocultas.
5. Para cerrar un evento: **Editar** → desmarcá "Recibe fotos".

## Moderación

- **Al instante:** la foto se ve en la galería apenas se sube. Desde el panel se puede **Ocultar**.
- **Con aprobación:** la foto queda en **Pendientes** hasta que tocás **Publicar**.
- Las fotos ocultas no se borran: siguen guardadas y se pueden volver a publicar.

## Cómo funciona por dentro

- **Ruleta justa:** primero se elige el desafío al azar (generador seguro del navegador, sin sesgo) y la animación se calcula para frenar en el centro de esa porción, nunca sobre una línea. El resultado aparece recién cuando la ruleta se detiene.
- **Recargar la página:** cada invitado tiene un identificador de sesión guardado en el celular. Si recarga, vuelve al mismo paso, con el mismo desafío y la misma foto.
- **Sin duplicados:** cada foto lleva un identificador de subida. Si se corta la conexión y se reintenta, el servidor reconoce la foto y no la guarda dos veces.
- **Datos de cada foto** (`cumples/<evento>/subidas/<id>.json` en Blob): evento, id y nombre del desafío, fecha de subida, sesión y estado.
- Las fotos se achican en el celular (1600 px más una miniatura de 480 px) antes de subirse, para que sea rápido con el wifi de la fiesta y la galería cargue liviana.
- Los desafíos con contacto físico avisan que se hacen solo con consentimiento. "Con el borracho" aclara que es opcional y que no hace falta tomar alcohol. Siempre se puede volver a girar o subir una foto libre.

## Límites a tener en cuenta

- El plan gratuito de Vercel tiene un tope de espacio y de tráfico por mes para Blob. Cada foto ocupa unos 300 KB. Revisá el uso en **Storage** del proyecto y descargá y borrá los eventos viejos si hace falta.
- La galería no pide contraseña: la ve cualquiera que tenga el QR. Las fotos pendientes no aparecen en la galería y su dirección no se puede adivinar.
- Para cambiar los textos o los desafíos, editá los archivos y volvé a ejecutar `npx vercel cumple --prod`.
