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

# Etapa 3 · Personajes (fases 1 a 5, aisladas)

Los tres agentes (Nico, Alex y Sam) aparecen como minifiguras sentadas en su oficina, con su ropa y accesorios, y reflejan los estados de la app. **En esta etapa los estados vienen de un simulador**: la página `oficina-3d/` no está conectada a la app (eso es la fase 6, con autorización aparte).

- **Ver los estados:** `?simular=1` muestra el panel del simulador (Nico responde, Alex busca, error, detener, los tres a la vez, reunión, investigación, plan, terminar reunión).
- **Sombras reales de los personajes:** casilla del panel o `?sombras=reales` (solo en calidad Alta; por defecto, sombras de contacto).

## Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `personajes/minifigura.js` | Minifigura de la prueba (copiada) con postura sentada, versión liviana y señal del kit; se registra como modelo `minifigura` |
| `personajes/cara.js` | Cara estampada (copia sin cambios de `prueba-3d/cara.js`) |
| `personajes/accesorios.js` | Peinados (`hair()`) y kits (`kitParts()`) de la oficina SVG en 3D: sudaderas, saco, gorra, audífonos, lentes, libreta, tableta, tarjetas y señales (bombillo, lupa, ✓) |
| `personajes/nico.js` | Nico como minifigura LEGO real (modelo propio `nico`): piezas, ropa impresa, pelo esculpido, capucha, utilería y sus acciones |
| `personajes/cara-nico.js` | Cara de Nico al estilo de las caras LEGO, redibujable con todas sus expresiones |
| `personajes/apariencia.js` | Apariencia por defecto (copiada de `js/store.js`) y, si existe, la guardada por la app (solo lectura) |
| `agentes.js` | Controla a los tres: estados → animación, "Escribiendo…", gesto de terminado, caminatas, miradas en reunión, señales, selección |
| `fuente-estados.js` | Única entrada de estados (misma forma que `js/state.js`: `runtime`, `on('status')`, `on('chat')`, `chat(id)`) |
| `simulador.js` | Herramienta de prueba que reproduce las secuencias reales de `conversation.js` y `meeting.js` |
| `etiquetas.js` | Nombres y globos en HTML sobre el lienzo, con los textos exactos de la app |
| `pruebas/personajes.mjs` | Pruebas de las fases 1 a 5 y de Nico (`FASES=1,2,3,4,5,nico`) |

## Reglas que replica (de `js/office.js`, sin inventar estados)

- `thinking` → teclea y "Pensando…"; "Escribiendo…" solo durante 700 ms después de cada trozo de texto real.
- `searching` → busca y "Buscando en la web…"; `talking` → habla y "Hablando…".
- Gesto de terminado (1,7 s) solo al pasar de `thinking`/`searching` a `idle`/`meeting` con respuesta correcta; con error o sin texto, nada. Si arranca otro trabajo real, manda el trabajo.
- Globo oculto en reposo, al caminar y en reunión sin hablar. Pantalla de Alex encendida solo mientras Alex trabaja.
- Caminatas: la ubicación (`runtime.location`) se lee en cada cuadro; la caminata dura lo mismo que en el SVG (`max(250 ms, distancia / 5 s)` por tramo), aunque el recorrido 3D tenga puntos de paso extra (`ACCESO_3D` en `plano.js`) para no atravesar escritorios ni sillas.
- Reunión: quien habla mira a los demás; los demás lo miran (`escucha`). Movimiento reducido: sin caminatas ni oscilaciones; el estado se ve igual.

## Qué reproduce el simulador y qué no

Reproduce, en el mismo orden, los `setStatus`, los eventos `chat` y los cambios de ubicación de `sendToAgent()`/`runAgent()` (pensar, buscar, escribir, error, respuesta vacía, detener con y sin texto) y de `runSession()`/`endMeeting()` (llegada, investigación, turnos en orden, plan, pausa, fin, agente ocupado al convocar).

**No puede verificar hasta la fase 6:** tiempos y textos reales de la IA, errores reales de red o cuota, el chat real en paralelo, y que la app emita exactamente estos eventos en un navegador real.

## Rendimiento

- Ritmo de dibujo: cada cuadro si algún agente hace algo real o se mueve la cámara; máximo 30 cuadros por segundo si solo respiran; pausa total tras 20 s sin actividad (se reanuda con un toque o con un cambio de estado real).
- Piezas de cada articulación juntas por tipo de plástico (~14 llamadas por personaje); versión liviana en Media y Baja (~2.600 triángulos frente a ~11.300).
- Las caminatas avanzan con el tiempo real (no se atrasan si un cuadro llega tarde); las posturas usan un paso recortado.

## Interfaz de un personaje (para un futuro .glb)

Un modelo de personaje debe entregar en `objeto.userData.personaje`: `animar(estado, t, dt)`, `sentar(si, inmediato)`, `sentado()`, `mirarA(punto)`, `reposo()`, `cabeza` (Object3D), `senal` (Object3D), `ritmoTecleo` y `liberar()`. Los estados son `idle | thinking | searching | talking | walking | escucha | terminado`.

# Nico como minifigura LEGO real (modelo propio)

