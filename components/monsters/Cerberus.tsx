'use client';
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useTD, telemetry, now, type CerbHead, type Stump } from '@/lib/store';
import { M } from '@/lib/materials';
import { Floater, Ring, damp, hoverProps, isDrag, useFollow, worldPos } from '@/components/parts';
import { reg } from '@/lib/registry';

const ANCHOR = new THREE.Vector3(0, 1.12, 0.78);
const RAD = (d: number) => (d * Math.PI) / 180;

/** Fans N necks into rows so heads never stack: returns yaw, pitch and neck length per slot. */
export function fanLayout(n: number) {
  const rows = n <= 3 ? [n] : n === 4 ? [3, 1] : n === 5 ? [3, 2] : n === 6 ? [4, 2] : n === 7 ? [4, 3] : n === 8 ? [5, 3] : n === 9 ? [5, 4] : [5, 3, 2];
  const out: { yaw: number; pitch: number; len: number }[] = [];
  rows.forEach((c, r) => {
    const half = c === 1 ? 0 : Math.min(1.25, 0.32 * (c - 1) + 0.05);
    for (let i = 0; i < c; i++) {
      const u = c === 1 ? 0 : -half + (2 * half * i) / (c - 1);
      out.push({ yaw: u, pitch: -0.08 + r * 0.38 + Math.abs(u) * 0.06, len: (n <= 3 ? 0.78 : 0.74) + r * 0.16 });
    }
  });
  // interleave rows so neighbouring array slots stay neighbours on screen
  return out.sort((a, b) => a.yaw - b.yaw || a.pitch - b.pitch);
}

