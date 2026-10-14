# La Oficina · Vacilando Ando Tours

Oficina virtual isométrica con **3 agentes de IA** que te ayudan con el contenido de Instagram y TikTok de Vacilando Ando Tours:

| Oficina | Agente | Para qué sirve |
|---|---|---|
| ✍️ Copy | Copywriter | Captions, hooks, CTAs a WhatsApp, stories que venden y respuestas a comentarios y DMs. Siempre entrega 2–3 variantes. |
| 📊 Análisis | Analista | Tendencias de TikTok e Instagram (con búsqueda web) y análisis de tus métricas cargadas a mano o desde capturas de Insights / TikTok Analytics. |
| 🎬 Guiones | Guionista y estratega | Guiones para Reels y TikTok (tabla de tomas, texto en pantalla y voz), análisis y mejora de tus guiones, series y carruseles. |
| 🤝 Sala de juntas | Los tres | Lluvia de ideas: investigan en la web lo más reciente, cada uno aporta desde su área, tú opinas y al final arman un **plan de contenido** listo para grabar. |
| 👑 Tu oficina | Tú (el jefe) | Tu avatar: camina hasta el agente que tocas para consultarle y preside las reuniones desde la cabecera. |

La app **no hace** documentos, edición de video, flyers ni identidad visual: solo texto, guiones y análisis.

---

## 1. Lo que necesitas (gratis)

1. **API key de Google AI Studio (Gemini)** → <https://aistudio.google.com/apikey>. Es el "cerebro" de los agentes.
2. **API key de Tavily** (recomendada) → <https://app.tavily.com>. Es el buscador web de los agentes. El plan gratis trae 1.000 créditos al mes (una búsqueda básica gasta 1).

3. **API key de Groq** (opcional) → <https://console.groq.com/keys>. Respuestas rapidísimas con plan gratis aparte. La app lo usa en los turnos de la sala de juntas, para preparar las búsquedas y como **respaldo automático** cuando Gemini llega a su límite (marcado con ⚡ Groq). Gemini sigue a cargo de leer capturas y de buscar con Google.

> Si no quieres usar Tavily, en *Configuración → Claves* puedes elegir **"Google vía Gemini"**: usa la búsqueda de Google que trae Gemini y no necesita otra key, pero gasta tu cuota de Gemini.

## 2. Publicarla en GitHub Pages (una sola vez)

1. En GitHub entra a **Settings → Pages** del repositorio.
2. En *Build and deployment* elige **Deploy from a branch**.
3. Selecciona la rama donde está la app (`main` cuando la fusiones, o esta misma rama) y la carpeta **/ (root)**. Guarda.
4. En 1–2 minutos queda en: `https://papilicioussss.github.io/La-Oficina/`

Ábrela en el teléfono y usa **"Agregar a pantalla de inicio"** para tenerla como app.

## 3. Primer uso

1. Abre **⚙️ Configuración → 🔑 Claves**, pega tus dos keys y toca **Probar**.
2. En **👥 Equipo** bautiza a tus agentes: nombre, personalidad, indicaciones fijas y su look (camisa, piel, peinado).
3. En **🏝️ Marca** completa el brief: destinos, público, tono, WhatsApp, diferenciadores y lo que hay que evitar. Mientras más completo, mejores resultados.

## Cómo se usa

- **Tu avatar:** toca un agente (o su botón abajo) y caminas hasta su escritorio para consultarle. Toca cualquier punto del piso para caminar, o muévete con las flechas / WASD en la computadora. Personalízalo en Configuración → Equipo.
- **Toca una oficina o un personaje** para chatear con ese agente. Los atajos de abajo te dan ideas de qué pedir.
- **📎 Imagen**: adjunta capturas o fotos (por ejemplo, tus Insights) y el agente las lee.
- **🔎 Web: sí/no**: activa o apaga la búsqueda web para ahorrar créditos.
- En cada respuesta tienes: **Copiar** (texto limpio para pegar en IG/TikTok), **➡️ Pasar a otro agente** y **🤝 Llevar a la sala de juntas**.
- **📈 Métricas** (pestaña del Analista): registra cada publicación a mano o con **📷 Rellenar desde captura**. Verás promedios, un gráfico y la tabla; luego toca **Analizar** para que el Analista te diga qué hacer la próxima semana.
- **🤝 Sala de juntas**: describe qué necesitas, elige formato y objetivo, y convoca. Los personajes caminan a la sala, se investiga en la web y cada uno opina. Puedes meter tu aporte, pedir otra ronda y al final **✅ Armar el plan**.

## Tus datos y tus claves

- Todo (claves, conversaciones, métricas, reuniones) se guarda **solo en tu navegador**. Nada se sube a GitHub ni a ningún servidor propio.
- Las conversaciones salen directo de tu navegador a Google (Gemini) y a Tavily.
- En el plan gratis de Gemini, Google puede usar lo que envías para mejorar sus productos: **no metas datos personales de clientes** (nombres, teléfonos, capturas de chats).
- Si cambias de dispositivo o borras los datos del navegador se pierde todo: usa **Configuración → 💾 Datos → Descargar respaldo** y luego **Importar** en el otro dispositivo.
- **Nunca pongas tus keys en el código**: este repositorio es público.

## Límites del plan gratis

- Gemini tiene límites por minuto y por día que Google ajusta seguido. Los tuyos los ves en la consola de AI Studio. Si aparece "Llegaste al límite gratis", espera un minuto (o hasta el día siguiente).
- Una reunión completa usa unas 5–6 consultas a Gemini y unas 3 búsquedas en Tavily.
- En *Configuración → Claves* puedes cambiar de modelo. `gemini-flash-latest` siempre apunta al Flash más reciente.

## Proxy de Tavily (solo si hace falta)

Si la app te dice *"No pude conectar con Tavily desde el navegador"*, se pasa sola a la búsqueda de Google vía Gemini. Para seguir usando Tavily, crea este intermediario gratis:

1. Crea una cuenta en <https://dash.cloudflare.com> → **Workers & Pages → Create → Worker**.
2. Pega el contenido de [`proxy/tavily-worker.js`](proxy/tavily-worker.js) y dale **Deploy**.
3. (Opcional, más seguro) En el Worker: **Settings → Variables → Add secret** con el nombre `TAVILY_API_KEY` y tu key. Así la key no tiene que estar en el navegador.
4. Copia la URL del Worker (algo como `https://tavily-proxy.tu-usuario.workers.dev`) y pégala en **Configuración → Claves → Avanzado: proxy de Tavily**.

## Para desarrollo

Es una página estática sin compilación (HTML + CSS + módulos de JavaScript). Para probarla en tu compu:

```bash
npx http-server -p 8123 .
# abre http://localhost:8123
```

Estructura:

```
index.html            página principal
css/styles.css        estilos (claro y oscuro)
js/app.js             arranque y navegación (#/agente/copy, #/juntas, #/config…)
js/office.js          oficina isométrica en SVG y animaciones de los personajes
js/prompts.js         roles e instrucciones de cada agente
js/brain.js           llamadas a Gemini, búsqueda web y sala de juntas
js/gemini.js          cliente de la API de Gemini (streaming)
js/search.js          cliente de Tavily
js/groq.js            cliente de Groq (opcional: reuniones y respaldo)
js/chat.js            panel de chat de cada oficina
js/conversation.js    enviar / detener / reintentar mensajes
js/meeting.js         sala de juntas
js/metrics.js         registro de métricas, KPIs y gráfico
js/settings.js        configuración (claves, equipo, marca, fuentes, datos)
proxy/                proxy opcional para Tavily (Cloudflare Worker)
```
