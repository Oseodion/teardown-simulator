'use client';
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useTD, telemetry, now } from '@/lib/store';
import { M } from '@/lib/materials';
import { Floater, clamp, hoverProps, isDrag, useFollow, worldPos } from '@/components/parts';
import { reg } from '@/lib/registry';

const SEGS = 10;
const ROOT_Y = 0.85;
const segLen = (i: number) => 0.22 - i * 0.01;
const segRad = (i: number) => 0.1 - i * 0.0068;

/** Ink jet envelope: 0 at rest, 1 while the siphon fires, eased both ways. */
export function jetEnvelope(dt: number) {
  if (dt < 0 || dt > 2.4) return 0;
  if (dt < 0.25) return 1 - Math.pow(1 - dt / 0.25, 3);
  if (dt < 1.2) return 1;
  const u = (dt - 1.2) / 1.2;
  return 1 - (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
}

function Arm({ arm, still = false, ex }: { arm: number; still?: boolean; ex?: React.RefObject<{ v: number }> }) {
  const segRefs = useRef<(THREE.Group | null)[]>([]);
  const root = useRef<THREE.Group>(null);
  const detachArm = useTD((s) => s.detachArm);
  const a = (arm / 8) * Math.PI * 2 + Math.PI / 8;
  useFrame((state) => {
    if (still) return;
    const t = state.clock.elapsedTime;
    const kr = useTD.getState().kraken;
    const j = jetEnvelope(now() - kr.jetAt);
    const e = ex?.current?.v ?? 0;
    let curlSum = 0;
    segRefs.current.forEach((g, i) => {
      if (!g) return;
      const wave = 0.13 * Math.sin(t * 1.5 - i * 0.45 + arm * 0.785);
      const rest = i === 0 ? 1.2 : -0.22 + wave;
      const jet = i === 0 ? 2.75 : wave * 0.12;
      const v = rest * (1 - j) + jet * j;
      g.rotation.x = v;
      g.rotation.y = i === 0 ? 0 : Math.sin(t * 1.1 + arm + i * 0.3) * 0.04 * (1 - j);
      if (i > 0) curlSum += -v;
    });
    if (root.current) {
      const r = 0.42 * (1 - j * 0.55) + e * 0.45;
      root.current.position.set(Math.sin(a) * r, ROOT_Y + e * -0.05, Math.cos(a) * r);
    }
    const tel = telemetry.kraken.servos[arm];
    if (tel) {
      tel.v = clamp(curlSum / 2.8);
      tel.deg = (curlSum * 180) / Math.PI;
    }
  });

  const onTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isDrag(e) || still) return;
    const mid = segRefs.current[4];
    detachArm(arm, worldPos(mid), [Math.sin(a) * 1.4, 0.7, Math.cos(a) * 1.4]);
  };

  // nested chain: each segment is a child of the one before it
  const chain = (i: number): React.ReactNode => {
    if (i >= SEGS) return null;
    const L = segLen(i);
    const R = segRad(i);
    const stillRot = i === 0 ? 0.5 : -0.12;
    return (
      <group
        ref={(g) => {
          segRefs.current[i] = g;
        }}
        position={[0, 0, i === 0 ? 0 : segLen(i - 1)]}
        rotation={still ? [stillRot, 0, 0] : undefined}
      >
        <mesh material={M.accent} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R * 1.08, R * 1.08, 0.025, 16]} />
        </mesh>
        <mesh material={M.frame} position={[0, 0, L / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R * 0.6, R * 0.6, L, 8]} />
        </mesh>
        <mesh material={M.shell} position={[0, 0, L / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[R * 0.92, Math.max(0.01, L - R * 1.9), 4, 12]} />
        </mesh>
        {i % 2 === 1 && (
          <mesh material={M.frame} position={[0, -R * 0.85, L / 2]}>
            <sphereGeometry args={[R * 0.32, 8, 6]} />
          </mesh>
        )}
        {!still && (
          <mesh material={M.hit} position={[0, 0, L / 2]} rotation={[Math.PI / 2, 0, 0]} onClick={onTap} {...hoverProps}>
            <cylinderGeometry args={[Math.max(0.15, R * 1.8), Math.max(0.15, R * 1.8), L * 1.05, 8]} />
          </mesh>
        )}
        {i === 9 && <group ref={reg(`kraken:armtip:${arm}`)} position={[0, 0, L]} />}
        {i === 4 && !still && <group ref={reg(`kraken:arm:${arm}`)} position={[0, 0, L / 2]} />}
        {chain(i + 1)}
      </group>
    );
  };

  return (
    <group ref={root} position={still ? [0, 0, 0] : [Math.sin(a) * 0.42, ROOT_Y, Math.cos(a) * 0.42]} rotation={[0, still ? 0 : a, 0]}>
      <group position={still ? [0, 0, -0.9] : [0, 0, 0]}>{chain(0)}</group>
    </group>
  );
}

