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

## Descartado / no aplicado

_(se completa al final)_

## Pendientes

_(se completa al final)_
