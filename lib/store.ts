'use client';
import { create } from 'zustand';

export type MonsterId = 'cerberus' | 'kraken' | 'griffin';
export type V3 = [number, number, number];

export const MONSTERS: { id: MonsterId; code: string; name: string; sub: string }[] = [
  { id: 'cerberus', code: 'CRB-3', name: 'Cerberus', sub: 'Three-headed hound / regrowth unit' },
  { id: 'kraken', code: 'KR-10', name: 'Kraken', sub: 'Cephalopod / eight-arm manipulator' },
  { id: 'griffin', code: 'GR-1', name: 'Griffin', sub: 'Avian quadruped / rearing flyer' },
];

export const MAX_HEADS = 10;
export const REGROW_DELAY = 1000;

export interface Detached {
  id: string;
  kind: string;
  label: string;
  origin: V3;
  dir: V3;
  t0: number;
  meta?: Record<string, number | string>;
}
export interface LogEntry { t: number; text: string }
export interface Banner { text: string; n: number }

interface Common {
  detached: Detached[];
  log: LogEntry[];
  banner: Banner;
  exploded: boolean;
  labels: boolean;
}
export interface CerbHead { id: number; born: number; fromYaw: number; fromPitch: number }
export interface Stump { id: number; yaw: number; pitch: number; t: number }
export interface CerbState extends Common {
  heads: CerbHead[];
  stumps: Stump[];
  nextId: number;
  maxed: boolean;
  cuts: number;
  regrown: number;
  history: number[];
  epoch: number;
}
export interface KrakenState extends Common {
  armsOff: number[];
  mantleOff: boolean;
  jetAt: number;
  jets: number;
}
export interface GriffinState extends Common {
  wingsOpen: boolean;
  wingsT: number;
  featherOff: string[];
  talonOff: string[];
}

export const now = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
const stamp = () => (typeof performance !== 'undefined' ? performance.now() : 0);

const common = (banner: string): Common => ({
  detached: [],
  log: [{ t: stamp(), text: `SYSTEM ONLINE / ${banner}` }],
  banner: { text: banner, n: 1 },
  exploded: false,
  labels: true,
});

const initCerb = (epoch = 0): CerbState => ({
  ...common('HUNT MODE'),
  heads: [0, 1, 2].map((id) => ({ id: id + 1, born: -10, fromYaw: 0, fromPitch: 0 })),
  stumps: [],
  nextId: 4,
  maxed: false,
  cuts: 0,
  regrown: 0,
  history: [3],
  epoch,
});
const initKraken = (): KrakenState => ({ ...common('ARMS ARMED'), armsOff: [], mantleOff: false, jetAt: -100, jets: 0 });
const initGriffin = (): GriffinState => ({
  ...common('WINGS DEPLOYED'),
  wingsOpen: true,
  wingsT: now(),
  featherOff: [],
  talonOff: [],
});