export function MantlePlate({ onTap }: { onTap?: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <group>
      <mesh material={M.shell} scale={[1, 1.25, 1]} onClick={onTap} {...(onTap ? hoverProps : {})}>
        <sphereGeometry args={[0.68, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
      </mesh>
      {[0.2, 0.42, 0.62].map((y, i) => (
        <mesh key={i} material={M.frame} position={[0, y * 1.25 * 0.68 * 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.68 * Math.cos(Math.asin(y)) + 0.004, 0.008, 6, 48]} />
        </mesh>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`r${i}`} material={M.frame} rotation={[0, (i / 6) * Math.PI * 2, 0]} scale={[1, 1.25, 1]}>
          <torusGeometry args={[0.684, 0.006, 4, 40, Math.PI * 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

function Core() {
  const spin = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (spin.current) spin.current.rotation.y = s.clock.elapsedTime * 0.6;
  });
  return (
    <group>
      <mesh material={M.frame} scale={[1, 1.15, 1]}>
        <sphereGeometry args={[0.4, 32, 20]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`s${i}`} material={M.mid} position={[Math.cos(i * 0.785) * 0.5, 0.2, Math.sin(i * 0.785) * 0.5]} rotation={[0, -i * 0.785, 0.25]}>
          <boxGeometry args={[0.05, 0.62, 0.05]} />
        </mesh>
      ))}
      <group ref={spin} position={[0, 0.3, 0]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} material={M.accent} rotation={[Math.PI / 2 + (k - 1) * 0.55, k * 1.05, 0]}>
            <torusGeometry args={[0.5, 0.025, 8, 48]} />
          </mesh>
        ))}
        <mesh material={M.accent} position={[0, 0.12, 0]}>
          <sphereGeometry args={[0.12, 20, 14]} />
        </mesh>
      </group>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`p${i}`} material={M.shell} position={[Math.cos(i * 1.047) * 0.42, -0.08, Math.sin(i * 1.047) * 0.42]}>
          <cylinderGeometry args={[0.06, 0.06, 0.2, 12]} />
        </mesh>
      ))}
    </group>
  );
}

