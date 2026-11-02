# Fotografía de portada

La portada (`src/pages/Landing.tsx`) usa la fotografía local de esta carpeta:

    portada.jpg

Vite la incluye en el build (se publica como un recurso con nombre con hash): **no depende de ninguna URL externa**.
Si el archivo no existe, la portada vuelve a mostrarse sin fotografía (con el trazo curvo decorativo).
El código acepta también `portada.jpeg`, `.webp`, `.avif` o `.png` con ese mismo nombre base.

## Registro de origen y licencia

| Campo | Valor |
|---|---|
| Título en Pexels | «Elegant Ballet Dancer Performing an Artistic Pose» (ID 30826710) |
| Descripción de la página | Bailarina de ballet con vestido blanco en una pose artística sobre fondo oscuro |
| Autor/a | Đậu Photograph — https://www.pexels.com/@dauphotographer/ |
| Fuente | Pexels |
| URL de origen | https://www.pexels.com/photo/elegant-ballet-dancer-performing-an-artistic-pose-30826710/ |
| Licencia | Licencia de Pexels (la página de la foto indica «License: Free» y enlaza a https://www.pexels.com/license/) |
| Verificación de la licencia | Se leyeron la página de la foto y la página de la licencia de Pexels el 29/10/2026. |
| Archivo local | `frontend/src/assets/hero/portada.jpg` |
| Origen del archivo | Descargado por el responsable del proyecto desde Pexels como `pexels-dauphotographer-30826710.jpg` y copiado **sin recortes ni retoques**; solo se renombró a `portada.jpg`. |
| Características del archivo | JPEG, 1714 × 2576 px (vertical, 2:3), 204 KB |
| ¿Exige atribución? | No. Pexels indica que acreditar al fotógrafo «no es necesario, pero siempre se agradece»; se recomienda hacerlo igualmente. |

**Qué está y qué no está comprobado sobre el archivo.** El nombre del archivo contiene el autor y el ID de la página (30826710), su
proporción es 2:3 como la de la página (que indica 4024 × 6048 px; el archivo es una descarga de menor tamaño) y su contenido coincide
con la descripción de la página (bailarina con vestido blanco, pose artística, fondo oscuro). **No se pudo cotejar byte a byte con
Pexels**: el entorno de desarrollo no tiene acceso a ese sitio. Si hay dudas, volver a descargar la foto desde la URL de origen
y reemplazar `portada.jpg`.

### Resumen de la licencia (según https://www.pexels.com/license/, leída el 29/10/2026)
- Permitido: usar la foto gratis, incluso en sitios web y aplicaciones; modificarla.
- No permitido: mostrar personas identificables de forma negativa u ofensiva; vender copias sin modificar (afiches, impresos);
  sugerir que una persona o marca respalda el producto; redistribuirla o venderla en otras plataformas de fotos o fondos de pantalla;
  usarla como parte de una marca, nombre comercial o nombre de empresa.
- La foto muestra a una persona identificable. En DanceTrack se usa de forma neutral y positiva, como imagen de portada, sin
  sugerir que esa persona respalde el producto.
- Esta lista es un resumen; el texto vigente es el de la página de Pexels.

### Crédito sugerido
Fotografía: Đậu Photograph, vía Pexels.

## Cómo está integrada (para quien mantenga el código)

La foto es vertical (2:3) y la portada es horizontal, por lo que **no se usa como fondo `cover`** (cortaría la cabeza o las piernas).
En `Landing.tsx`:
- **Escritorio y tablet (≥ 768 px):** dos columnas. Texto y botones a la izquierda (54 %); la fotografía **completa** a la derecha
  (46 %), ajustada al alto de la sección con `max-h-full max-w-full` y proporción original (sin deformarla).
- **Móvil (< 768 px):** primero el texto y los botones; la fotografía completa va debajo.
- **Integración con el bordó:** la sección tiene fondo bordó (`bg-wine-800`) y la imagen usa `mix-blend-screen`: el negro de la foto
  toma el color del fondo y el vestido blanco se conserva. Detrás hay una luz de escenario suave (degradado radial bordó) y los bordes
  de la imagen se difuminan con una máscara, para que no quede ningún rectángulo visible.
- Para cambiar la foto: reemplazar `portada.jpg` por otra imagen de fondo oscuro y figura central. Si es horizontal, conviene
  revisar la composición (la columna derecha está pensada para una figura vertical).