export interface Store {
  active: MonsterId;
  cerberus: CerbState;
  kraken: KrakenState;
  griffin: GriffinState;
  setActive: (m: MonsterId) => void;
  toggleExploded: (m: MonsterId) => void;
  toggleLabels: (m: MonsterId) => void;
  reset: (m: MonsterId) => void;
  cutHead: (id: number, origin: V3, yaw: number, pitch: number) => void;
  detachArm: (arm: number, origin: V3, dir: V3) => void;
  detachMantle: (origin: V3) => void;
  inkJet: () => void;
  toggleWings: () => void;
  detachFeather: (key: string, label: string, origin: V3, dir: V3, meta: Record<string, number | string>) => void;
  detachTalon: (key: string, label: string, origin: V3, dir: V3, meta: Record<string, number | string>) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const pushLog = (log: LogEntry[], text: string) => [...log, { t: stamp(), text }].slice(-40);
const bump = (b: Banner, text: string): Banner => ({ text, n: b.n + 1 });
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

export const useTD = create<Store>((set, get) => ({
  active: 'cerberus',
  cerberus: initCerb(),
  kraken: initKraken(),
  griffin: initGriffin(),

  setActive: (m) => set({ active: m }),
  toggleExploded: (m) =>
    set((s) => {
      const st = s[m];
      const on = !st.exploded;
      return { [m]: { ...st, exploded: on, banner: bump(st.banner, on ? 'EXPLODED VIEW' : 'ASSEMBLED'), log: pushLog(st.log, on ? 'VIEW / EXPLODED' : 'VIEW / ASSEMBLED') } } as Partial<Store>;
    }),
  toggleLabels: (m) => set((s) => ({ [m]: { ...s[m], labels: !s[m].labels } }) as Partial<Store>),
  reset: (m) =>
    set((s) => {
      const fresh = m === 'cerberus' ? initCerb(s.cerberus.epoch + 1) : m === 'kraken' ? initKraken() : initGriffin();
      fresh.banner = { text: m === 'griffin' ? 'WINGS DEPLOYED' : 'SYSTEM RESET', n: s[m].banner.n + 1 };
      fresh.log = [{ t: stamp(), text: 'OPERATOR / RESET' }];
      return { [m]: fresh } as Partial<Store>;
    }),

  cutHead: (id, origin, yaw, pitch) => {
    const s = get().cerberus;
    const idx = s.heads.findIndex((h) => h.id === id);
    if (idx < 0) return;
    const before = s.heads.length;
    const heads = s.heads.filter((h) => h.id !== id);
    const stump: Stump = { id, yaw, pitch, t: now() };
    const willRegrow = !s.maxed && before < MAX_HEADS;
    const det: Detached = {
      id: `head-${id}-${stamp()}`,
      kind: 'head',
      label: `HEAD ${pad(id)} / DETACHED`,
      origin,
      dir: norm([Math.sin(yaw) * 1.4 + (Math.random() - 0.5) * 0.5 + (Math.abs(yaw) < 0.2 ? (Math.random() < 0.5 ? -0.8 : 0.8) : 0), 0.55, 0.35]),
      t0: now(),
    };
    const maxed = s.maxed || before >= MAX_HEADS;
    set({
      cerberus: {
        ...s,
        heads,
        stumps: [...s.stumps, stump],
        cuts: s.cuts + 1,
        maxed,
        detached: [...s.detached, det],
        banner: bump(s.banner, willRegrow ? 'HEAD SEVERED' : 'MAX HEADS'),
        log: pushLog(s.log, `CUT / HEAD ${pad(id)} SEVERED / ${heads.length} ATTACHED${willRegrow ? '' : ' / REGROWTH LOCKED'}`),
      },
    });
    if (!willRegrow) return;
    const epoch = s.epoch;
    // The stump regrows its own head plus 2 new heads on spring arms (net +2 per cut),
    // limited by the free slots under MAX_HEADS. Arc: 3, 5, 7, 9, 10.
    setTimeout(() => {
      const c = get().cerberus;
      if (c.epoch !== epoch) return;
      const n = Math.max(0, Math.min(3, MAX_HEADS - c.heads.length));
      const t = now();
      const born: CerbHead[] = [];
      let nextId = c.nextId;
      for (let k = 0; k < n; k++) born.push({ id: nextId++, born: t + k * 0.12, fromYaw: yaw, fromPitch: pitch });
      const cur = c.heads.slice();
      // insert the new heads near where the cut one sat, so the fan stays ordered
      const at = Math.min(idx, cur.length);
      cur.splice(at, 0, ...born);
      const count = cur.length;
      const nowMax = count >= MAX_HEADS;
      set({
        cerberus: {
          ...c,
          heads: cur,
          nextId,
          stumps: c.stumps.filter((st) => st.id !== id),
          regrown: c.regrown + n,
          maxed: c.maxed || nowMax,
          history: [...c.history, count],
          banner: bump(c.banner, nowMax ? 'MAX HEADS' : 'REGROWTH'),
          log: pushLog(c.log, `REGROWTH / +${n} HEADS / ${count} / ${MAX_HEADS}${nowMax ? ' / CAP REACHED' : ''}`),
        },
      });
    }, REGROW_DELAY);
  },

  detachArm: (arm, origin, dir) => {
    const s = get().kraken;
    if (s.armsOff.includes(arm)) return;
    set({
      kraken: {
        ...s,
        armsOff: [...s.armsOff, arm],
        detached: [...s.detached, { id: `arm-${arm}-${stamp()}`, kind: 'arm', label: `ARM ${arm + 1} / SEG 01-10`, origin, dir: norm(dir), t0: now(), meta: { arm } }],
        banner: bump(s.banner, 'ARM DETACHED'),
        log: pushLog(s.log, `DETACH / ARM ${arm + 1} / ${8 - s.armsOff.length - 1} ARMS LEFT`),
      },
    });
  },
  detachMantle: (origin) => {
    const s = get().kraken;
    if (s.mantleOff) return;
    set({
      kraken: {
        ...s,
        mantleOff: true,
        detached: [...s.detached, { id: `mantle-${stamp()}`, kind: 'mantle', label: 'MANTLE PLATE / LIFTED', origin, dir: norm([1, 0.45, 0.25]), t0: now() }],
        banner: bump(s.banner, 'CORE EXPOSED'),
        log: pushLog(s.log, 'DETACH / MANTLE PLATE / CORE EXPOSED'),
      },
    });
  },
  inkJet: () => {
    const s = get().kraken;
    if (now() - s.jetAt < 2.4) return;
    set({ kraken: { ...s, jetAt: now(), jets: s.jets + 1, banner: bump(s.banner, 'INK JET'), log: pushLog(s.log, `SIPHON / INK JET ${pad(s.jets + 1)} / ARMS STREAMLINED`) } });
  },
  toggleWings: () => {
    const s = get().griffin;
    const open = !s.wingsOpen;
    set({ griffin: { ...s, wingsOpen: open, wingsT: now(), banner: bump(s.banner, open ? 'WINGS DEPLOYED' : 'WINGS FOLDED'), log: pushLog(s.log, open ? 'WINGS / DEPLOYED / FULL SPAN' : 'WINGS / FOLDED') } });
  },
  detachFeather: (key, label, origin, dir, meta) => {
    const s = get().griffin;
    if (s.featherOff.includes(key)) return;
    set({ griffin: { ...s, featherOff: [...s.featherOff, key], detached: [...s.detached, { id: `f-${key}-${stamp()}`, kind: 'feather', label, origin, dir: norm(dir), t0: now(), meta }], banner: bump(s.banner, 'PANEL DETACHED'), log: pushLog(s.log, `DETACH / ${label}`) } });
  },
  detachTalon: (key, label, origin, dir, meta) => {
    const s = get().griffin;
    if (s.talonOff.includes(key)) return;
    set({ griffin: { ...s, talonOff: [...s.talonOff, key], detached: [...s.detached, { id: `t-${key}-${stamp()}`, kind: 'talon', label, origin, dir: norm(dir), t0: now(), meta }], banner: bump(s.banner, 'TALON DETACHED'), log: pushLog(s.log, `DETACH / ${label}`) } });
  },
}));

// Live joint values written every frame by the 3D scene, read by the dashboard.
export interface Telemetry {
  servos: { name: string; v: number; deg: number }[];
  g1: number;
  g2: number;
  speed: number;
}
export const telemetry: Record<MonsterId, Telemetry> = {
  cerberus: { servos: [], g1: 0, g2: 0, speed: 0 },
  kraken: { servos: [], g1: 0, g2: 0, speed: 0 },
  griffin: { servos: [], g1: 0, g2: 0, speed: 0 },
};
