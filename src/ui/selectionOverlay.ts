import type { UIContext } from '@/types/ui';
import type { FrameHandle } from '@/scene/frame';

export interface SelectionOverlay {
  el: HTMLElement;
  update(frames: FrameHandle[], camera: any, selectedIdx: number | null, hoverIdx: number | null): void;
  dispose(): void;
}

export function createSelectionOverlay(ctx: UIContext, _canvas: HTMLElement): SelectionOverlay {
  void _canvas;
  const sel = document.createElement('svg');
  sel.id = 'sel';
  sel.setAttribute('aria-hidden', 'true');
  sel.style.position = 'fixed';
  sel.style.inset = '0';
  sel.style.width = '100%';
  sel.style.height = '100%';
  sel.style.pointerEvents = 'none';
  sel.style.zIndex = '4';

  const hoverPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  hoverPoly.id = 'sel-hover';
  const boxPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  boxPoly.id = 'sel-box';
  const rects: SVGRectElement[] = [];
  for (let i = 0; i < 4; i++) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement;
    r.setAttribute('width', '9');
    r.setAttribute('height', '9');
    r.style.display = 'none';
    rects.push(r);
    sel.append(r);
  }
  sel.append(hoverPoly, boxPoly);

  const labels: HTMLSpanElement[] = [];
  for (const project of ctx.projects) {
    const span = document.createElement('span');
    span.className = 'sel-label';
    span.textContent = project.title;
    span.style.position = 'fixed';
    span.style.left = '0';
    span.style.top = '0';
    span.style.transformOrigin = '0 100%';
    span.style.display = 'none';
    document.body.append(span);
    labels.push(span);
  }

  const goBtn = document.createElement('button');
  goBtn.className = 'sel-go';
  goBtn.textContent = ctx.dict.works?.view ?? 'Ver proyecto';
  goBtn.style.position = 'fixed';
  goBtn.style.left = '0';
  goBtn.style.top = '0';
  goBtn.style.transformOrigin = '0 0';
  goBtn.style.display = 'none';
  goBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentSelectedIdx != null) {
      const p = ctx.projects[currentSelectedIdx];
      if (p) ctx.actions.openDetail(p.id);
    }
  });
  document.body.append(goBtn);

  let lastBox = '';
  let lastHover = '';
  let currentSelectedIdx: number | null = null;

  function update(frames: FrameHandle[], camera: any, selectedIdx: number | null, hoverIdx: number | null): void {
    currentSelectedIdx = selectedIdx;
    const mode = ctx.store.get();
    if (mode.section !== 'works' || mode.detailProjectId || mode.helpOpen || !mode.introDone) {
      hoverPoly.setAttribute('points', '');
      boxPoly.setAttribute('points', '');
      rects.forEach((r) => (r.style.display = 'none'));
      labels.forEach((l) => (l.style.display = 'none'));
      goBtn.style.display = 'none';
      return;
    }

    for (const label of labels) label.classList.remove('is-selected');

    let boxPoints = '';
    let hoverPoints = '';

    const debug = new URLSearchParams(location.search).has('debug');
    const selCorners = new Float32Array(8);
    if (selectedIdx != null && frames[selectedIdx]) {
      const selectedFrame = frames[selectedIdx]!;
      const ok = selectedFrame.getScreenCorners(camera, window.innerWidth, window.innerHeight, selCorners);
      if (!ok && debug) {
        // eslint-disable-next-line no-console -- diagnóstico con ?debug
        console.warn(`[DEBUG OVERLAY] discarded frame ${selectedIdx}`);
      }
      if (ok) {
        const pts = `${(selCorners as any)[0]},${(selCorners as any)[1]} ${(selCorners as any)[2]},${(selCorners as any)[3]} ${(selCorners as any)[4]},${(selCorners as any)[5]} ${(selCorners as any)[6]},${(selCorners as any)[7]}`;
        boxPoints = pts;
        // rects
        rects[0]!.style.display = 'block';
        rects[0]!.setAttribute('x', String((selCorners as any)[0] - 4.5));
        rects[0]!.setAttribute('y', String((selCorners as any)[1] - 4.5));
        for (let i = 1; i < 4; i++) {
          rects[i]!.style.display = 'block';
          rects[i]!.setAttribute('x', String((selCorners as any)[i * 2] - 4.5));
          rects[i]!.setAttribute('y', String((selCorners as any)[i * 2 + 1] - 4.5));
        }
        // label transform based on top edge
        const label = labels[selectedIdx];
        if (label) {
          label.classList.add('is-selected');
          label.style.display = 'block';
          const dx = (selCorners as any)[4] - (selCorners as any)[6];
          const dy = (selCorners as any)[5] - (selCorners as any)[7];
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          label.style.transform = `translate(${(selCorners as any)[6]}px, ${(selCorners as any)[7] - 18}px) rotate(${angle}deg)`;
        }
        // button under bottom-left
        const bdx = (selCorners as any)[2] - (selCorners as any)[0];
        const bdy = (selCorners as any)[3] - (selCorners as any)[1];
        const bangle = (Math.atan2(bdy, bdx) * 180) / Math.PI;
        goBtn.style.display = 'block';
        goBtn.style.transform = `translate(${(selCorners as any)[0]}px, ${(selCorners as any)[1] + 9}px) rotate(${bangle}deg)`;
      } else {
        boxPoints = '';
        rects.forEach((r) => (r.style.display = 'none'));
        labels.forEach((l) => (l.style.display = 'none'));
        goBtn.style.display = 'none';
      }
    } else {
      rects.forEach((r) => (r.style.display = 'none'));
      goBtn.style.display = 'none';
    }

    if (hoverIdx != null && selectedIdx !== hoverIdx && frames[hoverIdx]) {
      const hCorners = new Float32Array(8);
      const hoverFrame = frames[hoverIdx]!;
      const ok = hoverFrame.getScreenCorners(camera, window.innerWidth, window.innerHeight, hCorners);
      if (ok) hoverPoints = `${(hCorners as any)[0]},${(hCorners as any)[1]} ${(hCorners as any)[2]},${(hCorners as any)[3]} ${(hCorners as any)[4]},${(hCorners as any)[5]} ${(hCorners as any)[6]},${(hCorners as any)[7]}`;
    }

    if (boxPoints !== lastBox) {
      boxPoly.setAttribute('points', boxPoints);
      lastBox = boxPoints;
    }
    if (hoverPoints !== lastHover) {
      hoverPoly.setAttribute('points', hoverPoints);
      lastHover = hoverPoints;
    }

    // labels for visible frames
    for (let i = 0; i < frames.length; i++) {
      const label = labels[i];
      if (!label || i === selectedIdx) continue;
      const cs = new Float32Array(8);
      const frame = frames[i]!;
      const ok = frame.getScreenCorners(camera, window.innerWidth, window.innerHeight, cs);
      const widthProj = ok ? Math.hypot((cs as any)[4] - (cs as any)[6], (cs as any)[5] - (cs as any)[7]) : 0;
      if (ok && widthProj > 120) {
        label.style.display = 'block';
        const dx = (cs as any)[4] - (cs as any)[6];
        const dy = (cs as any)[5] - (cs as any)[7];
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        label.style.transform = `translate(${(cs as any)[6]}px, ${(cs as any)[7] - 18}px) rotate(${angle}deg)`;
      } else {
        label.style.display = 'none';
      }
    }
  }

  return {
    el: sel,
    update,
    dispose() {
      sel.remove();
      labels.forEach((l) => l.remove());
      goBtn.remove();
    },
  };
}