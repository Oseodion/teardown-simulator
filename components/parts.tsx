'use client';
import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame, type ThreeEvent, type ThreeElements } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Detached } from '@/lib/store';
import { now } from '@/lib/store';
import { COL, M } from '@/lib/materials';

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = (x: number) => {
  const t = clamp(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/** True when the pointer moved enough to be an orbit drag rather than a tap. */
export const isDrag = (e: ThreeEvent<MouseEvent>) => e.delta > 8;

export const worldPos = (o: THREE.Object3D | null): [number, number, number] => {
  const v = new THREE.Vector3();
  if (o) o.getWorldPosition(v);
  return [v.x, v.y, v.z];
};

export function setCursor(on: boolean) {
  if (typeof document !== 'undefined') document.body.style.cursor = on ? 'pointer' : '';
}
export const hoverProps = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setCursor(true);
  },
  onPointerOut: () => setCursor(false),
};

/** A detached part: eases out from where it came off, drifts and turns slowly, with a leader line and a mono tag. */
export function Floater({ d, labels, children, distance = 1.6 }: { d: Detached; labels: boolean; children: ReactNode; distance?: number }) {
  const g = useRef<THREE.Group>(null);
  const tag = useRef<THREE.Group>(null);
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: COL.frame, transparent: true, opacity: 0.55 }));
    l.frustumCulled = false;
    return l;
  }, []);
  const seed = useMemo(() => (d.id.length * 13.37) % 6.28, [d.id]);
  useFrame(() => {
    const t = now() - d.t0;
    const k = 1 - Math.exp(-t * 1.5);
    const bob = Math.sin(now() * 1.1 + seed) * 0.05;
    const x = d.origin[0] + d.dir[0] * distance * k;
    const y = d.origin[1] + d.dir[1] * distance * k + bob * k;
    const z = d.origin[2] + d.dir[2] * distance * k;
    if (g.current) {
      g.current.position.set(x, y, z);
      g.current.rotation.y = seed + t * 0.25;
      g.current.rotation.z = Math.sin(t * 0.6 + seed) * 0.15 * k;
    }
    if (tag.current) tag.current.position.set(x + 0.45, y + 0.4, z);
    const p = line.geometry.attributes.position as THREE.BufferAttribute;
    p.setXYZ(0, d.origin[0], d.origin[1], d.origin[2]);
    p.setXYZ(1, x, y, z);
    p.setXYZ(2, x + 0.45, y + 0.4, z);
    p.needsUpdate = true;
    line.visible = labels;
  });
  return (
    <>
      <group ref={g}>{children}</group>
      <primitive object={line} />
      <group ref={tag}>
        {labels && (
          <Html center={false} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="tag">
              <i />
              {d.label}
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

/** A cylinder joint ring in the accent colour. Axis along local Y. */
export function Ring({ r = 0.08, h = 0.04, ...p }: { r?: number; h?: number } & ThreeElements['mesh']) {
  return (
    <mesh material={M.accent} {...p}>
      <cylinderGeometry args={[r, r, h, 20]} />
    </mesh>
  );
}

/** Damped 0..1 follower for a boolean, read inside useFrame. */
export function useFollow(on: boolean, speed = 4) {
  const r = useRef({ v: on ? 1 : 0 });
  useFrame((_, dt) => {
    r.current.v = damp(r.current.v, on ? 1 : 0, speed, Math.min(dt, 0.1));
  });
  return r;
}