function Ink() {
  const g = useRef<THREE.Group>(null);
  const puffs = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ dx: Math.sin(i * 2.3) * 0.3, dy: -0.2 - (i % 3) * 0.15, dz: 0.5 + i * 0.12, s: 0.12 + (i % 4) * 0.05 })), []);
  useFrame(() => {
    const kr = useTD.getState().kraken;
    const dt = now() - kr.jetAt;
    if (!g.current) return;
    g.current.visible = dt >= 0 && dt < 2.6;
    g.current.children.forEach((c, i) => {
      const p = puffs[i];
      const k = clamp((dt - i * 0.05) / 1.6);
      c.position.set(p.dx * k, 0.95 + p.dy * k, 0.55 + p.dz * k * 1.4);
      c.scale.setScalar(Math.max(0.001, p.s * (0.3 + k * 2.2)));
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.opacity = 0.55 * (1 - k);
    });
  });
  return (
    <group ref={g}>
      {puffs.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color="#2b2d31" roughness={1} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function Kraken() {
  const st = useTD((s) => s.kraken);
  const detachMantle = useTD((s) => s.detachMantle);
  const ex = useFollow(st.exploded, 3);
  const body = useRef<THREE.Group>(null);
  const mantle = useRef<THREE.Group>(null);
  const plateRef = useRef<THREE.Group>(null);

  useMemo(() => {
    telemetry.kraken.servos = Array.from({ length: 8 }, (_, i) => ({ name: `ARM ${i + 1}`, v: 0.5, deg: 0 }));
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const j = jetEnvelope(now() - useTD.getState().kraken.jetAt);
    const e = ex.current.v;
    if (body.current) {
      body.current.position.set(0, Math.sin(t * 1.2) * 0.04 + j * 0.9, -j * 1.3);
      body.current.rotation.x = -j * 0.55;
    }
    if (mantle.current) {
      const br = Math.sin(t * 1.2);
      mantle.current.scale.set(1 + br * 0.02 - j * 0.12, 1 + br * 0.01 + j * 0.08, 1 + br * 0.02 - j * 0.12);
    }
    if (plateRef.current) plateRef.current.position.y = e * 0.55;
    telemetry.kraken.g1 = j;
    telemetry.kraken.g2 = 0.5 + Math.sin(t * 1.5) * 0.5;
    telemetry.kraken.speed = j;
    // arms that are gone read zero
    st.armsOff.forEach((a) => {
      const s = telemetry.kraken.servos[a];
      if (s) {
        s.v = 0;
        s.deg = 0;
      }
    });
  });

  const onMantle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isDrag(e)) return;
    detachMantle(worldPos(plateRef.current).map((v, i) => (i === 1 ? v + 0.45 : v)) as [number, number, number]);
  };

  return (
    <group>
      <group ref={body}>
        <group ref={mantle} position={[0, 1.62, -0.08]}>
          <Core />
          {!st.mantleOff && (
            <group ref={plateRef}>
              <group ref={reg('kraken:mantle')} position={[0, 0.5, 0.3]} />
              <MantlePlate onTap={onMantle} />
            </group>
          )}
        </group>
        {/* head band with the two big lenses */}
        <mesh material={M.shell} position={[0, 1.28, 0]}>
          <cylinderGeometry args={[0.6, 0.52, 0.42, 36]} />
        </mesh>
        <mesh material={M.frame} position={[0, 1.04, 0]}>
          <cylinderGeometry args={[0.5, 0.44, 0.12, 32]} />
        </mesh>
        <mesh material={M.accent} position={[0, ROOT_Y + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.44, 0.035, 10, 40]} />
        </mesh>
        <mesh material={M.frame} position={[0, ROOT_Y, 0]}>
          <cylinderGeometry args={[0.44, 0.3, 0.2, 32]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.27, 1.3, 0.5]} rotation={[0, s * 0.45, 0]}>
            <mesh material={M.frame} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.14, 0.14, 0.08, 28]} />
            </mesh>
            <mesh material={M.accent} position={[0, 0, 0.045]}>
              <torusGeometry args={[0.125, 0.026, 10, 32]} />
            </mesh>
            <mesh material={M.lens} position={[0, 0, 0.04]} scale={[1, 1, 0.45]}>
              <sphereGeometry args={[0.1, 20, 14]} />
            </mesh>
          </group>
        ))}
        {/* siphon nozzle */}
        <group position={[0, 1.0, 0.5]} rotation={[1.25, 0, 0]}>
          <mesh material={M.shell}>
            <cylinderGeometry args={[0.07, 0.1, 0.22, 16]} />
          </mesh>
          <mesh material={M.accent} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
          </mesh>
        </group>
        <RoundedBox args={[0.3, 0.12, 0.1]} radius={0.03} position={[0, 1.5, 0.52]} material={M.frame} />
        {Array.from({ length: 8 }, (_, i) => (!st.armsOff.includes(i) ? <Arm key={i} arm={i} ex={ex} /> : null))}
        <Ink />
      </group>
      {st.detached.map((d) => (
        <Floater key={d.id} d={d} labels={st.labels} distance={d.kind === 'mantle' ? 1.0 : 1.4}>
          {d.kind === 'mantle' ? (
            <group scale={0.9}>
              <MantlePlate />
            </group>
          ) : (
            <group scale={0.85} rotation={[0, 0, Math.PI / 2]}>
              <Arm arm={Number(d.meta?.arm ?? 0)} still />
            </group>
          )}
        </Floater>
      ))}
    </group>
  );
}
