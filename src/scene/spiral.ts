import { Group, Vector3 } from 'three';
import type { Project } from '@/types/project';
import { createFrame, type FrameHandle } from './frame';
import { buildLayoutConfig, framePosition, type LayoutConfig } from './layout';
import type { Capabilities } from '@/types/theme';

export interface Spiral {
  group: Group;
  frames: FrameHandle[];
  layout: LayoutConfig;
  setActiveIndex: (index: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createSpiral(projects: Project[], caps: Capabilities): Spiral {
  const layout = buildLayoutConfig(caps);
  const group = new Group();
  const frames: FrameHandle[] = [];

  const tmp = new Vector3();

  projects.forEach((project, index) => {
    const frame = createFrame(project, index);

    const wrapper = new Group();
    framePosition(index, projects.length, layout, tmp);
    wrapper.position.copy(tmp);
    wrapper.lookAt(0, wrapper.position.y, 0);
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
