# Informe de rendimiento — Portafolio 3D (Alejandra Mendivelso)

Rama: `perf/optimizacion` · Base: `main` (b0d60da)

## Metodología

- **Tamaños por chunk**: `ANALYZE=1 npm run build` (rollup-plugin-visualizer, `stats.html` + `stats.json`, no versionados). Métricas brutas y gzip del output de Vite.
- **Lighthouse**: móvil por defecto (throttling simulado 4G, CPU x4), `vite preview` sobre `dist/`, 3 ejecuciones, se reporta la mediana. Flags de Chrome: `--headless=new --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader` (software WebGL para poder ejercitar la escena 3D real; esto **infla el TBT** respecto a GPU real, pero es consistente antes/después).
- **Actividad GPU en reposo (proxy)**: CDP + hook sobre `drawArrays/drawElements` de WebGL; se cuentan llamadas de dibujo por segundo tras 13 s de carga (loader + intro completados), ventanas de 3 s. Objetivo: ~0 llamadas/s en reposo. El "% de GPU" de DevTools no es medible en headless; se usa este proxy objetivo.
- **Marcas de carga**: `loaderHidden` y `ownerVisible` (intro terminada) vía MutationObserver en la página real, mismo setup CDP.
- **Checklist manual**: ver sección final.

> Limitaciones: los valores absolutos de Lighthouse/TBT no son representativos de un equipo con GPU real (software rendering). Se usan como comparación relativa antes/después con el mismo método. No fue posible medir consumo de batería ni % de GPU del SO.

## Línea base (antes)

Commit `b0d60da` + visualizer (Fase 0).

### Chunks (build de producción)

| Chunk | Bruto | Gzip | ¿Eager? |
| --- | ---: | ---: | --- |
| `three` | 521.98 kB | 131.28 kB | sí (`modulepreload`) |
| `index` (entrada) | 123.71 kB | 37.44 kB | sí |
| `gsap` | 70.44 kB | 27.72 kB | sí (`modulepreload`) |
| `GLTFLoader` | 45.91 kB | 13.60 kB | no (dinámico, no usado aún) |
| `index.css` | 25.76 kB | 5.57 kB | sí |
| `index.html` | 2.80 kB | 0.94 kB | — |
| **JS inicial total** | **716.13 kB** | **196.44 kB** | — |

Notas:
- `zod` está incluido en el chunk `index` (se comprobó la cadena `vendor:"zod"` en el bundle).
- `three` y `gsap` se descargan aunque `?2d` o sin WebGL (no hay code splitting real del 3D).

### Lighthouse móvil (mediana de 3)

| Métrica | Valor |
| --- | ---: |
| Performance | 0.37 |
| FCP | 2 256 ms |
| LCP | 6 813 ms |
| TBT | 3 603 ms |
| CLS | ~0.0000 |

### Actividad y marcas (CDP, software WebGL)

| Métrica | Valor |
| --- | ---: |
| `loaderHidden` | ~4 955 ms |
| `ownerVisible` (intro hecha) | ~6 775 ms |
| draw calls/s en reposo | 1 020 (60 fps continuos) |

## Resultados por fase

### Fase 1 — zod fuera del cliente

**Hecho**
- `scripts/content-pipeline.mjs` valida los 4 JSON con el schema compartido (`src/content/schema.ts`, import nativo de TS en Node 22) y genera `src/content/generated/content.json` ya normalizado (defaults `tools`, `media`, `links`, `socials`, `skills`, `aboutCards`, proyectos ordenados, ids únicos verificados). Se ejecuta en `prebuild`, `pretypecheck`, `predev`, `pretest`, `validate:content` y en el plugin `content-pipeline` de Vite (con watcher + full-reload en dev).
- `scripts/validate-content.mjs` eliminado (schema duplicado). El flag `--sitemap` se conserva en el pipeline.
- `src/content/index.ts` consume el JSON generado; en DEV revalida con zod vía `import()` dinámico (`src/content/devValidate.ts`) que **no entra al bundle** (import.meta.env.DEV → DCE).
- Se añadió `tests/content.test.ts` (4 tests) y config de vitest en `vite.config.ts`. Nota: `npm test` fallaba antes de esta fase por no existir tests (`No test files found`).

**Antes → después (chunks)**

| Chunk | Antes bruto | Después bruto | Antes gzip | Después gzip |
| --- | ---: | ---: | ---: | ---: |
| `index` (entrada) | 123.71 kB | **68.44 kB** | 37.44 kB | **24.61 kB** |
| resto | sin cambios | sin cambios | — | — |

