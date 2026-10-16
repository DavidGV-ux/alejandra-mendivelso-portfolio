import { AmbientLight, DirectionalLight, Group, HemisphereLight } from 'three';
import { sceneConfig } from '@/config/scene.config';
import { theme } from '@/config/theme';
import type { ThemeMode } from '@/types/theme';

interface LightsHandle {
  group: Group;
  setMode: (mode: Exclude<ThemeMode, 'auto'>) => void;
  dispose: () => void;
}

export function createLights(mode: Exclude<ThemeMode, 'auto'>): LightsHandle {
  const group = new Group();

  const ambient = new AmbientLight(0xffffff, sceneConfig.lights.ambient);

  const hemi = new HemisphereLight(0xffffff, 0x8a7f70, 0.5);
  hemi.position.set(0, 1, 0);

  const key = new DirectionalLight(0xffffff, sceneConfig.lights.key);
  key.position.set(6, 12, 8);

  const rim = new DirectionalLight(0xffffff, sceneConfig.lights.rim);
  rim.position.set(-8, 4, -6);

  group.add(ambient, hemi, key, rim);

  function setMode(next: Exclude<ThemeMode, 'auto'>): void {
    const isDark = next === 'dark';
    ambient.intensity = isDark ? 0.55 : sceneConfig.lights.ambient;
    hemi.intensity = isDark ? 0.35 : 0.5;
    key.intensity = isDark ? 0.9 : sceneConfig.lights.key;
    key.color.set(isDark ? '#ffe9d6' : '#ffffff');
    rim.intensity = sceneConfig.lights.rim;
    rim.color.set(theme.colors.accent);
    hemi.color.set(theme.colors.frame);
    hemi.groundColor.set(isDark ? '#0f0d0b' : '#ffffff');
  }
  setMode(mode);

  return {
    group,
    setMode,
    dispose: () => group.clear(),
  };
}
