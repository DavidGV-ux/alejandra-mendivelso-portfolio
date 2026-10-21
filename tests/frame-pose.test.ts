import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { computeFrontalPose, frameNormal, frameTransform } from '@/scene/framePose';
import type { CorridorLayout } from '@/scene/corridor';

const layout: CorridorLayout = {
  spacing: 4,
  width: 24,
  height: 4.5,
  depth: 60,
  wallOffset: 4.8,
  compact: false,
};

const compactLayout: CorridorLayout = { ...layout, compact: true, wallOffset: 4.8 * 0.82, spacing: 4 * 0.82 };

function applyPose(camera: PerspectiveCamera, pose: ReturnType<typeof computeFrontalPose>): void {
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld(true);
}

describe('pose frontal de marcos', () => {
  it.each([
    [6, layout],
    [7, layout],
    [8, layout],
    [6, compactLayout],
    [7, compactLayout],
    [8, compactLayout],
  ] as const)('total=%s compact=%s: cámara de frente a cada marco', (total, current) => {
    for (let i = 0; i < total; i++) {
      const tf = frameTransform(i, total, current);
      const n = tf.normal;
      const center = tf.position.clone().addScaledVector(n, 0.024);
      const pose = computeFrontalPose({ center, normal: n, distance: 3, fov: 62 });
      const camera = new PerspectiveCamera(62, 16 / 9, 0.1, 200);
      camera.rotation.order = 'YXZ';
      applyPose(camera, pose);

      const F = camera.getWorldDirection(new Vector3());
      expect(F.dot(n)).toBeCloseTo(-1, 5);
      expect(pose.position.clone().sub(center).dot(n)).toBeGreaterThan(0);

      const projected = center.clone().project(camera);
      expect(projected.x).toBeCloseTo(0, 5);

      const W = 4;
      const H = 2.75;
      const locals = [
        new Vector3(-W / 2, -H / 2, 0),
        new Vector3(W / 2, -H / 2, 0),
        new Vector3(W / 2, H / 2, 0),
        new Vector3(-W / 2, H / 2, 0),
      ].map((v) => {
        v.applyAxisAngle(new Vector3(0, 1, 0), tf.rotationY);
        v.add(center);
        return v.project(camera);
      });
      expect(locals[0]!.y).toBeCloseTo(locals[1]!.y, 5);
      expect(locals[2]!.y).toBeCloseTo(locals[3]!.y, 5);
    }
  });

  it('la convención de yaw del rig mira a lo largo de −normal', () => {
    const n = new Vector3(0, 0, 1);
    const center = new Vector3(0, 0, 0);
    const pose = computeFrontalPose({ center, normal: n, distance: 2, fov: 62 });
    const lookDir = new Vector3(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
    expect(lookDir.dot(n)).toBeCloseTo(-1, 5);
    expect(pose.position.z).toBeGreaterThan(0);
  });

  it('yaw + π mira al revés (regresión)', () => {
    const n = new Vector3(0, 0, 1);
    const pose = computeFrontalPose({
      center: new Vector3(),
      normal: n,
      distance: 2,
      fov: 62,
    });
    const flipped = new Vector3(Math.sin(pose.yaw + Math.PI), 0, Math.cos(pose.yaw + Math.PI));
    expect(flipped.dot(n)).toBeCloseTo(1, 5);
  });

  it('normal fija (0,0,1) coloca la cámara en +Z mirando al origen', () => {
    const n = frameNormal(0);
    expect(n.x).toBeCloseTo(0);
    expect(n.z).toBeCloseTo(1);
    const pose = computeFrontalPose({
      center: new Vector3(1, 0, 5),
      normal: n,
      distance: 3,
      fov: 62,
    });
    expect(pose.position.z).toBeCloseTo(8);
    const camera = new PerspectiveCamera(62, 1, 0.1, 200);
    applyPose(camera, pose);
    expect(camera.getWorldDirection(new Vector3()).z).toBeCloseTo(-1, 5);
  });

  it('con total impar el fondo queda formado por tres marcos de frente', () => {
    const total = 7;
    const closing = [4, 5, 6].map((i) => frameTransform(i, total, layout));
    const xs = closing.map((t) => t.position.x);
    expect(xs[0]).toBeLessThan(0);
    expect(xs[1]).toBeCloseTo(0, 5);
    expect(xs[2]).toBeGreaterThan(0);
    expect(Math.abs(xs[1]! - xs[0]!)).toBeGreaterThan(4);
    expect(Math.abs(xs[2]! - xs[1]!)).toBeGreaterThan(4);
    for (const t of closing) {
      expect(t.position.z).toBeCloseTo(closing[0]!.position.z, 5);
      expect(t.rotationY).toBeCloseTo(Math.PI, 5);
      expect(t.normal.z).toBeCloseTo(-1, 5);
    }
    // El marco nuevo no desplaza a los laterales ni deja uno suelto.
    expect(frameTransform(3, total, layout).rotationY).not.toBeCloseTo(Math.PI, 5);
  });

  it('con total par el fondo conserva dos marcos', () => {
    const total = 6;
    const closing = [4, 5].map((i) => frameTransform(i, total, layout));
    for (const t of closing) {
      expect(t.rotationY).toBeCloseTo(Math.PI, 5);
      expect(t.normal.z).toBeCloseTo(-1, 5);
    }
    expect(frameTransform(3, total, layout).rotationY).not.toBeCloseTo(Math.PI, 5);
  });
});