- Verificación: `grep 'vendor:"zod"' dist/assets/*.js` → sin coincidencias (zod fuera del cliente; sigue usándose en `api/contact.ts` del lado servidor).
- Trazabilidad de tipos: el contenido generado se importa con cast `as Content` (la garantía pasa a ser la validación de build + tests). Documentado como trade-off.

### Fase 2 — Code splitting del 3D

**Hecho**
- `src/app3d.ts` (nuevo): todo lo que toca three/gsap (renderer, escena, cámara, luces, entorno, corredor, guía, loop, intro, resize, loader) queda detrás de la interfaz `Scene3D`; `main.ts` solo importa el tipo (se borra al compilar).
- `boot3D()` en `main.ts`: `import('@/app3d')` se pide en cuanto se conoce `use3D`, en paralelo a la animación del loader. Las acciones que llegan antes de tener el módulo (deep links, `openDetail`/`closeDetail`) se encolan en `pending3d` y se reproducen al estar listo. Si el chunk falla → fallback 2D.
- Progreso del loader: 0–45 % rampa mientras llega el chunk, 45–88 % con texturas (tope visual 88 % intacto), 100 % al terminar. Timings visuales del loader sin cambios.
- GSAP: `assembleIntro` usa `gsap/gsap-core` (sin CSSPlugin; solo se animan objetos `Vector3`/`Group`, no CSS).
- `manualChunks` intacto; el HTML ya no precarga three ni gsap (solo el chunk compartido `math`, 4.2 kB).

**Antes → después (chunks)**

| Chunk | Antes bruto | Después bruto | Antes gzip | Después gzip |
| --- | ---: | ---: | ---: | ---: |
| `index` (entrada) | 123.71 kB | **46.91 kB** | 37.44 kB | **16.16 kB** |
| `app3d` (diferido) | — | **18.73 kB** | — | **7.96 kB** |
| `gsap` (diferido) | 70.44 kB | **51.36 kB** | 27.72 kB | **20.10 kB** |
| `three` (diferido) | 521.98 kB | 521.98 kB | 131.28 kB | 131.28 kB |
| `math` (compartido) | — | 4.18 kB | — | 1.73 kB |

- JS inicial de la ruta 3D antes de three: ~716 kB brutos → **~121 kB** (~196 kB gz → ~46 kB gz). three solo se descarga si `use3D` (nunca en `?2d`).

**Verificación (preview + CDP)**
- `?2d`: cero requests a three/gsap/app3d; fallback visible.
- Ruta 3D: loader oculto 4754 ms (base 4955), cursor de la dueña visible 6573 ms (base 6775), 1020 draw calls/s en reposo (igual que base; se ataca en Fase 3).
- Deep link `/works/trama`: abre el detalle correcto sobre la escena 3D; Escape cierra y vuelve a `/`.
- Modo dev: `?2d` no pide three; deep links OK.
- Lighthouse móvil, mediana de 3 corridas **en la misma sesión** (base reconstruida en worktree de `b0d60da`, servida en :4183):

| Métrica | Base | Fase 2 |
| --- | ---: | ---: |
| Performance | 0.34 | 0.36 |
| LCP | 7764 ms | **5961 ms** (−23 %) |
| TBT | 5928 ms | **4603 ms** (−22 %) |
| Speed Index | 10091 ms | **8806 ms** (−13 %) |
| Unused JS | 300 ms | **150 ms** (−50 %) |
| Bootup | 13433 ms | 12867 ms |
| FCP | 2258 ms | 3241 ms (ruido alto bajo swiftshader: rango por corrida 2.2–9.5 s en la base) |

- Nota: verificación visual fina de la intro con gsap-core pendiente en navegador real (headless software no permite juicio visual); sin excepciones en consola y el resto de la secuencia (intro → cursor) se comporta igual.

### Fase 3 — Render bajo demanda

