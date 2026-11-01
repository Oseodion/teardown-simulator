'use client';
import { useEffect, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useTD, telemetry, now } from '@/lib/store';
import { M } from '@/lib/materials';
import { Floater, Ring, clamp, hoverProps, isDrag, useFollow, worldPos } from '@/components/parts';
import { reg } from '@/lib/registry';

const pad = (n: number) => String(n).padStart(2, '0');
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const backOut = (x: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
let griffinSeen = false;

/** Wing open amount 0..1 from the store, with a small overshoot when deploying. */
export function wingOpen() {
  const g = useTD.getState().griffin;
  const k = clamp((now() - g.wingsT) / 1.0);
  return g.wingsOpen ? backOut(k) : 1 - (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
}

export function FeatherPanel({ len, tip }: { len: number; tip: boolean }) {
  return (
    <group>
      <mesh material={M.frame} position={[0, -len * 0.45, -0.012]}>
        <boxGeometry args={[0.03, len * 0.9, 0.02]} />
      </mesh>
      <RoundedBox args={[0.12, len, 0.028]} radius={0.012} smoothness={2} position={[0, -len / 2, 0]} material={M.shell} />
      {tip && (
        <mesh material={M.accent} position={[0, -len + 0.05, 0.016]}>
          <boxGeometry args={[0.1, 0.06, 0.006]} />
        </mesh>
      )}
    </group>
  );
}

export function Talon() {
  return (
    <group>
      <mesh material={M.accent}>
        <sphereGeometry args={[0.035, 12, 10]} />
      </mesh>
      <mesh material={M.shell} position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.026, 0.07, 4, 8]} />
      </mesh>
      <mesh material={M.frame} position={[0, -0.03, 0.14]} rotation={[Math.PI / 2 + 0.7, 0, 0]}>
        <coneGeometry args={[0.022, 0.1, 8]} />
      </mesh>
    </group>
  );
}

type Side = 'L' | 'R';

function Wing({ side }: { side: Side }) {
  const sh = useRef<THREE.Group>(null);
  const el = useRef<THREE.Group>(null);
  const wr = useRef<THREE.Group>(null);
  const off = useTD((s) => s.griffin.featherOff);
  const labels = useTD((s) => s.griffin.labels);
  const detach = useTD((s) => s.detachFeather);
  void labels;
  const si = side === 'R' ? 1 : 0;
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const o = wingOpen();
    const beat = Math.sin(t * 2.2) * 0.09 * clamp(o);
    if (sh.current) sh.current.rotation.set(lerp(0.2, -0.05, o), lerp(1.2, 0.25, o), lerp(-0.35, 0.5, o) + beat, 'YXZ');
    if (el.current) el.current.rotation.set(0, lerp(-2.5, -0.1, o), lerp(0, -0.25, o) - beat * 0.6);
    if (wr.current) wr.current.rotation.set(0, lerp(2.3, 0.05, o), lerp(0, 0.15, o) - beat * 0.4);
    const sv = telemetry.griffin.servos;
    if (sv[si]) {
      sv[si].v = clamp(o);
      sv[si].deg = ((sh.current?.rotation.z ?? 0) * 180) / Math.PI;
    }
    if (sv[2 + si]) {
      sv[2 + si].v = clamp(o * 0.9 + 0.05);
      sv[2 + si].deg = ((el.current?.rotation.y ?? 0) * 180) / Math.PI;
    }
  });

  const feather = (key: string, label: string, len: number, rotZ: number, x: number, tip: boolean, meta: Record<string, number | string>) => {
    if (off.includes(key)) return null;
    const onTap = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (isDrag(e)) return;
      const p = worldPos(e.eventObject);
      detach(key, label, p, [side === 'R' ? 1 : -1, 0.6, 0.5], meta);
    };
    return (
      <group key={key} position={[x, 0, 0]} rotation={[0, 0, rotZ]}>
        <FeatherPanel len={len} tip={tip} />
        <mesh ref={reg(`griffin:feather:${key}`)} material={M.hit} position={[0, -len * 0.55, 0]} onClick={onTap} {...hoverProps}>
          <boxGeometry args={[0.15, len * 0.9, 0.14]} />
        </mesh>
      </group>
    );
  };

  return (
    <group scale={[side === 'R' ? 1 : -1, 1, 1]}>
      <group ref={sh}>
        <Ring r={0.09} h={0.12} rotation={[Math.PI / 2, 0, 0]} />
        <mesh material={M.frame} position={[0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.05, 0.6, 4, 10]} />
        </mesh>
        <RoundedBox args={[0.6, 0.18, 0.12]} radius={0.05} smoothness={2} position={[0.34, -0.04, 0.02]} material={M.shell} />
        {/* coverts on the humerus */}
        {[0, 1, 2].map((i) => (
          <group key={i} position={[0.12 + i * 0.2, -0.08, 0.04]} rotation={[0, 0, -0.15]}>
            <FeatherPanel len={0.32} tip={false} />
          </group>
        ))}
        <group ref={el} position={[0.7, 0, 0]}>
          <Ring r={0.075} h={0.1} rotation={[Math.PI / 2, 0, 0]} />
          <mesh material={M.frame} position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.04, 0.7, 4, 10]} />
          </mesh>
          <RoundedBox args={[0.74, 0.12, 0.1]} radius={0.04} smoothness={2} position={[0.4, 0.02, 0.02]} material={M.shell} />
          {Array.from({ length: 6 }, (_, i) => feather(`${side}-S${pad(i + 1)}`, `WING ${side} / SECONDARY ${pad(i + 1)}`, 0.55 + i * 0.03, -0.08 + i * 0.02, 0.08 + i * 0.13, i % 3 === 2, { len: 0.55 + i * 0.03, tip: i % 3 === 2 ? 1 : 0 }))}
          <group ref={wr} position={[0.8, 0, 0]}>
            <Ring r={0.06} h={0.08} rotation={[Math.PI / 2, 0, 0]} />
            <mesh material={M.frame} position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.035, 0.45, 4, 10]} />
            </mesh>
            <RoundedBox args={[0.5, 0.1, 0.09]} radius={0.035} smoothness={2} position={[0.25, 0.02, 0.02]} material={M.shell} />
            {Array.from({ length: 7 }, (_, i) => {
              const len = 0.75 + i * 0.06;
              return feather(`${side}-P${pad(i + 1)}`, `WING ${side} / PRIMARY ${pad(i + 1)}`, len, 0.05 + i * 0.2, 0.04 + i * 0.07, i % 2 === 1, { len, tip: i % 2 });
            })}
          </group>
        </group>
      </group>
    </group>
  );
}

