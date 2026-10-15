import { gsap } from 'gsap/gsap-core';
import type { Group } from 'three';
import type { Corridor } from '@/scene/corridor';

export interface IntroAnim {
  play: () => void;
  skip: () => void;
  done: () => boolean;
  dispose: () => void;
}

export function createIntro(spiral: Corridor, reducedMotion: boolean): IntroAnim {
  const wrappers: Group[] = spiral.frames.map(
    (frame) => frame.group.userData.wrapper as Group,
  );
  const finals = wrappers.map((w) => w.position.clone());
  let finished = false;
  const timelines: Array<ReturnType<typeof gsap.timeline>> = [];

  function setFinal(): void {
    wrappers.forEach((w, i) => {
      w.position.copy(finals[i]!);
      w.rotation.set(0, 0, 0);
      w.scale.setScalar(1);
    });
  }

  function skip(): void {
    if (finished) return;
    finished = true;
    timelines.forEach((t) => t.kill());
    timelines.length = 0;
    setFinal();
  }

  function play(): void {
    if (reducedMotion) {
      setFinal();
      finished = true;
      return;
    }
    wrappers.forEach((w, i) => {
      const final = finals[i]!;
      w.position.set(final.x, final.y - 16, final.z);
      w.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.35;
      w.scale.setScalar(0.85);

      const tl = gsap.timeline();
      tl.to(w.position, {
        x: final.x,
        y: final.y,
        z: final.z,
        duration: 1.25,
        ease: 'power3.out',
      })
        .to(w.rotation, { z: 0, duration: 1.0, ease: 'power3.out' }, 0)
        .to(w.scale, { x: 1, y: 1, z: 1, duration: 1.0, ease: 'power3.out' }, 0);
      tl.delay(i * 0.06);
      timelines.push(tl);
    });

    const totalDuration = 1.25 + (wrappers.length - 1) * 0.06;
    gsap.delayedCall(totalDuration, () => {
      finished = true;
    });
  }

  return {
    play,
    skip,
    done: () => finished,
    dispose: () => {
      timelines.forEach((t) => t.kill());
      timelines.length = 0;
    },
  };
}
