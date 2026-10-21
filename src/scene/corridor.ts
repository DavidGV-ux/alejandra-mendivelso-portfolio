import { Group, Vector3 } from 'three';
import type { Project } from '@/types/project';
import { createFrame, type FrameHandle } from './frame';
import { frameTransform } from './framePose';
import {
  buildCorridorLayout,
  type CorridorLayout,
} from './corridorLayout';
import type { Capabilities } from '@/types/theme';

export * from './corridorLayout';

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
    const transform = frameTransform(index, projects.length, layout, tmp);
    wrapper.position.copy(transform.position);
    wrapper.rotation.y = transform.rotationY;
    wrapper.add(frame.group);
    frame.group.userData.wrapper = wrapper;
    frame.group.userData.rotationY = transform.rotationY;
    frame.group.userData.normal = transform.normal;
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