**Hecho**
- `src/core/loop.ts`: el loop acepta `isSettled()`; cuando todo está en reposo **no se programa más rAF** y `invalidate()` lo despierta. Cualquier cambio llama a `invalidate()`: pasos, zoom, giros, hover, apertura/cierre de detalle, tema, resize y texturas que llegan de forma asíncrona.
- `isSettled()` compuesto: cámara (`cameraFreeLook`, posición/mirada/FOV vs deseados), marcos (`frame`, escala/elevación/opacidades vs objetivos), progreso del corredor (`|target − progress|`) e intro (`intro.done()`).
- Resolución adaptativa (`app3d`): media móvil de 30 frames del tiempo de `renderer.render`; >18 ms sostenido baja el pixelRatio (pasos de 0.25, mínimo 1); <8 ms lo sube (máximo el del preset de calidad); histéresis de 2 s; desactivable con `?hires`. Solo ajusta después de la intro.
- `renderer.compileAsync(scene, camera)` al construir la escena (compila shaders sin bloquear) y un render de calentamiento antes de arrancar el loop.
- `powerPreference: 'high-performance'` ya estaba en `renderer.ts`; se conserva (sin regresión medida).

**Antes → después (CDP, WebGL software)**

| Métrica | Base | Fase 3 |
| --- | ---: | ---: |
| Draw calls/s en reposo | 1 020 | **0** |
| Draw calls al pulsar `→` (pico) | — | ~1 050 y vuelve a 0 al asentarse |
| FCP observado real (sin throttling, `performance.getEntriesByType('paint')`) | 1 872 ms | **104–356 ms** |
| pixelRatio bajo swiftshader | fijo 2 | adapta 2 → 1 (`?hires` lo fija) |

**Lighthouse móvil (mediana de 3, misma sesión que la base en :4183)**

| Métrica | Base | Fase 3 |
| --- | ---: | ---: |
| Performance | 0.36 | 0.35 |
| LCP | 6965 ms | **6105 ms** (−12 %) |
| TBT | 4849 ms | **3853 ms** (−21 %) |
| Speed Index | 8614 ms | 9096 ms (dentro del ruido entre sesiones) |
| FCP simulado | 2258 ms | 3268 ms |

- Nota sobre FCP: el FCP *simulado* de Lighthouse empeora ~1 s (artefacto del modelo de simulación con la cadena de chunks diferidos), pero el FCP **observado** mejora de 1.87 s a 0.10–0.36 s. Se prioriza el dato observado.
- Con la escena en reposo el GPU queda a ~0 % de trabajo de dibujo (0 draw calls/s); durante interacción el loop despierta y vuelve a dormir al asentarse (verificado con teclado: `→`, `Enter`, `Escape`).

### Fase 4 — Imágenes

**Hecho**
- `src/utils/media.ts` (nuevo): detección de medios locales raster, `mediaSrcSet` (AVIF/WebP), `mediaVariant` (variante 3D más cercana sin quedarse corta) y `createResponsiveImage` (`<picture>` con AVIF + WebP y fallback al original; SVG y URLs remotas quedan como `<img>` simple).
- `detailView` y `listView2D` usan `createResponsiveImage` con `sizes` acordes al layout real (`(max-width: 920px) 92vw, 880px` y `(max-width: 720px) 92vw, 380px`); se conservan `loading="lazy"`, `decoding="async"` y dimensiones. El CLS ya estaba cubierto por `aspect-ratio` en CSS.
- `loader.ts`: anisotropía por preset de calidad (8/4/1) en lugar del 4 fijo; los covers raster locales usan la variante WebP más cercana a `textureMax`; los SVG se decodifican vía `createObjectURL`/`revokeObjectURL` en vez de depender de la caché del DOM.
- `optimize-media.mjs`: idempotente (omite variantes más nuevas que el origen), flag `--force` y resumen “generadas / al día”.

**Verificación**
- Prueba end-to-end con un raster temporal (2400×1650): en `?2d` el navegador elige `sample@640.avif` (para un slot de 380 px); en 3D el loader pide `sample@1280.webp` con `textureMax` 1024 (tier medium bajo swiftshader). Restaurado tras la prueba.
- `optimize:media`: 1.ª corrida 6 variantes generadas; 2.ª corrida 0 generadas / 6 al día.
- 5 tests unitarios nuevos de media (9 en total).
- Nota: hoy `public/media` son 25 SVG placeholder (196 kB en total); el camino `<picture>`/variantes se activa solo al añadir fotos reales y correr `npm run optimize:media`.

### Fase 5 — Fuentes

