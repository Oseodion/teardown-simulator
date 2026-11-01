'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTD, type MonsterId } from '@/lib/store';
import { view } from '@/lib/registry';
import Cerberus from './monsters/Cerberus';
import Kraken from './monsters/Kraken';
import Griffin from './monsters/Griffin';
import { setCursor } from './parts';

type OrbitImpl = React.ComponentRef<typeof OrbitControls>;

const FRAME: Record<MonsterId, { target: [number, number, number]; radius: number; dir: [number, number, number] }> = {
  cerberus: { target: [0, 1.0, 0.25], radius: 2.15, dir: [0.4, 0.3, 1] },
  kraken: { target: [0, 1.15, 0], radius: 2.45, dir: [0.35, 0.32, 1] },
  griffin: { target: [0, 1.75, 0], radius: 3.3, dir: [0.22, 0.12, 1] },
};

function RadarGrid() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const ring = (r: number, seg = 128) => {
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const b = ((i + 1) / seg) * Math.PI * 2;
        pts.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(b) * r, 0, Math.sin(b) * r);
      }
    };
    [1, 2, 3, 4.2, 5.6].forEach((r) => ring(r));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      pts.push(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6, Math.cos(a) * 5.6, 0, Math.sin(a) * 5.6);
    }
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r1 = 3.0;
      const r2 = i % 6 === 0 ? 3.18 : 3.08;
      pts.push(Math.cos(a) * r1, 0, Math.sin(a) * r1, Math.cos(a) * r2, 0, Math.sin(a) * r2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo} position={[0, 0.002, 0]} renderOrder={-1}>
      <lineBasicMaterial color="#9ea2a8" transparent opacity={0.32} depthWrite={false} />
    </lineSegments>
  );
}

function Rig({ active }: { active: MonsterId }) {
  const { camera, size, gl } = useThree();
  const controls = useRef<OrbitImpl>(null);
  useEffect(() => {
    view.camera = camera;
    const r = gl.domElement.getBoundingClientRect();
    view.size = { width: r.width, height: r.height, left: r.left, top: r.top };
  }, [camera, size, gl]);
  useEffect(() => {
    const f = FRAME[active];
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    // fit the monster's bounding radius for both portrait and landscape viewports
    const vfov = (cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const fit = Math.min(vfov, hfov);
    const mobile = size.width <= 768;
    const dist = (f.radius / Math.sin(fit / 2)) * (mobile ? 0.8 : 0.82);
    const d = new THREE.Vector3(f.dir[0] * (mobile ? 0.5 : 1), f.dir[1], f.dir[2]).normalize().multiplyScalar(dist);
    const tgt = new THREE.Vector3(...f.target);
    cam.position.copy(tgt).add(d);
    // on phones, centre the monster in the band between the top strip and the bottom sheet
    if (mobile) cam.setViewOffset(size.width, size.height, 0, Math.round(size.height * 0.07), size.width, size.height);
    else cam.clearViewOffset();
    cam.lookAt(tgt);
    if (controls.current) {
      controls.current.target.copy(tgt);
      controls.current.minDistance = dist * 0.45;
      controls.current.maxDistance = dist * 1.8;
      controls.current.update();
    }
  }, [active, camera, size.width, size.height]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} enablePan={false} maxPolarAngle={Math.PI * 0.49} rotateSpeed={0.7} />;
}

export default function Scene() {
  const active = useTD((s) => s.active);
  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.05, far: 80, position: [4, 3, 8] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      style={{ touchAction: 'none' }}
      onPointerMissed={() => setCursor(false)}
    >
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#ffffff', '#c9ccd0', 0.75]} />
      <directionalLight position={[3, 7, 5]} intensity={1.35} />
      <directionalLight position={[-5, 4, -2]} intensity={0.45} />
      <directionalLight position={[0, 2, 6]} intensity={0.35} />
      <RadarGrid />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.42} scale={9} blur={2.6} far={3.5} resolution={512} color="#2b2d31" frames={Infinity} />
      <group visible={active === 'cerberus'}>{active === 'cerberus' && <Cerberus />}</group>
      <group visible={active === 'kraken'}>{active === 'kraken' && <Kraken />}</group>
      <group visible={active === 'griffin'}>{active === 'griffin' && <Griffin />}</group>
      <Rig active={active} />
    </Canvas>
  );
}