function Foot({ prefix, label, claws, back }: { prefix: string; label: string; claws: number; back: boolean }) {
  const off = useTD((s) => s.griffin.talonOff);
  const detach = useTD((s) => s.detachTalon);
  return (
    <group>
      <RoundedBox args={[0.16, 0.08, 0.16]} radius={0.03} smoothness={2} material={M.frame} />
      {Array.from({ length: claws }, (_, i) => {
        const key = `${prefix}-T${i + 1}`;
        if (off.includes(key)) return null;
        const spread = claws === 1 ? 0 : -0.5 + i / (claws - 1);
        const isBack = back && i === claws - 1;
        const onTap = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (isDrag(e)) return;
          detach(key, `${label} / ${back ? 'TALON' : 'CLAW'} ${pad(i + 1)}`, worldPos(e.eventObject), [spread * 2, 0.4, 1], {});
        };
        return (
          <group key={key} position={[isBack ? 0 : spread * 0.14, -0.02, isBack ? -0.07 : 0.07]} rotation={[0, isBack ? Math.PI : spread * 0.6, 0]}>
            <Talon />
            <mesh ref={reg(`griffin:talon:${key}`)} material={M.hit} position={[0, -0.01, 0.08]} onClick={onTap} {...hoverProps}>
              <sphereGeometry args={[0.13, 10, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function FrontLeg({ side }: { side: Side }) {
  const up = useRef<THREE.Group>(null);
  const lo = useRef<THREE.Group>(null);
  const s = side === 'R' ? 1 : -1;
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const k = Math.sin(t * 1.6 + (s > 0 ? 0 : 1.4));
    if (up.current) up.current.rotation.set(-2.75 + k * 0.12, 0, s * 0.3);
    if (lo.current) lo.current.rotation.set(0.6 + k * 0.15, 0, 0);
  });
  return (
    <group ref={up} position={[s * 0.3, 0.85, 0.2]}>
      <mesh material={M.accent}>
        <sphereGeometry args={[0.09, 14, 12]} />
      </mesh>
      <RoundedBox args={[0.16, 0.42, 0.18]} radius={0.06} smoothness={2} position={[0, -0.22, 0]} material={M.shell} />
      <group ref={lo} position={[0, -0.44, 0]}>
        <Ring r={0.06} h={0.14} rotation={[0, 0, Math.PI / 2]} />
        <mesh material={M.frame} position={[0, -0.18, 0]}>
          <capsuleGeometry args={[0.045, 0.28, 4, 10]} />
        </mesh>
        <group position={[0, -0.4, 0]} rotation={[0.3, 0, 0]}>
          <Foot prefix={`F${side}`} label={`TALON ${side}`} claws={4} back />
        </group>
      </group>
    </group>
  );
}

function HindLeg({ side, lift }: { side: Side; lift: React.RefObject<{ v: number }> }) {
  const root = useRef<THREE.Group>(null);
  const hip = useRef<THREE.Group>(null);
  const knee = useRef<THREE.Group>(null);
  const ank = useRef<THREE.Group>(null);
  const s = side === 'R' ? 1 : -1;
  useFrame(() => {
    const l = lift.current?.v ?? 0;
    const h = -0.6 + l * 0.25;
    const k = 1.35 - l * 0.35;
    if (hip.current) hip.current.rotation.x = h;
    if (knee.current) knee.current.rotation.x = k;
    if (ank.current) ank.current.rotation.x = -(h + k);
    const sv = telemetry.griffin.servos[6 + (s > 0 ? 1 : 0)];
    if (sv) {
      sv.v = clamp(k / 1.6);
      sv.deg = (k * 180) / Math.PI;
    }
  });
  return (
    <group ref={root} position={[s * 0.3, 0, 0]}>
      <group ref={hip}>
        <mesh material={M.accent}>
          <sphereGeometry args={[0.12, 16, 12]} />
        </mesh>
        <RoundedBox args={[0.24, 0.52, 0.3]} radius={0.08} smoothness={2} position={[0, -0.24, 0]} material={M.shell} />
        <group ref={knee} position={[0, -0.5, 0]}>
          <Ring r={0.08} h={0.2} rotation={[0, 0, Math.PI / 2]} />
          <mesh material={M.frame} position={[0, -0.24, 0]}>
            <capsuleGeometry args={[0.055, 0.36, 4, 10]} />
          </mesh>
          <RoundedBox args={[0.15, 0.34, 0.15]} radius={0.05} smoothness={2} position={[0, -0.22, -0.03]} material={M.shell} />
          <group ref={ank} position={[0, -0.5, 0]}>
            <Ring r={0.06} h={0.15} rotation={[0, 0, Math.PI / 2]} />
            <group position={[0, -0.05, 0.06]}>
              <Foot prefix={`H${side}`} label={`HIND ${side}`} claws={3} back={false} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function Griffin() {
  const st = useTD((s) => s.griffin);
  const ex = useFollow(st.exploded, 3);
  const lift = useRef({ v: 1 });
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);

  useEffect(() => {
    telemetry.griffin.servos = ['WING L SH', 'WING R SH', 'WING L EL', 'WING R EL', 'NECK', 'TAIL', 'HIP L KN', 'HIP R KN'].map((name) => ({ name, v: 0.5, deg: 0 }));
    if (!griffinSeen) {
      griffinSeen = true;
      const g = useTD.getState().griffin;
      if (g.wingsOpen) useTD.setState({ griffin: { ...g, wingsT: now() } });
    }
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const o = wingOpen();
    lift.current.v = clamp(o);
    const e = ex.current.v;
    const l = clamp(o);
    // the hips sit on the hind legs, lifting slightly when the wings lock open
    const hipY = 0.5 * Math.cos(-0.6 + l * 0.25) + 0.5 * Math.cos(-0.6 + l * 0.25 + 1.35 - l * 0.35) + 0.12;
    if (hips.current) hips.current.position.set(0, hipY + Math.sin(t * 2.2) * 0.01 * l, -0.15);
    if (torso.current) {
      torso.current.rotation.x = 0.62 + Math.sin(t * 1.2) * 0.02;
      torso.current.position.y = e * 0.3;
    }
    if (head.current) {
      head.current.rotation.x = -0.55 + Math.sin(t * 2.2 + 0.5) * 0.05 * l;
      head.current.position.y = 1.32 + e * 0.35;
    }
    if (tail.current) tail.current.rotation.y = Math.sin(t * 1.4) * 0.3;
    if (wingL.current) wingL.current.position.x = -0.26 - e * 0.45;
    if (wingR.current) wingR.current.position.x = 0.26 + e * 0.45;
    const sv = telemetry.griffin.servos;
    if (sv[4]) {
      sv[4].v = 0.5 + Math.sin(t * 2.2 + 0.5) * 0.3 * l;
      sv[4].deg = (head.current?.rotation.x ?? 0) * 57.3;
    }
    if (sv[5]) {
      sv[5].v = 0.5 + Math.sin(t * 1.4) * 0.45;
      sv[5].deg = (tail.current?.rotation.y ?? 0) * 57.3;
    }
    telemetry.griffin.g1 = clamp(o);
    telemetry.griffin.g2 = 0.5 + Math.sin(t * 2.2) * 0.5 * l;
    telemetry.griffin.speed = o;
  });

  return (
    <group>
      <group ref={hips} position={[0, 0.9, -0.15]}>
        <HindLeg side="L" lift={lift} />
        <HindLeg side="R" lift={lift} />
        <group ref={tail} position={[0, 0.05, -0.3]}>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} material={i % 2 ? M.frame : M.shell} position={[0, -0.05 - i * 0.04 + Math.max(0, i - 4) * 0.12, -0.12 - i * 0.12]} rotation={[1.2 - i * 0.12, 0, 0]}>
              <capsuleGeometry args={[0.05 - i * 0.003, 0.08, 4, 8]} />
            </mesh>
          ))}
          <mesh material={M.accent} position={[0, 0.3, -1.18]}>
            <sphereGeometry args={[0.06, 12, 10]} />
          </mesh>
        </group>
        <group ref={torso} rotation={[0.62, 0, 0]}>
          {/* lion body frame and shell */}
          <mesh material={M.frame} position={[0, 0.5, 0]}>
            <capsuleGeometry args={[0.28, 0.7, 6, 16]} />
          </mesh>
          <RoundedBox args={[0.62, 0.5, 0.56]} radius={0.16} smoothness={3} position={[0, 0.1, -0.02]} material={M.shell} />
          <RoundedBox args={[0.58, 0.32, 0.5]} radius={0.12} smoothness={3} position={[0, 0.58, 0.04]} material={M.shell} />
          {/* chest seam, eagle half */}
          <mesh material={M.accent} position={[0, 0.78, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.31, 0.31, 0.025, 24]} />
          </mesh>
          <RoundedBox args={[0.66, 0.46, 0.58]} radius={0.18} smoothness={3} position={[0, 1.02, 0.04]} material={M.shell} />
          <mesh material={M.frame} position={[0, 1.02, -0.27]}>
            <boxGeometry args={[0.42, 0.36, 0.06]} />
          </mesh>
          <FrontLeg side="L" />
          <FrontLeg side="R" />
          <group position={[0, 1.08, -0.2]} rotation={[-0.62, 0, 0]}>
            <group ref={wingL} position={[-0.26, 0, 0]}>
              <Wing side="L" />
            </group>
            <group ref={wingR} position={[0.26, 0, 0]}>
              <Wing side="R" />
            </group>
          </group>
          {/* neck and eagle head */}
          <mesh material={M.frame} position={[0, 1.25, 0.06]}>
            <cylinderGeometry args={[0.1, 0.14, 0.3, 14]} />
          </mesh>
          <Ring r={0.15} h={0.05} position={[0, 1.15, 0.06]} />
          <group ref={head} position={[0, 1.32, 0.08]} rotation={[-0.55, 0, 0]} scale={1.15}>
            <group ref={reg('griffin:head')}>
              <RoundedBox args={[0.3, 0.3, 0.36]} radius={0.1} smoothness={3} position={[0, 0.12, 0]} material={M.shell} />
              <RoundedBox args={[0.24, 0.1, 0.28]} radius={0.04} smoothness={2} position={[0, 0.26, -0.08]} material={M.frame} />
              {/* hooked beak: upper mandible, hook tip and lower jaw */}
              <RoundedBox args={[0.13, 0.11, 0.2]} radius={0.04} smoothness={2} position={[0, 0.09, 0.24]} rotation={[0.2, 0, 0]} material={M.mid} />
              <mesh material={M.frame} position={[0, 0.02, 0.34]} rotation={[Math.PI - 0.5, 0, 0]}>
                <coneGeometry args={[0.04, 0.12, 8]} />
              </mesh>
              <mesh material={M.frame} position={[0, 0.0, 0.2]}>
                <boxGeometry args={[0.09, 0.03, 0.14]} />
              </mesh>
              {/* crest panels sweeping back */}
              {[-1, 0, 1].map((c) => (
                <mesh key={`c${c}`} material={M.shell} position={[c * 0.07, 0.2, -0.2]} rotation={[-0.9, c * 0.25, 0]}>
                  <boxGeometry args={[0.06, 0.02, 0.22]} />
                </mesh>
              ))}
              {[-1, 1].map((s) => (
                <group key={s} position={[s * 0.13, 0.15, 0.1]} rotation={[0, s * 0.6, 0]}>
                  <mesh material={M.lens}>
                    <sphereGeometry args={[0.04, 14, 10]} />
                  </mesh>
                  <mesh material={M.accent} position={[0, 0, 0.012]}>
                    <torusGeometry args={[0.046, 0.013, 8, 24]} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
      {st.detached.map((d) => (
        <Floater key={d.id} d={d} labels={st.labels} distance={d.kind === 'feather' ? 1.0 : 0.9}>
          {d.kind === 'feather' ? (
            <group rotation={[0, 0, 0.4]}>
              <FeatherPanel len={Number(d.meta?.len ?? 0.7)} tip={Number(d.meta?.tip ?? 0) === 1} />
            </group>
          ) : (
            <group scale={1.6}>
              <Talon />
            </group>
          )}
        </Floater>
      ))}
    </group>
  );
}