export function CerbHeadMesh({ jawRef }: { jawRef?: React.RefObject<THREE.Group | null> }) {
  return (
    <group>
      <RoundedBox args={[0.34, 0.28, 0.36]} radius={0.07} smoothness={3} material={M.shell} />
      <mesh material={M.frame} position={[0, -0.02, -0.16]}>
        <boxGeometry args={[0.26, 0.22, 0.1]} />
      </mesh>
      <RoundedBox args={[0.22, 0.14, 0.3]} radius={0.04} smoothness={2} position={[0, -0.04, 0.27]} material={M.shell} />
      <mesh material={M.lens} position={[0, -0.0, 0.43]}>
        <boxGeometry args={[0.1, 0.06, 0.04]} />
      </mesh>
      {/* brow plate */}
      <mesh material={M.frame} position={[0, 0.12, 0.12]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.14]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <group position={[s * 0.1, 0.05, 0.17]}>
            <mesh material={M.lens}>
              <sphereGeometry args={[0.045, 16, 12]} />
            </mesh>
            <mesh material={M.accent} position={[0, 0, 0.012]}>
              <torusGeometry args={[0.052, 0.014, 8, 24]} />
            </mesh>
          </group>
          <mesh material={M.shell} position={[s * 0.12, 0.2, -0.06]} rotation={[-0.5, 0, s * -0.35]}>
            <coneGeometry args={[0.06, 0.16, 4]} />
          </mesh>
          {/* upper fangs */}
          {[0, 1, 2].map((k) => (
            <mesh key={k} material={M.shell} position={[s * (0.045 + k * 0.025), -0.13, 0.36 - k * 0.06]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.014, 0.06, 6]} />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={jawRef} position={[0, -0.1, 0.02]}>
        <mesh material={M.frame} position={[0, -0.02, 0.15]}>
          <boxGeometry args={[0.18, 0.05, 0.3]} />
        </mesh>
        <RoundedBox args={[0.2, 0.05, 0.28]} radius={0.02} smoothness={2} position={[0, -0.05, 0.15]} material={M.shell} />
        {[-1, 1].map((s) => (
          <mesh key={s} material={M.shell} position={[s * 0.06, 0.02, 0.27]}>
            <coneGeometry args={[0.014, 0.06, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Neck({ segs = 5 }: { segs?: number }) {
  // unit length along +z; the parent scales z to the live neck length
  return (
    <group>
      <mesh material={M.frame} position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 1, 10]} />
      </mesh>
      {Array.from({ length: segs }, (_, i) => (
        <mesh key={i} material={M.shell} position={[0, 0, 0.14 + (i * 0.72) / (segs - 1)]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.11, 0.1, 14]} />
        </mesh>
      ))}
    </group>
  );
}

interface UnitProps {
  head: CerbHead;
  slot: { yaw: number; pitch: number; len: number };
  scale: number;
  ex: React.RefObject<{ v: number }>;
  index: number;
}

function HeadUnit({ head, slot, scale, ex, index }: UnitProps) {
  const root = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const hg = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const hitNeck = useRef<THREE.Mesh>(null);
  const fresh = head.born > now() - 0.5;
  const st = useRef({ yaw: fresh ? head.fromYaw : slot.yaw, pitch: fresh ? head.fromPitch : slot.pitch, ext: fresh ? 0 : 1, vel: 0, len: slot.len });
  const cutHead = useTD((s) => s.cutHead);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const t = state.clock.elapsedTime;
    const live = now() >= head.born;
    // spring arm: under-damped so the new neck overshoots and settles
    const target = live ? 1 : 0;
    const acc = 140 * (target - s.ext) - 11 * s.vel;
    s.vel += acc * dt;
    s.ext += s.vel * dt;
    s.yaw = damp(s.yaw, slot.yaw, 5, dt);
    s.pitch = damp(s.pitch, slot.pitch, 5, dt);
    s.len = damp(s.len, slot.len, 5, dt);
    const e = Math.max(0, s.ext);
    const strike = Math.sin(t * 1.6 + index * 0.9) * 0.04 + (ex.current?.v ?? 0) * 0.35;
    const L = s.len * e + strike;
    if (root.current) {
      root.current.rotation.set(-s.pitch + Math.sin(t * 2.1 + index) * 0.03, s.yaw, 0, 'YXZ');
    }
    if (neck.current) neck.current.scale.set(Math.max(0.001, Math.min(1, e)), Math.max(0.001, Math.min(1, e)), Math.max(0.001, L));
    if (hg.current) {
      hg.current.position.set(0, 0, L);
      hg.current.rotation.set(s.pitch - 0.1 + Math.sin(t * 3 + index) * 0.04, -s.yaw * 0.45, 0);
      const k = Math.max(0.001, e) * scale;
      hg.current.scale.setScalar(k);
    }
    if (hitNeck.current) {
      hitNeck.current.position.set(0, 0, L / 2);
      hitNeck.current.scale.set(1, Math.max(0.01, L), 1);
    }
    if (jaw.current) jaw.current.rotation.x = 0.22 + Math.max(0, Math.sin(t * 2.4 + index * 1.7)) * 0.28;
    // record live neck servo value for the dashboard
    const tel = telemetry.cerberus;
    const slotV = tel.servos.find((x) => x.name === `N${String(head.id).padStart(2, '0')}`);
    const val = Math.min(1, L / 1.2);
    if (slotV) {
      slotV.v = val;
      slotV.deg = (s.pitch * 180) / Math.PI;
    }
  });

  const onCut = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isDrag(e)) return;
    if (now() < head.born + 0.35) return; // still unfolding
    cutHead(head.id, worldPos(hg.current), st.current.yaw, st.current.pitch);
  };

  return (
    <group ref={root} position={ANCHOR.toArray()}>
      <Ring r={0.12} h={0.06} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.06]} />
      <group ref={neck}>
        <Neck />
      </group>
      <mesh ref={hitNeck} material={M.hit} rotation={[Math.PI / 2, 0, 0]} onClick={onCut} {...hoverProps}>
        <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
      </mesh>
      <group ref={hg}>
        <group ref={reg(`cerberus:head:${head.id}`)}>
          <Ring r={0.11} h={0.05} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.2]} />
          <CerbHeadMesh jawRef={jaw} />
          <mesh material={M.hit} onClick={onCut} {...hoverProps} position={[0, 0, 0.08]}>
            <sphereGeometry args={[0.3, 12, 10]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function StumpCap({ s }: { s: Stump }) {
  const g = useRef<THREE.Group>(null);
  const cap = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = now() - s.t;
    if (cap.current) cap.current.emissiveIntensity = 0.7 + Math.sin(t * 6) * 0.2;
  });
  return (
    <group ref={g} position={ANCHOR.toArray()} rotation={[-s.pitch, s.yaw, 0, 'YXZ']}>
      <group scale={[1, 1, 0.32]}>
        <Neck segs={2} />
      </group>
      <mesh position={[0, 0, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 18]} />
        <meshStandardMaterial ref={cap} color="#e8461e" emissive="#e8461e" emissiveIntensity={0.8} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Leg({ x, z, front, index, ex }: { x: number; z: number; front: boolean; index: number; ex: React.RefObject<{ v: number }> }) {
  const hip = useRef<THREE.Group>(null);
  const knee = useRef<THREE.Group>(null);
  const ankle = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const side = Math.sign(x);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const br = Math.sin(t * 1.9) * 0.035;
    const e = ex.current?.v ?? 0;
    // crouch: thigh forward, shin back, so the paw lands under the hip
    const h = (front ? 0.55 : -0.7) + br * (front ? 1 : -1);
    const k = (front ? -1.15 : 1.25) - br * 1.6 * (front ? 1 : -1);
    if (hip.current) hip.current.rotation.x = h;
    if (knee.current) knee.current.rotation.x = k;
    if (ankle.current) ankle.current.rotation.x = -(h + k);
    const y = 0.46 * Math.cos(h) + 0.44 * Math.cos(h + k) + 0.115;
    if (root.current) root.current.position.set(x + side * e * 0.45, y, z + (front ? 1 : -1) * e * 0.3);
    const tel = telemetry.cerberus.servos[index];
    if (tel) {
      tel.v = Math.min(1, Math.abs(k) / 1.6);
      tel.deg = (k * 180) / Math.PI;
    }
  });
  return (
    <group ref={root} position={[x, 0.98, z]}>
      <group ref={hip}>
        <mesh material={M.frame}>
          <sphereGeometry args={[0.1, 18, 14]} />
        </mesh>
        <Ring r={0.11} h={0.06} rotation={[0, 0, Math.PI / 2]} position={[side * 0.1, 0, 0]} />
        <mesh material={M.frame} position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.06, 0.32, 4, 10]} />
        </mesh>
        <RoundedBox args={[0.2, 0.36, 0.22]} radius={0.06} smoothness={2} position={[side * 0.02, -0.2, 0]} material={M.shell} />
        <group ref={knee} position={[0, -0.46, 0]}>
          <Ring r={0.085} h={0.2} rotation={[0, 0, Math.PI / 2]} />
          <mesh material={M.frame} position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.05, 0.3, 4, 10]} />
          </mesh>
          <RoundedBox args={[0.13, 0.28, 0.14]} radius={0.04} smoothness={2} position={[0, -0.2, 0.02]} material={M.shell} />
          <group ref={ankle} position={[0, -0.44, 0]}>
            <Ring r={0.06} h={0.15} rotation={[0, 0, Math.PI / 2]} />
            <RoundedBox args={[0.17, 0.08, 0.24]} radius={0.03} smoothness={2} position={[0, -0.05, 0.06]} material={M.frame} />
            {[-1, 0, 1].map((c) => (
              <mesh key={c} material={M.shell} position={[c * 0.05, -0.06, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.02, 0.07, 6]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

function Torso({ ex }: { ex: React.RefObject<{ v: number }> }) {
  const g = useRef<THREE.Group>(null);
  const plates = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const br = Math.sin(t * 1.9);
    const e = ex.current?.v ?? 0;
    if (g.current) {
      g.current.scale.set(1 + br * 0.015, 1 + br * 0.025, 1);
      g.current.position.y = 1.02 + br * 0.012;
    }
    if (plates.current) plates.current.position.y = e * 0.35;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 1.3) * 0.25;
    telemetry.cerberus.g2 = 0.5 + br * 0.5;
  });
  return (
    <group ref={g} position={[0, 1.02, 0]} rotation={[0.12, 0, 0]}>
      {/* frame spine and ribcage */}
      <mesh material={M.frame} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.3, 1.1, 6, 16]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} material={M.mid} position={[0, 0.02, -0.55 + i * 0.22]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.33, 0.025, 8, 24]} />
        </mesh>
      ))}
      <group ref={plates}>
        {Array.from({ length: 4 }, (_, i) => (
          <RoundedBox key={i} args={[0.62, 0.16, 0.36]} radius={0.06} smoothness={2} position={[0, 0.28, -0.6 + i * 0.4]} material={M.shell} />
        ))}
        {[-1, 1].map((s) => (
          <group key={s}>
            <RoundedBox args={[0.1, 0.36, 1.0]} radius={0.04} smoothness={2} position={[s * 0.34, 0.02, -0.05]} material={M.shell} />
            <mesh material={M.accent} position={[s * 0.395, -0.12, -0.05]}>
              <boxGeometry args={[0.012, 0.03, 0.9]} />
            </mesh>
          </group>
        ))}
        <RoundedBox args={[0.56, 0.5, 0.2]} radius={0.08} smoothness={2} position={[0, 0.05, 0.72]} material={M.shell} />
        <RoundedBox args={[0.5, 0.38, 0.22]} radius={0.08} smoothness={2} position={[0, 0.06, -0.78]} material={M.shell} />
      </group>
      <group ref={tail} position={[0, 0.12, -0.9]}>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[0, i * 0.06, -i * 0.11]}>
            <mesh material={i % 2 ? M.frame : M.shell} rotation={[Math.PI / 2 - 0.6, 0, 0]}>
              <capsuleGeometry args={[0.045 - i * 0.004, 0.08, 4, 8]} />
            </mesh>
          </group>
        ))}
        <mesh material={M.accent} position={[0, 0.38, -0.68]}>
          <sphereGeometry args={[0.03, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}

export default function Cerberus() {
  const st = useTD((s) => s.cerberus);
  const ex = useFollow(st.exploded, 3);
  const layout = useMemo(() => fanLayout(st.heads.length), [st.heads.length]);
  const scale = st.heads.length > 8 ? 0.66 : st.heads.length > 7 ? 0.72 : st.heads.length > 4 ? 0.82 : st.heads.length > 3 ? 0.9 : 1;

  // keep the dashboard servo list in sync with the attached heads
  useMemo(() => {
    const legs = ['FL KNEE', 'FR KNEE', 'RL KNEE', 'RR KNEE'];
    const prev = telemetry.cerberus.servos;
    telemetry.cerberus.servos = [
      ...legs.map((n, i) => prev[i] && prev[i].name === n ? prev[i] : { name: n, v: 0.5, deg: 0 }),
      ...st.heads.map((h) => {
        const name = `N${String(h.id).padStart(2, '0')}`;
        return prev.find((p) => p.name === name) ?? { name, v: 0, deg: 0 };
      }),
    ];
  }, [st.heads]);
  useFrame(() => {
    const ns = telemetry.cerberus.servos.slice(4);
    telemetry.cerberus.g1 = ns.length ? ns.reduce((a, b) => a + b.v, 0) / ns.length : 0;
    telemetry.cerberus.speed = st.heads.length;
  });

  return (
    <group>
      <Torso ex={ex} />
      <Leg x={-0.36} z={0.62} front index={0} ex={ex} />
      <Leg x={0.36} z={0.62} front index={1} ex={ex} />
      <Leg x={-0.36} z={-0.68} front={false} index={2} ex={ex} />
      <Leg x={0.36} z={-0.68} front={false} index={3} ex={ex} />
      {st.heads.map((h, i) => (
        <HeadUnit key={h.id} head={h} index={i} slot={layout[i] ?? { yaw: 0, pitch: 0, len: 0.8 }} scale={scale} ex={ex} />
      ))}
      {st.stumps.map((s) => (
        <StumpCap key={`${s.id}-${s.t}`} s={s} />
      ))}
      {st.detached.map((d) => (
        <Floater key={d.id} d={d} labels={st.labels} distance={1.25}>
          <group scale={0.95}>
            <CerbHeadMesh />
          </group>
        </Floater>
      ))}
    </group>
  );
}

export { RAD };
