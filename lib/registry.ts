import * as THREE from 'three';

/** Named 3D objects, so tests (and the debug hook) can find a part on screen. */
export const parts = new Map<string, THREE.Object3D>();
export const view: { camera: THREE.Camera | null; size: { width: number; height: number; left: number; top: number } } = {
  camera: null,
  size: { width: 1, height: 1, left: 0, top: 0 },
};

export function reg(key: string) {
  return (o: THREE.Object3D | null) => {
    if (o) parts.set(key, o);
    else parts.delete(key);
  };
}

export function project(key: string): { x: number; y: number } | null {
  const o = parts.get(key);
  if (!o || !view.camera) return null;
  const v = new THREE.Vector3();
  o.getWorldPosition(v);
  v.project(view.camera);
  return {
    x: view.size.left + ((v.x + 1) / 2) * view.size.width,
    y: view.size.top + ((1 - v.y) / 2) * view.size.height,
  };
}
