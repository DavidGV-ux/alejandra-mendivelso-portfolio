import { Group, Vector3 } from 'three';
import type { Project } from '@/types/project';
import { createFrame, type FrameHandle } from './frame';
import type { Capabilities } from '@/types/theme';

export interface CorridorLayout {
  spacing: number;
  width: number;
  height: number;
  depth: number;
  wallOffset: number;
  compact: boolean;
}

export function buildCorridorLayout(caps: Capabilities): CorridorLayout {
  const compact = Math.min(window.innerWidth, window.innerHeight) < 560 || caps.tier === 'low';
  const scale = compact ? 0.82 : 1;
  return {
    spacing: 5.2 * scale,
    width: 24 * scale,
    height: 4.5 * scale,
    depth: 60 * scale,
    wallOffset: 5.2 * scale,
    compact,
  };
}

/** Profundidad de la pantalla que cierra el pasillo, más allá del último marco. */
export function endScreenZ(total: number, layout: CorridorLayout): number {
  const pairCount = Math.ceil(total / 2);
  const center = ((pairCount - 1) / 2) * layout.spacing;
  return Math.floor((total - 1) / 2) * layout.spacing - center + layout.spacing * 2.2;
}

export function framePositionCorridor(
  index: number,
  total: number,
  config: CorridorLayout,
  out: Vector3 = new Vector3(),
): Vector3 {
  const pairCount = Math.ceil(total / 2);
  const center = ((pairCount - 1) / 2) * config.spacing;
  const x = (index % 2 === 0 ? -config.wallOffset : config.wallOffset) * (config.compact ? 0.85 : 1);
  const y = 0;
  const z = Math.floor(index / 2) * config.spacing - center;
  return out.set(x, y, z);
}

export interface Corridor {
  group: Group;
  frames: FrameHandle[];
  layout: CorridorLayout;
  setActiveIndex: (index: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createCorridor(
  projects: Project[],
  caps: Capabilities,
): Corridor {
  const layout = buildCorridorLayout(caps);
  const group = new Group();
  const frames: FrameHandle[] = [];
  const tmp = new Vector3();

  projects.forEach((project, index) => {
    const frame = createFrame(project, index);
    const wrapper = new Group();
    framePositionCorridor(index, projects.length, layout, tmp);
    wrapper.position.copy(tmp);
    wrapper.lookAt(0, tmp.y, tmp.z);
    wrapper.add(frame.group);
    frame.group.userData.wrapper = wrapper;
    group.add(wrapper);
    frames.push(frame);
  });

  let activeIndex = 0;

  return {
    group,
    frames,
    layout,
    setActiveIndex(index: number): void {
      activeIndex = index;
      frames.forEach((frame) => frame.setActive(frame.index === index));
    },
    update(dt: number): void {
      for (const frame of frames) frame.update(dt);
      void activeIndex;
    },
    dispose(): void {
      frames.forEach((frame) => {
        const wrapper = frame.group.userData.wrapper as Group | undefined;
        frame.dispose();
        wrapper?.clear();
      });
      group.clear();
    },
  };
}