Nico (copywriter) tiene su propio modelo, `personajes/nico.js`, hecho como una **minifigura LEGO real**: piezas, proporciones y articulaciones auténticas, con la ropa **impresa** y los accesorios como piezas aparte. Se basó en su hoja de referencia, en fotos de minifiguras reales (anatomía) y en el `.glb` de Meshy que mandó el equipo, que no se usa directamente: viene fundido en una sola pieza (sin esqueleto ni animaciones), pesa ~141 mil triángulos y trae la cara pintada. Alex y Sam siguen con la minifigura general.

- **Piezas** (1 = un taquito = 8 mm; 4,8 de alto como una minifigura real):
  - cabeza de 1,2 × 1,1 con bordes redondeados, cuello y taquito arriba;
  - torso en trapecio (2,0 abajo y 1,5 en los hombros, 1,6 de alto, frente y espalda planos);
  - brazos rígidos con hombro redondeado al costado del torso y codo doblado fijo; manos en C con muñeca;
  - cadera con eje y entrepierna;
  - piernas con el perfil real: pie adelantado, tope redondeado y dos huecos redondos atrás.
- **Ropa impresa** (una sola imagen compartida, `atlas()`): sudadera con capucha, cordones, bolsillo canguro y franela; pretina; pantalón cargo con camuflaje y bolsillos; zapatillas impresas en los pies. Cada parte se proyecta como calcomanía según hacia dónde mira (frente, espalda, costado).
- **Pelo** (pieza aparte, moldeada como el pelo LEGO): casco hueco cuya superficie está esculpida en 11 mechones gruesos y redondeados que nacen en la coronilla y bajan con un barrido, con surcos entre ellos y vetas finas en Alta; cada mechón termina en punta en el borde. El flequillo queda arriba de las cejas, los lados a media cara y la nuca hasta el cuello. Por dentro es liso y más grande que la cabeza: no la atraviesa.
- **Capucha** (pieza accesorio, como en la hoja de referencia): un rollo que rodea el cuello por los lados y por detrás (abierto adelante, donde se ven la franela y los cordones), grueso y redondo detrás de la nuca, y la capucha que cae sobre la espalda con volumen y termina en punta. Va por fuera de todo: la prueba "la capucha no atraviesa" revisa en todas las acciones (sentado y parado) que deje libres la cabeza, el pelo y los brazos.
- **Accesorios** (piezas aparte): libreta abierta y bolígrafo.
- **Articulaciones: solo las reales.** La cabeza gira a los lados, cada brazo gira en el hombro (adelante y atrás), cada mano gira en su muñeca y cada pierna gira en la cadera. La figura completa puede saltar, rebotar, girar e inclinarse entera, como en stop-motion. Nada se dobla ni se abre hacia los lados; mirar arriba o abajo lo hacen los ojos de la cara impresa. La prueba "LEGO estricto" lo verifica en todas las acciones.
- **Cara** (`personajes/cara-nico.js`): pegatina redibujable al estilo de las caras LEGO (cejas finas, ojos negros con brillito, boca de trazo fino, sonrisa con contorno negro y dientes blancos, marquita en la mejilla) con ojos felices (^ ^), boca en "O", dientes, lengüita de concentración, boca de lado, cachetes rosados, parpadeo y sílabas al hablar.
- **Peso:** ~21 mil triángulos y 17 llamadas de dibujo en Alta; ~4,5 mil triángulos en Media y Baja (la escena completa: 110 llamadas y ~219 mil triángulos en Alta, ~103 mil en Media).
- **La apariencia personalizada de la app** (color de camisa, peinado) no cambia el modelo de Nico, que sigue la hoja de referencia; el nombre y el color de su placa sí se leen de la app.

## Acciones de Nico (dentro de los estados reales; no inventan estados)

| Estado de la app | Lo que hace Nico |
|---|---|
| `thinking` ("Pensando…") | teclea → se queda pensando (mano levantada junto a la cara, mira arriba) → **idea** (ojos grandes, boca en "O", brazo arriba y un salto, el bombillo late) → **anota en la libreta** con lengüita afuera → vuelve a teclear |
| `thinking` con texto llegando ("Escribiendo…") | deja lo que esté haciendo (guarda la libreta) y teclea rápido, concentrado |
| `searching` | se inclina entero hacia la pantalla, gira la cabeza de lado a lado, gira la mano y hace clic |
| `talking` | gestos con los brazos y giros de muñeca, rebotes cortos en los acentos, boca por sílabas (a veces en "O") con pausas entre frases; a veces consulta la libreta |
| escuchando en reunión | gira la cabeza hacia quien habla y "asiente" con toda la figura; a veces toma notas y levanta la vista hacia quien habla |
| reposo | respira, parpadea (a veces doble), mira alrededor; de vez en cuando se pasa la mano por el pelo, saluda, se estira y bosteza, tamborilea o repasa la libreta |
| terminado bien (1,7 s) | alterna puño arriba con salto y los dos brazos arriba, con ojos felices y cachetes rosados |
| caminar | piernas y brazos alternados con cadencia según la velocidad real, rebote y balanceo de toda la figura; arranca y frena con rampa (la duración total sigue siendo la del SVG) |

Movimiento reducido: postura fija del estado, sin utilería ni oscilaciones. Las acciones se mezclan con fundidos (postura con resortes amortiguados y oscilaciones que entran y salen suavemente), así no hay saltos al cambiar.

Pruebas: `FASES=nico node oficina-3d/pruebas/personajes.mjs` (incluidas por defecto).