**Hecho**
- Auditoría de uso real: Fraunces 500 (loader, HUD, títulos de detalle/modal) y 400 (tagline de bio); Inter 400/500/700 (resto de UI). Sin uso: `fraunces-700.woff2` e `inter-600.woff2` (este último ni siquiera tenía `@font-face`; se precargaba desde un `<link>` huérfano **después de `</html>`**).
- Eliminados: los 2 woff2 sin uso, `public/fonts/fonts.css` (sin referencias en el proyecto) y la cara Fraunces 700 del CSS. Se corrigió el HTML quitando los `<link>` huérfanos.
- Preloads: se mantienen solo los 2 críticos (Fraunces 500 + Inter 400, que cubren todo el primer pantallazo del loader); `font-display: swap` ya estaba en todas las caras.
- Variable font: descartado (no hay archivo local con licencia verificable); se conservan los estáticos realmente usados, que pesan menos que un variable completo.
- Etiquetas 3D: `createScene3D` ahora es asíncrona y espera `document.fonts.load('500 36px Fraunces')` + `('500 20px Inter')` (tope de 1.5 s) antes de hornear las texturas de texto → sin FOUT en las etiquetas de los marcos.

**Verificación**
- La ruta 3D descarga solo `inter-400`, `fraunces-500`, `inter-500` e `inter-700`; cero requests a los archivos eliminados. `document.fonts.check()` = true para las caras usadas en las etiquetas.
- ~44 kB de fuentes eliminadas (18 kB + 24,5 kB) que ya no se descargan en ningún caso.
- Loader, intro y deep links sin cambios (probe CDP completo en verde).

### Fase 6 — DOM y puntero

**Hecho**
- `src/ui/cursor.ts`: `placeCursor` cachea el tamaño de la etiqueta (antes leía `offsetWidth`/`offsetHeight` en cada frame de los dos cursores; el de Alejandra anima a 60 fps de forma permanente). La caché se invalida en `resize`.
- `main.css`: `.cursor` pasa a `visibility: hidden` cuando no está visible (antes solo `opacity: 0`, y con `will-change: transform` seguía manteniendo su capa de composición).
- `src/interactions/raycaster.ts`: el rect del canvas se cachea y solo se relee tras `resize`/`scroll`/`orientationchange` (antes `getBoundingClientRect` en cada `pick`, y el hover hace uno por rAF); `candidates`/`map` se reutilizan entre picks (cero asignaciones); `dispose()` real, que el controlador del corredor ahora sí llama (antes era no-op y nunca se invocaba).
- `backdrop-filter` del modal: evaluado; se mantiene (ver «Descartado / no aplicado»).

**Verificación**
- 60 movimientos de puntero sintéticos (CDP, mismos eventos en ambos builds): lecturas de layout **219 → 5** (baseline: 60 `getBoundingClientRect` + 159 `offsetWidth/Height`; nuevo: 1 `getBoundingClientRect` inicial + una medición por cada uno de los 2 cursores).
- Cursor cliente en probe: `is-visible`, transform y volteo `label-left`/`label-above` correctos al llegar a la esquina; cursor de Alejandra visible; loader intacto (su etiqueta es fija y solo cambia el `%` de otro nodo).
- `typecheck`, `lint`, 9 tests y build en verde; `perf-probe` (0 draw calls en reposo) y `phase2-probe` (`?2d`, deep link, Esc) en verde.

### Fase 7 — Interacciones

**Hecho**
- Teclado unificado: eliminado `attachKeyboard` (y `src/interactions/keyboard.ts`) del corredor; queda como única fuente el handler global de `main.ts`, que ya tenía el orden por capas (ayuda → detalle → sección), el guard de campos editables y el de intro. Antes ambos escuchaban en `window`, así que **cada flecha/Enter/Escape/? se ejecutaba dos veces** (una flecha saltaba 2 proyectos).
- `dragThreshold` 60 → 8 px (`scene.config.ts`): había una zona muerta de 60 px en la que el swipe no giraba la cámara y terminaba contando como tap (abría proyecto sin querer).
- `drag.ts`: un segundo puntero durante un arrastre cancela el gesto (cede al pellizco) y `pointercancel` cierra el arrastre llamando a `onDragEnd` (antes podía quedar `draggingLook` colgado y bloquear hover/taps hasta el siguiente arrastre completo).
- `#scene` pasa a `touch-action: none`: el pellizco y el arrastre sobre el canvas ya no compiten con el pan/zoom del navegador. Los overlays conservan su `touch-action` normal y el viewport mantiene su configuración accesible (sin `user-scalable=no`).

