// Biblioteca de habilidades (skills) de marketing de los tres agentes.
// Cada skill es un conjunto de instrucciones profesionales que se cargan SOLO cuando la consulta lo pide.
// kw = palabras que la activan (en minúsculas y sin tildes). core = siempre activa (corta).

export const SKILL_GROUPS = {
  copy: 'Copywriter',
  analista: 'Analista',
  guion: 'Guionista',
};

export const SKILLS = [
  // ============================ BASE (todos los agentes) ============================
  {
    id: 'contexto-ve',
    agents: ['copy', 'analista', 'guion'],
    icon: '🇻🇪',
    name: 'Contexto del turismo en Venezuela',
    desc: 'Cómo compra y decide el viajero venezolano. Siempre activa.',
    core: true,
    kw: [],
    text: `Contexto del viajero y del turismo nacional en Venezuela (úsalo como criterio, sin inventar datos de la marca):
- El comprador viaja casi siempre en grupo (amigos, pareja, familia) y decide por CONFIANZA. Antes de reservar mira testimonios, fotos y videos reales de clientes, quién es el guía y si la agencia responde rápido.
- Sus primeras preguntas son siempre "¿cuánto cuesta?", "¿qué incluye?", "¿desde dónde sale?" y "¿a qué hora regresamos?". El contenido que ya las responde vende más.
- Los precios suelen manejarse en dólares. Muestra siempre el monto por persona, qué incluye y qué no. Los métodos de pago y las políticas son los que estén en la memoria de la marca: no asumas ninguno.
- Frenos habituales: desconfianza hacia agencias nuevas, seguridad, logística (punto de salida, horarios, regreso), clima y estado del mar, mareo en lancha, viajar con niños o mascotas.
- Hay temporadas fuertes: Carnaval, Semana Santa, vacaciones escolares (julio-agosto y fin de año), diciembre-enero y fines de semana largos o feriados. Verifica las fechas del año en la búsqueda.
- Nunca prometas clima, mar en calma ni avistamientos de fauna. Habla de la experiencia que sí controla la agencia.
- El tono cercano y alegre funciona ("vacilar", "chévere"), sin groserías y sin exagerar el slang.`,
  },
  {
    id: 'voz-humana',
    agents: ['copy', 'guion'],
    icon: '🗣️',
    name: 'Voz humana (cero tono de IA)',
    desc: 'Escribir natural, específico y sin muletillas de robot. Siempre activa.',
    core: true,
    kw: [],
    text: `Escribe como una persona real, con datos concretos. Evita los patrones que delatan texto de IA:
- Contrastes de relleno: "no es X, es Y", "no solo X sino también Y". Di directamente lo que sí es, con su razón.
- Listas de negaciones ("sin filas, sin estrés, sin complicaciones") y frases que terminan arrastrando más cláusulas después de la idea principal. Termina la frase donde termina la idea.
- Preguntas que tú mismo respondes ("¿El resultado? Increíble") y revelaciones con dos puntos ("Lo mejor:"). Dilo directo.
- Frases hechas: "descubre la magia de", "una experiencia inolvidable", "el destino perfecto", "momentos únicos", "vive la aventura". Cámbialas por el detalle real: qué se ve, qué se come, cuánto dura, cuánto cuesta.
- Guiones largos (—) en textos cortos, un emoji al inicio de cada línea y frases de una sola línea todas seguidas.
- Adverbios de relleno, voz pasiva y abstracciones. Sujeto humano + verbo concreto.
- Prueba de cambio: si la frase sirve igual para otra agencia, reescríbela con un detalle de esta. Si te falta el dato, deja un marcador [DATO] en vez de inventarlo.
- Varía el largo de las frases y no cierres siempre con una frase de impacto.`,
  },
  {
    id: 'seo-social',
    agents: ['copy', 'guion', 'analista'],
    icon: '🔎',
    name: 'SEO social y hashtags',
    desc: 'Que te encuentren cuando buscan viajes en TikTok e Instagram.',
    core: false,
    kw: ['hashtag', 'seo', 'buscar', 'busqueda', 'palabras clave', 'keyword', 'encontrar', 'bio', 'alcance organico', 'descubrir', 'posicionar', 'palabra clave'],
    text: `SEO social: TikTok e Instagram funcionan también como buscadores, sobre todo para planear viajes.
- Las palabras clave que el algoritmo lee están en: lo que se DICE en voz, el texto en pantalla, el caption, el nombre de usuario y la bio. Repite la frase que la gente busca en esos lugares, de forma natural.
- Frases de búsqueda típicas de turismo: "[destino] qué hacer", "full day [destino] precio", "[destino] desde [ciudad]", "cuánto cuesta viajar a [destino]", "qué llevar a [destino]", "[destino] con niños". Úsalas en títulos, primera línea del caption y voz del video.
- Hashtags: 3 a 5, relevantes y mezclados (uno amplio del destino, uno de nicho y uno de marca). Más hashtags no dan más alcance. Los de campaña propia (#VacilandoAndo) sirven para reunir contenido de clientes.
- Bio: qué haces + para quién + destinos + cómo reservar (WhatsApp). Un nombre de perfil con palabra clave ("Excursiones Venezuela") ayuda a ser encontrado.
- Verifica con la búsqueda web qué frases y hashtags están funcionando ahora; no los des por seguros de memoria.`,
  },

  // ============================ COPYWRITER ============================
  {
    id: 'hooks',
    agents: ['copy', 'guion'],
    icon: '🎣',
    name: 'Ganchos que frenan el scroll',
    desc: 'Los primeros 3 segundos: visual + voz + texto en pantalla.',
    core: false,
    kw: ['gancho', 'hook', 'primeras palabras', 'primer segundo', 'frenar', 'scroll', 'abrir el video', 'arranque', 'inicio del', 'empezar el', 'enganchar', 'titulo'],
    text: `Ganchos (hooks). Tienes 3 segundos. Un buen gancho usa tres señales a la vez: IMAGEN que impacta + FRASE hablada + TEXTO en pantalla, todo en el primer segundo.
Fórmulas que funcionan en turismo (adáptalas con un dato concreto):
- Resultado primero: "Así amanece en [destino] a las 6 a. m." (la mejor toma al inicio, no al final).
- Precio transparente: "Cuánto cuesta REALMENTE ir a [destino] desde [ciudad]".
- Curiosidad específica: "Lo que casi nadie hace en [destino] (y es lo mejor)".
- POV: "POV: llegaste a [destino] sin haber planificado nada".
- Dolor: "¿Quieres ir a [destino] pero no sabes por dónde empezar?".
- Lista con número: "3 cosas que debes llevar a [destino]".
- Historia: "El sábado pasado una señora nos dijo [frase real de un cliente]".
- Contraste honesto: "Fui a [destino] por $[monto] y esto fue lo que incluyó".
Reglas: una idea por gancho; que prometa algo que el video SÍ cumple (el clickbait que no cumple mata la retención); que sea específico (nombre del destino, cifra, tiempo); prueba 3 a 5 variantes y elige por la que mejor se entiende sin sonido. Evita arrancar con "Hola, bienvenidos" o con el logo.`,
  },
  {
    id: 'captions',
    agents: ['copy'],
    icon: '✍️',
    name: 'Captions para Instagram y TikTok',
    desc: 'Estructura, largo, primera línea y CTA según la red.',
    core: false,
    kw: ['caption', 'descripcion', 'texto del post', 'pie de foto', 'copy', 'publicacion', 'post', 'texto para', 'redactar', 'escribir'],
    text: `Captions que venden (Instagram y TikTok).
Instagram:
- La primera línea (antes de "más") decide si leen: pon el gancho, el destino y la promesa ahí.
- Estructura: gancho → qué vas a ver/vivir (2 a 4 líneas con detalles reales) → datos clave (fecha, salida, qué incluye, precio por persona) → CTA a WhatsApp con palabra clave.
- Párrafos cortos con saltos de línea donde una persona respiraría; no todas las líneas de una sola frase.
- Hashtags al final: 3 a 5.
TikTok:
- Corto (1 a 2 líneas) con las palabras que la gente busca; el contenido ya lo hace el video.
- Una pregunta real que invite a comentar o a pedir información ("¿Con quién irías?") funciona mejor que "comenta SI".
Siempre:
- CTA concreto con palabra clave medible: "Escríbenos ROQUES al WhatsApp y te pasamos fechas y precios". Una sola acción por post.
- Da 2 o 3 variantes con enfoque distinto (emocional, informativo con precio, urgencia real) y recomienda una.
- No inventes fecha, precio ni cupos: usa [FECHA], [PRECIO], [CUPOS] si no están en la memoria.`,
  },
  {
    id: 'persuasion',
    agents: ['copy'],
    icon: '🧲',
    name: 'Marcos de persuasión (AIDA, PAS, BAB, 4U)',
    desc: 'Estructuras para ordenar un texto de venta.',
    core: false,
    kw: ['persuad', 'vender', 'convencer', 'aida', 'texto de venta', 'copy de venta', 'venta', 'convertir', 'conversion', 'llamado a la accion', 'cta', 'mensaje de venta'],
    text: `Marcos de persuasión para ordenar un texto:
- AIDA: Atención (gancho) → Interés (detalle que enamora) → Deseo (cómo se vive el viaje) → Acción (CTA claro).
- PAS: Problema ("no sabes cuál agencia es confiable") → Agitar (qué pasa si eliges mal) → Solución (cómo lo resuelven ustedes, con prueba).
- BAB: Antes (rutina de lunes) → Después (domingo en la playa) → Puente (cómo llegar: la salida del sábado).
- 4U: que sea Útil, Urgente (solo si es real), Único (algo que solo ustedes dicen) y Ultra específico (cifra, destino, fecha).
Principios: claridad antes que creatividad; beneficios sobre características (no "lancha rápida", sí "llegas a la playa en 25 minutos"); lenguaje del cliente (las palabras que usan en comentarios y DMs); una idea por texto; afirmaciones que se puedan comprobar. Si una afirmación no tiene respaldo (testimonio, foto, dato), no la escribas o márcala [NECESITO PRUEBA].`,
  },
  {
    id: 'psicologia',
    agents: ['copy', 'guion'],
    icon: '🧠',
    name: 'Psicología del consumidor en viajes',
    desc: 'Sesgos que mueven la decisión, usados con ética.',
    core: false,
    kw: ['psicologia', 'urgencia', 'escasez', 'prueba social', 'objecion', 'miedo', 'decision', 'comprar', 'motivar', 'persuasion', 'confianza', 'dudas', 'indecis'],
    text: `Psicología aplicada a la compra de viajes (úsala con honestidad, nunca para engañar):
- Prueba social: testimonios reales, fotos y videos de clientes, número de viajeros atendidos (solo si es verdadero). Es la palanca más fuerte para una agencia en Venezuela por la desconfianza.
- Aversión a la pérdida: "quedan 6 cupos" funciona SOLO si es real; también "no te quedes viendo las fotos de los demás". Nunca inventes escasez ni cuentas regresivas falsas.
- Anclaje y encuadre del precio: muestra el valor total (transporte + lancha + almuerzo + guía) y luego el precio por persona; "$45 con todo incluido" se entiende mejor que una lista de extras. Dividir ("menos de $X por hora de playa") puede ayudar.
- Reducir el riesgo: explica qué pasa si llueve o hay cambios, cómo se aparta el cupo y qué política de cambios hay (según la memoria).
- Compromiso gradual: del like a la pregunta, a la consulta por WhatsApp, a apartar con abono. Facilita cada paso pequeño.
- Efecto manada y pertenencia: "vienen todos los sábados", grupos de amigos, la comunidad de viajeros de la marca.
- Autoridad y calidez: el guía, su experiencia y su cara. Mostrar un pequeño detalle imperfecto y real genera más confianza que un video demasiado perfecto.
- Fricción: cada paso extra pierde gente. Un solo botón de WhatsApp, una sola acción.`,
  },
  {
    id: 'ofertas',
    agents: ['copy'],
    icon: '🎁',
    name: 'Ofertas y paquetes irresistibles',
    desc: 'Cómo armar la oferta (valor, bonos, garantía, escasez real).',
    core: false,
    kw: ['oferta', 'paquete', 'promocion', 'promo', 'descuento', 'combo', 'grupo', 'abono', 'reserva', 'cupos', 'bono', 'precio especial', 'temporada', 'plan'],
    text: `Diseño de ofertas. La oferta importa más que el texto: un mejor paquete convierte más que un mejor copy.
Valor = (resultado soñado × confianza de que se logra) ÷ (tiempo de espera × esfuerzo). Sube el valor así: nombra el resultado ("domingo de playa sin manejar"), muestra pruebas, acorta la espera (fecha cercana) y quita esfuerzo (transporte incluido, todo resuelto).
Una oferta completa tiene seis partes: 1) qué incluye (lo central), 2) bonos reales que suman (fotos del viaje, bebida de bienvenida, snorkel, punto de encuentro cómodo), 3) garantía o política clara (cambio de fecha por lluvia, devolución según las reglas de la marca), 4) escasez REAL (cupos del bus o de la lancha, fecha límite de abono), 5) un nombre atractivo para el paquete, 6) precio por persona con facilidad de pago (abono para apartar).
Ideas que suelen funcionar: precio por grupo ("el 5.º va con descuento"), paquete de pareja o familia, preventa temprana, fechas "salida garantizada" cuando se llena el mínimo.
Cuidado: no descuentes solo para atraer clientes nuevos (atrae a los que más piden rebaja y baja el valor percibido); mejor agrega valor. No inflar bonos con valores inventados. No pongas urgencia falsa. Usa solo precios, bonos y políticas que estén en la memoria; si falta alguno, deja el marcador y pídelo.`,
  },
  {
    id: 'whatsapp-embudo',
    agents: ['copy', 'analista'],
    icon: '💬',
    name: 'Del contenido al WhatsApp y al cierre',
    desc: 'CTAs, mensajes de respuesta, objeciones y seguimiento.',
    core: false,
    kw: ['whatsapp', 'dm', 'mensaje directo', 'cta', 'cerrar', 'cierre', 'consulta', 'cotizacion', 'escribirnos', 'link', 'responder a', 'seguimiento', 'objecion', 'precio'],
    text: `Del contenido al cierre por WhatsApp:
- CTA con palabra clave por pieza ("Escríbenos ROQUES"). Así sabes qué contenido trae consultas. Una sola acción por publicación; el link de WhatsApp en la bio y en las stories (con mensaje prellenado si se puede).
- Responder rápido es parte de la venta: preparar mensajes modelo para las preguntas repetidas (precio, qué incluye, punto de salida, fechas, cómo apartar).
- Primer mensaje de respuesta: saludo cálido + dato que pidió + pregunta de calificación (fecha, número de personas, ciudad de salida) + siguiente paso claro. Corto y humano; no un muro de texto.
- Objeciones típicas y cómo atenderlas con honestidad: "es caro" (mostrar todo lo que incluye y el precio por persona), "no los conozco" (testimonios, fotos de grupos reales, cómo es la salida), "¿es seguro?" (guías, seguros o medidas que de verdad existan), "¿y si llueve?" (la política real), "lo pienso" (fecha en que cierra el cupo, sin presionar).
- Cierre: confirmar fecha, personas y monto por persona; apartar con abono si aplica; mandar punto de encuentro, hora y lista de qué llevar. Confirmar el día antes.
- Seguimiento: a quien no respondió, un recordatorio amable a los 1 o 2 días, con un dato nuevo (por ejemplo, cuántos cupos quedan si es cierto). Máximo dos recordatorios.
- Después del viaje: pedir foto/video y permiso para publicarlo, y una reseña. Es el mejor contenido.`,
  },
  {
    id: 'comunidad',
    agents: ['copy'],
    icon: '🤝',
    name: 'Respuestas a comentarios y DMs',
    desc: 'Tono, quejas, críticas y cómo llevar la charla a WhatsApp.',
    core: false,
    kw: ['comentario', 'responder', 'respuesta', 'queja', 'reclamo', 'critica', 'hater', 'mensaje', 'atencion', 'community', 'cliente molesto', 'resenia', 'reseña'],
    text: `Community management de una agencia de viajes:
- Responde rápido, con nombre propio y tono cercano. Una respuesta humana y específica vale más que una plantilla.
- Comentario con pregunta de precio o info: responde lo esencial si es público (precio por persona y qué incluye si está en la memoria) y lleva el detalle al WhatsApp o DM ("te escribo por interno 🧡").
- Elogios: agradece con algo concreto, pide permiso para compartir y etiquétalos si aceptan.
- Quejas o críticas: 1) agradece y reconoce sin ponerte a la defensiva, 2) pide los datos por privado, 3) ofrece una solución real, 4) cierra el ciclo y pregunta si quedó resuelto. Nunca discutas en público ni borres críticas legítimas; sí puedes ocultar insultos o spam.
- Si no sabes un dato, dilo y ofrece averiguarlo; no inventes.
- Haters y ironías: una respuesta amable y breve o ninguna. No alimentes la pelea.
- Aprovecha los comentarios como investigación: las preguntas repetidas son ideas de contenido y las objeciones son guiones.
- Da siempre 2 o 3 variantes de respuesta con tonos distintos (cálida, breve, con humor) cuando te las pidan.`,
  },
  {
    id: 'stories',
    agents: ['copy', 'guion'],
    icon: '📲',
    name: 'Stories que venden',
    desc: 'Secuencias de 4-7 stories con stickers y cuenta regresiva.',
    core: false,
    kw: ['story', 'stories', 'historia', 'historias', 'sticker', 'encuesta', 'cuenta regresiva', 'ultimos cupos', 'destacadas'],
    text: `Stories de Instagram que venden. Piensa en secuencia, no en una story suelta.
Secuencia de 5 (para una salida con cupos):
1) Gancho visual del destino con texto corto o pregunta. 2) Qué incluye (3 datos, uno por story o en una lámina). 3) Prueba: video o foto de un grupo anterior, o un testimonio. 4) Fecha, punto de salida y precio por persona. 5) CTA: sticker de enlace al WhatsApp o "escríbenos [PALABRA]".
Stickers que funcionan: encuesta ("¿Playa o montaña?"), caja de preguntas (convierte dudas en respuestas públicas), cuenta regresiva hacia el cierre de cupos (solo con fecha real), enlace y reacción con emoji.
Rutina: 3 a 7 stories al día; mezcla detrás de cámaras, prueba social y una oferta. Guarda en Destacadas: Destinos, Preguntas frecuentes, Testimonios, Cómo reservar.
Una story = una idea. Texto legible en 2 segundos. Responde a quienes contestan: es conversación que termina en WhatsApp.`,
  },

  // ============================ ANALISTA ============================
  {
    id: 'tendencias',
    agents: ['analista', 'guion'],
    icon: '📈',
    name: 'Investigación de tendencias',
    desc: 'Separar tendencia real de moda pasajera y adaptarla.',
    core: false,
    kw: ['tendencia', 'trending', 'viral', 'sonido', 'audio', 'formato nuevo', 'que esta funcionando', 'que funciona', 'moda', 'challenge', 'reto', 'actual', 'novedad'],
    text: `Cómo investigar y usar tendencias:
- Busca en la web SIEMPRE con fecha reciente (última semana o mes) y cita la fuente y la fecha. Fuentes: TikTok Creative Center y Newsroom, cuentas oficiales de Instagram (@creators, @mosseri), Meta, blogs reconocidos de marketing (Later, Hootsuite, Sprout Social, Buffer, Social Media Today, Metricool), medios de turismo (Skift, PhocusWire) y comunidades.
- Clasifica cada hallazgo: audio o sonido en tendencia, formato de video, tema o conversación, cambio de algoritmo. Indica en qué fase está: naciendo (aprovechar ya), en pico (adaptar rápido con ángulo propio) o saturándose (evitar).
- Ventana de oportunidad: un audio o formato suele servir pocos días o semanas. Si tardas en grabar, ya pasó.
- Filtro de adaptación: ¿encaja con turismo y con el público de la marca? ¿se puede hacer con lo que hay a mano (el viaje, el guía, los clientes)? ¿lleva a una consulta por WhatsApp? Si no cumple, descártala aunque sea viral.
- Una tendencia sin ángulo propio no diferencia. Propón la adaptación concreta: gancho, toma clave y CTA.
- Si no hay evidencia, dilo. No inventes tendencias ni cifras.`,
  },
  {
    id: 'algoritmos',
    agents: ['analista'],
    icon: '⚙️',
    name: 'Algoritmos de Instagram y TikTok',
    desc: 'Qué señales pesan y cómo verificar cambios recientes.',
    core: false,
    kw: ['algoritmo', 'alcance', 'no llega', 'bajo alcance', 'shadowban', 'recomendacion', 'para ti', 'fyp', 'explorar', 'reels de prueba', 'caida', 'cayo', 'cambio de'],
    text: `Cómo razonar sobre los algoritmos (verifica lo vigente con la búsqueda; cambian seguido):
- En general ambas redes premian el contenido que retiene: tiempo de visualización, porcentaje visto completo, repeticiones, y las acciones de alto valor: compartir por mensaje, guardar y comentar. Los likes pesan menos.
- Instagram recomienda Reels a no seguidores según interés; un Reel suele nacer con una muestra pequeña y se expande si responde. Los carruseles y las stories sirven más a la base que ya te sigue.
- TikTok prueba cada video con un grupo pequeño; si retiene y genera interacción, lo amplía en oleadas. La búsqueda en TikTok es una fuente de tráfico creciente para viajes.
- Calidad técnica: video vertical, audio claro, buena luz y subtítulos ayudan a la retención.
- Si el alcance cae: revisa primero lo básico (gancho, duración, retención) antes de culpar al algoritmo; compara varias publicaciones, no una sola; mira si hubo cambios oficiales anunciados.
- No uses mitos (horarios mágicos, trucos de hashtags). Recomienda pruebas medibles. Si citas una novedad del algoritmo, da la fuente y la fecha.`,
  },
  {
    id: 'metricas',
    agents: ['analista'],
    icon: '📊',
    name: 'Lectura de métricas de Instagram y TikTok',
    desc: 'Qué significa cada métrica y qué mirar primero.',
    core: false,
    kw: ['metrica', 'estadistica', 'insights', 'analytics', 'alcance', 'vistas', 'retencion', 'guardados', 'compartidos', 'interaccion', 'rendimiento', 'analiza', 'resultados', 'engagement', 'impresiones', 'seguidores'],
    text: `Cómo leer métricas (los datos los carga Kike a mano o por captura):
- Orden de lectura: 1) ALCANCE/VISTAS (¿llegó a gente?), 2) RETENCIÓN y tiempo promedio (¿se quedaron?), 3) COMPARTIDOS y GUARDADOS (señal de valor y de intención de viaje), 4) COMENTARIOS y consultas (¿generó conversación?), 5) VISITAS AL PERFIL y SEGUIDORES GANADOS (¿interés en la marca?), 6) CONSULTAS POR WHATSAPP (¿vende?).
- Tasas sobre el alcance (o vistas si no hay alcance): interacción, guardados, compartidos, consultas. Compara contra el PROMEDIO PROPIO de la cuenta; no uses benchmarks inventados. Si citas un benchmark, da la fuente.
- Una publicación sola no concluye nada: busca patrones en 5 o más (por destino, formato, gancho, duración, día).
- Diagnóstico rápido: muchas vistas y poca retención = gancho o promesa que no se cumple. Buena retención y pocas vistas = poco distribuido (tema, audio, primeras palabras). Muchos guardados y compartidos = contenido de valor, repetir el formato. Muchas vistas pero cero consultas = falta CTA, oferta o confianza.
- Muestra pequeña: con pocos datos, habla de "indicios", no de conclusiones. Di qué dato falta.
- Termina siempre con acciones concretas para la próxima semana.`,
  },
  {
    id: 'embudo-ventas',
    agents: ['analista'],
    icon: '🧭',
    name: 'Medir qué contenido trae ventas',
    desc: 'Atribución simple: pieza → consulta → reserva.',
    core: false,
    kw: ['ventas', 'vender', 'reservas', 'consultas', 'conversion', 'embudo', 'roi', 'retorno', 'cuanto vendi', 'atribucion', 'de donde vienen', 'cierre', 'rentable'],
    text: `Atribución simple para una agencia que cierra por WhatsApp:
- Cada pieza lleva una palabra clave distinta en el CTA ("ROQUES", "MORROCOY"). Cada consulta se anota con esa palabra. También pregunta al cliente "¿cómo nos conociste?" (las respuestas revelan lo que no se mide: compartidos por mensaje, búsquedas, recomendaciones).
- Hoja de seguimiento mínima (por pieza): fecha, red, formato, destino, vistas, consultas, reservas, ingreso. Con eso calculas: consultas por cada 1.000 vistas, % de consultas que reservan y ingreso por pieza.
- Lo que importa es el dinero y las reservas, no solo las vistas. Un reel con pocas vistas pero 8 consultas vale más que uno viral con cero.
- Mira el embudo completo y busca el cuello de botella: poca gente llega (alcance), llega pero no consulta (CTA u oferta), consulta pero no reserva (respuesta lenta, precio, confianza), reserva pero no repite (experiencia, seguimiento).
- Reconoce los límites: parte del efecto no se ve (recomendaciones, búsquedas posteriores). Con pocos datos, habla en rangos y no de certezas. Nunca inventes cifras.`,
  },
  {
    id: 'competencia',
    agents: ['analista'],
    icon: '🔍',
    name: 'Análisis de competencia',
    desc: 'Qué hacen otras agencias y dónde hay huecos.',
    core: false,
    kw: ['competencia', 'competidor', 'otras agencias', 'agencia', 'rival', 'benchmark', 'comparar con', 'diferenciar', 'que hacen los demas', 'mercado'],
    text: `Análisis de competencia en redes (usa la búsqueda web y las cuentas públicas; cita lo que veas):
- Elige 5 a 8 agencias o cuentas de excursiones comparables (mismos destinos o mismo público) y revisa sus últimas 20 a 30 publicaciones.
- Para cada una anota: destinos y productos que empujan, rango de precios que muestran, formatos que más repiten (reel, carrusel, stories), ganchos, frecuencia, qué tipo de comentarios reciben, cómo llevan a la venta (WhatsApp, link) y cómo se ve su prueba social.
- Detecta patrones: qué comparten todas (el estándar del mercado), qué ninguna hace (huecos de oportunidad) y qué les funciona (publicaciones con mucha respuesta).
- Convierte el análisis en decisiones: dónde diferenciarse (precio transparente, guías con nombre, grupos pequeños, testimonios, garantía de cambio de fecha según la política real) y qué formatos probar.
- No copies: adapta el patrón con la voz y los datos propios. No afirmes cosas sobre otras agencias que no puedas comprobar y no hagas ataques directos.`,
  },
  {
    id: 'audiencia',
    agents: ['analista', 'guion'],
    icon: '👥',
    name: 'Investigación del público',
    desc: 'Quién compra, qué lo motiva y qué lo frena (en sus palabras).',
    core: false,
    kw: ['publico', 'audiencia', 'cliente ideal', 'perfil', 'persona', 'quien compra', 'segmento', 'target', 'motivaciones', 'dolor', 'investigar clientes', 'voz del cliente'],
    text: `Investigación del público (con evidencia, sin inventar personas):
- Fuentes: comentarios, mensajes y preguntas de WhatsApp, reseñas, respuestas a encuestas en stories, a quién etiquetan, y conversaciones públicas en TikTok, Instagram y comunidades de viajeros. Pide a Kike pegar mensajes reales (sin datos personales).
- Qué extraer: qué trabajo quiere resolver el cliente ("escaparme de la rutina un fin de semana", "una salida segura con mi familia", "fotos increíbles"), qué lo disparó a buscar (feriado, cumpleaños, cansancio), qué alternativas compara, qué le frena, y las PALABRAS EXACTAS que usa (sirven para guiones y captions).
- Segmenta: parejas, grupos de amigos, familias con niños, viajeros solos, empresas y colegios. Cada segmento tiene motivaciones, frenos y mensajes distintos.
- Etiqueta cada hallazgo con su confianza: alta (aparece en 3 o más fuentes), media (2) o baja (1 sola). No armes conclusiones con menos de 5 datos por segmento.
- Entrega: temas de contenido, objeciones a responder en video y frases textuales para usar. Si los datos no alcanzan, di qué preguntar y cómo (una encuesta de 3 preguntas en stories, por ejemplo).`,
  },
  {
    id: 'experimentos',
    agents: ['analista', 'guion'],
    icon: '🧪',
    name: 'Pruebas A/B de contenido',
    desc: 'Probar ganchos, formatos y CTAs sin engañarse con pocos datos.',
    core: false,
    kw: ['probar', 'prueba', 'ab test', 'a/b', 'test', 'experimento', 'variante', 'cual funciona mejor', 'comparar dos', 'hipotesis'],
    text: `Pruebas de contenido con rigor (una cuenta pequeña no tiene tráfico para pruebas estadísticas formales, así que se hace una versión práctica):
- Hipótesis escrita: "Porque [observación], creemos que [cambio] mejorará [métrica] en [público]".
- Cambia UNA sola cosa por prueba (el gancho, la duración, el formato o el CTA) y mantén lo demás parecido (mismo destino, mismo estilo).
- Una publicación no demuestra nada. Publica cada variante varias veces (idealmente 3 o más cada una) en días y horarios parecidos y compara el promedio de la métrica elegida (retención, compartidos o consultas).
- Elige la métrica antes de publicar, y una de protección (por ejemplo, no perder consultas).
- Lee con humildad: con pocos datos habla de "tendencia", no de ganador. Deja de cambiar cosas a mitad de prueba y no decidas por una sola publicación viral.
- Documenta cada prueba (hipótesis, resultado, aprendizaje, dónde más aplicarlo) y prioriza la próxima con impacto, confianza y facilidad.`,
  },
  {
    id: 'estacionalidad',
    agents: ['analista', 'guion'],
    icon: '🗓️',
    name: 'Calendario de demanda del turismo',
    desc: 'Temporadas, feriados y cuándo empezar a vender cada salida.',
    core: false,
    kw: ['temporada', 'feriado', 'carnaval', 'semana santa', 'vacaciones', 'puente', 'fin de semana largo', 'navidad', 'diciembre', 'agosto', 'cuando publicar', 'calendario', 'fecha', 'epoca', 'estacion'],
    text: `Estacionalidad del turismo nacional:
- Picos habituales: Carnaval, Semana Santa, vacaciones escolares (julio-agosto), fin de año, y los puentes y feriados del calendario oficial. Verifica las fechas exactas del año con la búsqueda; no las des de memoria.
- Planifica hacia atrás: el contenido de inspiración empieza de 4 a 8 semanas antes, el de información y oferta de 2 a 4 semanas antes y el de cierre con cupos reales en la última semana. Después de la salida, publica el contenido de resultados y prueba social.
- La temporada baja también vende: escapadas de fin de semana, "salidas entre semana", grupos pequeños, destinos cercanos a las ciudades principales.
- Considera el clima y el mar (temporada de lluvias, oleaje) al elegir destino y no prometas condiciones.
- Usa el historial: compara las ventas y consultas de las mismas fechas del año anterior (si Kike las tiene) para decidir cuándo empezar y cuánto contenido preparar.`,
  },
  {
    id: 'reporte',
    agents: ['analista'],
    icon: '📝',
    name: 'Informe semanal y mensual',
    desc: 'Formato claro del reporte: hallazgos, causas y acciones.',
    core: false,
    kw: ['reporte', 'informe', 'resumen semanal', 'resumen del mes', 'balance', 'como nos fue', 'resultados de la semana', 'revision'],
    text: `Formato del informe (corto, para leerlo en 2 minutos):
1) Resumen en 3 líneas: qué pasó, qué importa, qué hacemos.
2) Números clave del período vs. el período anterior y vs. el promedio propio: publicaciones, vistas, retención promedio, compartidos y guardados, consultas por WhatsApp, reservas.
3) Lo que mejor funcionó (top 3) y por qué (gancho, formato, tema, destino, día).
4) Lo que peor funcionó (bottom 3) y qué se aprende.
5) Patrones y alertas (algo que se repite, un cambio brusco, un dato que falta).
6) Plan de la próxima semana: 3 a 5 acciones concretas con responsable y métrica.
Usa tabla para comparar publicaciones. No cargues con adjetivos: cada afirmación lleva su número. Indica la confianza de cada conclusión según la cantidad de datos.`,
  },

  // ============================ GUIONISTA ============================
  {
    id: 'guion-estructura',
    agents: ['guion'],
    icon: '🎬',
    name: 'Estructura de guiones cortos',
    desc: 'Gancho, ritmo, retención y CTA para Reels y TikTok.',
    core: false,
    kw: ['guion', 'script', 'reel', 'tiktok', 'video', 'estructura', 'ritmo', 'retencion', 'duracion', 'tomas', 'escenas', 'grabar', 'shotlist', 'lista de tomas'],
    text: `Estructura de un guion corto (15 a 45 s):
- 0-3 s GANCHO: imagen potente + frase + texto en pantalla a la vez.
- 3-10 s PROMESA/CONTEXTO: qué vas a ver o aprender y por qué le importa.
- 10-35 s DESARROLLO: valor, historia o lista. Cambia de plano cada 2 o 3 segundos; usa cortes, cambios de ángulo y movimiento para renovar la atención.
- Final PAYOFF + CTA: cumple la promesa del gancho y pide UNA acción (escribir la palabra clave, guardar, compartir). Un cierre que vuelve al inicio (loop) mejora las repeticiones.
Reglas: una idea por video; subtítulos siempre (se ve sin sonido) con 3 a 5 palabras por línea y máximo 2 líneas; audio claro (la voz se oye antes que la música); lo más atractivo en los primeros segundos, no al final; si puede ser más corto, hazlo más corto.
Entrega en tabla: Tiempo | Toma (qué se ve) | Texto en pantalla | Voz. Añade ficha (objetivo, formato, duración, audio), 2 o 3 ganchos alternativos, CTA final y una lista de tomas pensada para grabar con el teléfono (planos de apertura, detalle, personas, cierre).`,
  },
  {
    id: 'formatos-turismo',
    agents: ['guion'],
    icon: '🧳',
    name: 'Formatos que funcionan en turismo',
    desc: 'POV, precio transparente, itinerario, qué llevar y más.',
    core: false,
    kw: ['formato', 'idea', 'ideas', 'que grabar', 'contenido para', 'tipo de video', 'que publicar', 'concepto', 'serie de ideas', 'brainstorm', 'lluvia de ideas'],
    text: `Formatos de contenido de turismo que suelen funcionar (elige según el objetivo: alcance, confianza o venta):
- POV de llegada o de experiencia ("POV: llegas al cayo a las 9 a. m.").
- Precio transparente: "Cuánto cuesta REALMENTE ir a [destino]" mostrando qué incluye. Alta intención de compra.
- Itinerario día a día o minuto a minuto del full day.
- Qué llevar / qué NO llevar / errores al ir a [destino].
- Detrás de cámaras: preparación de la salida, el bus, el guía, la comida.
- Testimonios y reacciones reales de clientes (con permiso).
- Pregunta del cliente respondida en video (comentarios y DMs convertidos en guion).
- Expectativa vs. realidad (con honestidad, mostrando lo bueno real).
- Comparativa de destinos o de tipos de salida ("playa tranquila vs. playa con movimiento").
- Guía de [destino] para primera vez, con niños, en pareja o con amigos.
- Tendencias de audio adaptadas al viaje (cuando encajan).
- Carruseles: "Qué incluye", "Itinerario", "Preguntas frecuentes", "Qué llevar" (portada con gancho, una idea por lámina, CTA al final).
Equilibra el mix: contenido de alcance (descubrimiento), de confianza (prueba, guías, logística) y de venta (fechas, precio, cupos).`,
  },
  {
    id: 'storytelling',
    agents: ['guion', 'copy'],
    icon: '📖',
    name: 'Storytelling y emoción',
    desc: 'Historias reales que conectan, con tensión y detalle.',
    core: false,
    kw: ['historia', 'storytelling', 'emocion', 'narrativa', 'conectar', 'contar', 'relato', 'anecdota', 'testimonio', 'arco', 'emocional'],
    text: `Storytelling para contenido de viajes. La historia va primero; las tácticas de plataforma solo la amplifican.
- Una historia tiene a alguien que quiere algo, un obstáculo y un cambio. En turismo: la pareja que nunca se iba de vacaciones, el grupo de amigos que se animó, la señora que conoció el mar a los 60.
- Usa detalles sensoriales y específicos (el olor a pescado frito, el agua tibia, la risa en la lancha), nombres reales con permiso y frases textuales de clientes.
- Estructura mínima: situación (antes) → momento de tensión o decisión → cambio (durante el viaje) → resultado emocional → invitación.
- Muestra a las personas: el guía, el equipo y los clientes. La gente reserva a quien conoce.
- Orgullo y pertenencia: el paisaje y la cultura locales emocionan; cuéntalos sin clichés ("paraíso", "joya escondida").
- No fabriques historias ni testimonios. Si no hay una real, pide a Kike que la consiga o usa el contenido de clientes.
- Vulnerabilidad real sí (el día que llovió y salió bien, un problema que se resolvió); vulnerabilidad fingida no.`,
  },
  {
    id: 'calendario',
    agents: ['guion'],
    icon: '📅',
    name: 'Calendario editorial y pilares',
    desc: 'Qué publicar cada semana y cómo repartirlo.',
    core: false,
    kw: ['calendario', 'plan de contenido', 'semana', 'mes', 'pilares', 'planificar', 'cronograma', 'cuantas veces', 'frecuencia', 'organizar', 'editorial', 'batch', 'parrilla'],
    text: `Calendario editorial y pilares:
- Define 3 a 5 pilares de contenido para la marca (por ejemplo: Destinos, Cómo funciona un viaje con nosotros, Comunidad y clientes, Consejos de viaje, Ofertas y salidas).
- Reparto sugerido: 60% contenido de alcance y utilidad (se descubre y se comparte), 30% confianza (testimonios, equipo, logística, preguntas frecuentes) y 10% venta directa (fechas, precio, cupos) en semanas sin salida cercana; sube el peso de venta en las 2 semanas previas a cada salida.
- Cadencia realista: la que se pueda sostener (por ejemplo 3 a 4 Reels/TikToks por semana, stories a diario, 1 carrusel a la semana). Constancia mejor que volumen.
- Trabajo por lotes: un día para grabar varias piezas, otro para publicar y responder. Una grabación se reparte en varios formatos (ver reutilizar contenido).
- Cada pieza lleva: pilar, objetivo (alcance, confianza o venta), formato, gancho, CTA y fecha. Entrega el plan en tabla.
- Deja espacio para lo inesperado (una tendencia, un cupo que se libera, un cliente que comparte contenido).
- Revisa los resultados cada semana y ajusta el mix según lo que trae consultas.`,
  },
  {
    id: 'series',
    agents: ['guion'],
    icon: '🎞️',
    name: 'Series y contenido recurrente',
    desc: 'Formatos repetibles con nombre propio que fidelizan.',
    core: false,
    kw: ['serie', 'recurrente', 'episodio', 'temporada de contenido', 'seccion fija', 'formato repetible', 'cada semana', 'rubrica'],
    text: `Series de contenido (secciones fijas que la gente espera):
- Un formato repetible con nombre, estructura y duración fijas: se reconoce en 1 segundo y se graba más rápido.
- Ideas para turismo: "Cuánto cuesta [destino]" (un destino por episodio), "Lo que te llevas en la mochila", "Pregúntale al guía", "Mito o verdad de [destino]", "Sábado de salida" (resumen de cada viaje), "Cliente del mes".
- Diseña la serie: promesa clara, estructura de 4 partes, gancho repetido con variaciones, cierre con CTA fijo.
- Empieza con 4 episodios; mide retención y consultas; mantén los que funcionan y retira los demás.
- Cada episodio debe poder verse solo (sin exigir conocer los anteriores) y tener su propio gancho.
- Reutiliza: cada episodio se convierte en carrusel, story y respuesta a comentarios.`,
  },
  {
    id: 'analisis-guion',
    agents: ['guion'],
    icon: '🧐',
    name: 'Análisis y mejora de guiones',
    desc: 'Rúbrica de 1 a 10 y versión mejorada lista para grabar.',
    core: false,
    kw: ['analiza este guion', 'revisa este guion', 'mejora este guion', 'critica', 'feedback', 'evalua', 'que le falta', 'mejorar guion', 'corrige', 'pega tu guion', 'mi guion'],
    text: `Cómo analizar el guion de Kike:
1) Lee todo y resume en una línea qué promete el video y a quién.
2) Puntúa del 1 al 10, con una frase de justificación cada una: Gancho (3 primeros segundos), Claridad (se entiende sin sonido), Ritmo (cambios de plano y de idea), Retención (¿hay motivos para seguir hasta el final?), Emoción o valor, Prueba (datos, personas, tomas reales) y CTA (una acción clara a WhatsApp).
3) Diagnóstico: lo que mejor funciona, los 3 problemas que más afectan y por qué.
4) Reescritura: entrega la versión mejorada en tabla Tiempo | Toma | Texto en pantalla | Voz, más 2 ganchos alternativos.
5) Qué probar: una variación para publicar como prueba.
Sé específico y honesto, pero constructivo. No cambies la voz de la marca. Marca [DATO] si falta información.`,
  },
  {
    id: 'creadores',
    agents: ['guion', 'analista'],
    icon: '🌟',
    name: 'Creadores, canjes y contenido de clientes',
    desc: 'Colaboraciones con influencers, UGC y embajadores.',
    core: false,
    kw: ['influencer', 'creador', 'colaboracion', 'colaborar', 'canje', 'embajador', 'ugc', 'contenido de clientes', 'alianza', 'patrocin', 'micro influencer', 'invitar'],
    text: `Colaboraciones con creadores:
- Prioriza micro y nano creadores (miles de seguidores) cuyo público sea tu cliente ideal: viajeros, parejas, familias, de las ciudades de salida. Importa la audiencia y la interacción real, no el número de seguidores.
- Revisa antes de invitar: comentarios reales (no genéricos), contenido reciente, si ya habla de viajes, y si su público responde a lo patrocinado.
- Modelo habitual para una agencia: canje (un cupo o viaje a cambio de contenido) o canje + comisión por reserva. Define por escrito: entregables, fecha, derechos de uso del contenido (para reutilizarlo como publicidad), exclusividad si aplica y cómo se mide.
- Brief corto, sin guion palabra por palabra: la razón de ser del viaje, 2 o 3 puntos clave, el CTA (código o palabra clave propia) y lo que NO se debe decir (no prometer clima ni servicios que no existen). Libertad creativa.
- Divulgación obligatoria y visible: la publicación debe indicar que es alianza o publicidad (etiqueta de colaboración de la red + texto claro), también si es canje.
- Medición: código o palabra clave por creador, y la pregunta "¿cómo nos conociste?".
- Contenido de clientes (UGC): invita a etiquetar, crea un hashtag de marca, pide permiso por escrito o por mensaje antes de reutilizarlo y da crédito. Es el contenido más creíble.`,
  },
  {
    id: 'lanzamiento',
    agents: ['guion', 'copy'],
    icon: '🚀',
    name: 'Lanzar una salida o destino nuevo',
    desc: 'Secuencia de teasers, información, prueba y cierre.',
    core: false,
    kw: ['lanzamiento', 'lanzar', 'nuevo destino', 'nueva salida', 'nuevo tour', 'abrir ventas', 'preventa', 'estreno', 'anunciar', 'nuevo paquete', 'inauguracion'],
    text: `Lanzamiento de una salida o destino nuevo (una campaña de 2 a 4 semanas):
1) Antes de lanzar: ¿la salida está lista y es sencilla, atractiva y completa (fecha, precio, qué incluye, punto de salida, política)? Lanza con eso, sin esperar la perfección.
2) Semana de expectativa: teasers del destino (sin revelar todo), preguntas al público, lista de interesados por WhatsApp (los "primeros en enterarse").
3) Semana de anuncio: reel principal con el destino y el precio por persona, carrusel con itinerario y qué incluye, stories con preguntas frecuentes y enlace de WhatsApp.
4) Semana de prueba y detalles: testimonios, guía, detrás de cámaras, respuestas a dudas y objeciones.
5) Cierre: fecha límite de apartado y cupos restantes (solo reales), recordatorios a la lista de interesados.
6) Después: contenido de la salida, agradecimientos, reseñas y anuncio de la próxima fecha.
Usa canales propios (lista de WhatsApp, comunidad) como destino final: las redes dan alcance, pero el cierre ocurre en el WhatsApp. Mide consultas por palabra clave.`,
  },
  {
    id: 'reutilizar',
    agents: ['guion', 'copy'],
    icon: '♻️',
    name: 'Una grabación, muchos contenidos',
    desc: 'Reutilizar cada viaje en reels, carruseles, stories y más.',
    core: false,
    kw: ['reutilizar', 'repurpose', 'aprovechar', 'una grabacion', 'varios contenidos', 'material', 'sacar mas', 'reciclar', 'adaptar a', 'cortar el video'],
    text: `Reutiliza cada viaje (crea una vez, distribuye varias):
- Después de una salida salen fácilmente: 1 reel principal, 2 o 3 clips cortos con ángulos distintos (precio, comida, el guía, la mejor toma), 1 carrusel (itinerario o "qué llevar"), 5 a 7 stories (momentos reales), 1 testimonio de un cliente y respuestas en video a preguntas del público.
- Piensa en "átomos": momentos que funcionan por sí solos (una reacción, un dato, un plano espectacular, una frase del guía). Anótalos durante la grabación.
- Adapta cada versión a su red: Reels más cuidados y guardables; TikTok más directo, con palabras clave y voz; stories más cercanas y conversacionales.
- Cada pieza debe entenderse sola: no asumas que vieron la anterior.
- Distribuye a lo largo de 1 a 2 semanas en vez de publicar todo junto. Los contenidos evergreen (qué llevar, preguntas frecuentes) se repiten cada 2 o 3 meses con mejoras.
- En la grabación, pide siempre tomas para esto: planos de apertura, detalles, personas reaccionando, el trayecto, el cierre.`,
  },
];
