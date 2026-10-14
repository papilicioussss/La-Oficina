# Oficina 3D · Etapa 2 (estructura)

Página independiente con las cinco salas de La Oficina en 3D, hechas con piezas LEGO por código (Three.js r186, copiado en `vendor/`, sin internet). La oficina SVG de la app sigue siendo la principal: esta carpeta no importa ni modifica nada de `js/`, `css/` ni `index.html`.

- **Abrir:** `https://papilicioussss.github.io/La-Oficina/oficina-3d/` (cuando esté publicada) o, en local, `python3 -m http.server 8123` en la raíz del repositorio y abrir `http://localhost:8123/oficina-3d/`.
- **Parámetros:** `?calidad=alta|media|baja` fija la calidad (sin parámetro es automática) · `?depurar=1` muestra las guías y la figura gris de referencia.
- **Controles:** arrastrar para girar · rueda o pellizco para acercar · dos dedos o clic derecho para mover. Los botones del panel enfocan cada sala.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Página, panel y aviso de respaldo (sin WebGL, error de carga o pérdida del contexto gráfico) |
| `main.js` | Renderizador, luces, armado de la escena, dibujo bajo demanda, calidad y gancho `window.oficina3d` para pruebas |
| `plano.js` | **Copia** de los datos de `js/office.js` (salas, asientos, rutas, tabiques, obstáculos…), puertas, paredes, muebles y la **única conversión de coordenadas** |
| `calidad.js` | Niveles Alta / Media / Baja y calidad automática |
| `camara.js` | Vista isométrica, límites, enfoque de salas, reencuadre al cambiar el tamaño |
| `registro.js` | Registro de modelos por nombre (código hoy, `.glb` mañana) y liberación de memoria |
| `salas.js` | Arma las cinco salas con los muebles del plano |
| `depuracion.js` | Guías de depuración y figura gris de referencia |
| `materiales.js` | Plásticos con caché (copiado y ampliado de `prueba-3d/`) |
| `ladrillos.js` | Ladrillos, placas, taquitos instanciados, fusión de geometrías (copiado y ampliado de `prueba-3d/`) |
| `texturas.js` | Texturas dibujadas en el navegador (letrero, playa, gráfico, pantallas) y el logo de `assets/` |
| `componentes/suelos.js` | Losa, pisos de cada sala, alfombras con taquitos y umbrales de puertas |
| `componentes/paredes.js` | Paredes de ladrillo trabado, ventana, tabiques con puertas y ocultado de paredes |
| `componentes/muebles.js` | Muebles y objetos provisionales (registrados por nombre) |
| `componentes/decoracion.js` | Letrero, ventana con playa, tablero, pantalla con gráfico y corcho con notas |
| `pruebas/coherencia.mjs` | Compara `plano.js` con `js/office.js` (lo lee como texto) |
| `pruebas/navegador.mjs` | Pruebas en navegador sin pantalla: salas, puertas, calidad, cámara, paredes, celular, respaldo |
| `vendor/three/` | Three.js r186 y los cuatro complementos que se usan (OrbitControls, RoomEnvironment, RoundedBoxGeometry, BufferGeometryUtils) |

## Coordenadas

Todo pasa por `plano.js`: `mundo.x = plano.x × 2`, `mundo.z = plano.y × 2` (1 unidad del plano = 2 taquitos). La unidad del mundo es un taquito (8 mm); un ladrillo mide 1.2 de alto y una placa 0.4. Las alturas se definen en `ALTURAS` con medidas LEGO reales (paredes de 8 hileras, tabiques de 2, minifigura de 5.0).

Si cambia el plano de la oficina SVG, hay que actualizar `plano.js`; `pruebas/coherencia.mjs` avisa de cualquier diferencia.

## Modelos y archivos .glb

Cada mueble se pide por nombre: `crearModelo('silla', { color })`. La escena no sabe cómo se fabrica.

- **Registrar:** `registrarModelo(nombre, fabrica, { medida, anclas, escala, giro, fija })`. La fábrica recibe las opciones del plano (color, logo, w, d…) y devuelve un `Object3D` con el origen en el centro de la base y el frente hacia +z.
- **Escala y orientación:** modelar en Blender con 1 unidad = 1 taquito, origen en el centro de la base y el frente hacia +Y de Blender (el exportador glTF lo convierte en +Z). Si no coincide, se corrige con `escala` y `giro` (grados) al registrar.
- **Anclas:** objetos vacíos (Empty) llamados `ancla_superficie`, `ancla_asiento`, etc. Se leen solos con `anclasDesde()`. Sin ancla en el archivo se usa la del registro.
- **Reemplazar por un .glb:** copiar `GLTFLoader.js` de Three.js r186 a `vendor/three/addons/loaders/`, cargar el archivo antes de armar la escena y registrar `() => gltf.scene.clone(true)` con el mismo nombre. Si el modelo se va a mover o animar, registrarlo con `fija: false` para que no se fusione con la sala. No hace falta compresión.
- **Liberar memoria:** `liberarObjeto(objeto)` libera las geometrías y texturas propias; los materiales de la caché y las geometrías compartidas están marcados y no se liberan ahí (`liberarTodo()` y `liberarTexturas()` al cerrar la escena).

## Rendimiento

- La escena es fija: se dibuja **solo cuando algo cambia** (cámara, paredes, calidad). Las sombras se recalculan solo cuando cambian.
- Las piezas fijas se **fusionan por tipo de plástico** con el color en cada vértice, y todos los taquitos de un grupo van en **una malla instanciada** con color por instancia.
- Paredes y pisos tienen dos versiones (biselada para Alta, caja simple para Media y Baja) y los taquitos dos geometrías (16 y 8 lados); la calidad elige sin reconstruir.
- Calidad automática: empieza prudente (celular → Media) y baja un nivel solo después de unos 6 s seguidos por debajo de 26 fps mientras se mueve la cámara; nunca sube sola.

## Pruebas

```
python3 -m http.server 8123          # en la raíz del repositorio
node oficina-3d/pruebas/coherencia.mjs
node oficina-3d/pruebas/navegador.mjs   # usa el Playwright instalado en el equipo (variable PLAYWRIGHT) y guarda capturas en CAPTURAS
```