**Verificación**
- Antes/después con probe CDP: 1×ArrowRight + Enter abría **Umbra** (índice 2, doble paso); ahora abre **Trama** (índice 1). Escape cierra el detalle.
- Táctil emulado (390×844, eventos touch reales vía CDP): drag de 1 dedo despierta el render (582 draws/s durante el gesto) y vuelve a 0 en reposo; pellizco igual (336/s → 0); tap suelto sin errores.
- `typecheck`, `lint`, 9 tests y build en verde; `perf-probe` (0 draw calls en reposo) y `phase2-probe` (`?2d`, deep link, Esc) en verde.

### Fase 8 — HTML y metadatos

**Hecho**
- Typo corregido: «en una pasillo 3D» → «en un pasillo 3D» en `description`, `og:description` y `twitter:description`.
- og-image: los crawlers sociales no soportan SVG, así que se generó `public/og-image.png` (1200×630) rasterizando el `og-image.svg` existente con Chrome headless (mismo diseño; el SVG usa Georgia/Helvetica del sistema). `og:image`/`twitter:image` pasan a la URL absoluta del PNG con `og:image:type/width/height/alt` y `twitter:image:alt`.
- JSON-LD (`Person`): añadida la propiedad `image` (og-image.png); sigue inyectándose en runtime desde `content` para no duplicar datos en el HTML.
- `siteConfig.ogImage` actualizado a la ruta del PNG (estaba desactualizado y sin uso).

**Verificación**
- Probe CDP: `og:image` absoluto y dimensiones 1200×630; JSON-LD con `name`, `image` y 4 `sameAs`; `/og-image.png` responde 200 `image/png` (343 kB) y decodifica a 1200×630.
- `typecheck`, `lint`, 9 tests y build en verde; `phase2-probe` en verde. `robots.txt`, `sitemap.xml` (home, about, contact y las 6 fichas) y `manifest.webmanifest` ya eran correctos.

### Fase 9 — API de contacto

**Hecho**
- `api/contact.ts` (zod se queda aquí, en el servidor): un body de texto que no es JSON ya no revienta con 500 — se responde 400 `invalid_payload`.
- `sendWithResend` con `AbortSignal.timeout(5000)` y `try/catch`: un Resend colgado o inalcanzable ya no mantiene viva la función ni provoca 500.
- Con proveedor configurado y entrega fallida se responde 502 `delivery_failed` (el formulario ya muestra su estado de error); sin `RESEND_API_KEY` (desarrollo) se conserva el 200 con log, como antes.
- Rate limit: la tabla de IPs se poda al alcanzar 1000 entradas (antes podía crecer sin límite en instancias longevas).
- 7 tests nuevos del handler: método, JSON roto, schema/honeypot, dev sin proveedor, éxito con Resend simulado, 502 y rate limit.

**Verificación**
- `typecheck`, `lint` y 16 tests en verde (4 contenido + 5 media + 7 API).
- Nota: sin `RESEND_API_KEY` no hay entrega real; el camino de éxito se verificó con `fetch` simulado.

## Descartado / no aplicado

- `backdrop-filter` del modal de detalle (blur 6px) y de los paneles: se mantiene. Con el render bajo demanda (Fase 3), mientras el detalle o un panel están abiertos el canvas queda quieto (0 draw calls verificados), así que el blur se pinta una vez y el navegador lo cachea; solo se recalcularía durante la animación de cámara (~1 s) y en el área pequeña de la barra inferior. Restringirlo a móvil no mostró una mejora medible bajo swiftshader y alteraría la composición visual, fuera de alcance.

## Pendientes

- Checklist manual en dispositivo real: las verificaciones de este informe se hicieron con Chrome headless y WebGL software (swiftshader), que pesimiza los números absolutos. Falta probar con hardware real: loader/Omitir/intro, hover/clic/detalle, rueda/flechas (1 paso)/drag/pinch, Esc por capas, deep links, temas e idioma, `prefers-reduced-motion`, resize, pestaña oculta, `?2d`, Tab/foco y formulario.
- Lighthouse de producción en un dispositivo/red reales para cerrar los números definitivos (las comparaciones de este informe son relativas y en la misma sesión).
- Fotos reales: hoy `public/media` son 25 SVG placeholder; al añadir los originales raster hay que correr `npm run optimize:media` para generar las variantes AVIF/WebP que consume el pipeline `<picture>`/texturas.
- Decisión final de despliegue: la rama `perf/optimizacion` no se ha empujado ni mergeado a `main`; el despliegue en Vercel queda a la espera de confirmación.
