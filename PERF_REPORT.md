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

## Descartado / no aplicado

_(se completa al final)_

## Pendientes

_(se completa al final)_
