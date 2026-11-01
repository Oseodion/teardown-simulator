'use client';
import { useEffect, useState } from 'react';
import { useTD, telemetry, MONSTERS, MAX_HEADS, type MonsterId } from '@/lib/store';

const pad = (n: number, w = 2) => String(Math.round(n)).padStart(w, '0');

function useTick(ms = 100) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

export function Switcher({ compact = false }: { compact?: boolean }) {
  const active = useTD((s) => s.active);
  const setActive = useTD((s) => s.setActive);
  return (
    <div className={`seg ${compact ? 'seg-compact' : ''}`} role="tablist" aria-label="Active monster">
      {MONSTERS.map((m, i) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={active === m.id}
          data-testid={`${compact ? 'm-' : ''}tab-${m.id}`}
          className={active === m.id ? 'on' : ''}
          onClick={() => setActive(m.id)}
        >
          <span className="mono idx">0{i + 1}</span>
          {m.name.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Banner() {
  const active = useTD((s) => s.active);
  const b = useTD((s) => s[s.active].banner);
  return (
    <div className="banner-wrap" aria-live="polite">
      <div key={`${active}-${b.n}`} className="banner" data-testid="banner">
        {b.text}
      </div>
    </div>
  );
}

function Gauge({ v, label, value, unit }: { v: number; label: string; value: string; unit: string }) {
  const a0 = -210;
  const a1 = 30;
  const R = 34;
  const ang = ((a0 + (a1 - a0) * Math.min(1, Math.max(0, v))) * Math.PI) / 180;
  const arc = (from: number, to: number) => {
    const f = (from * Math.PI) / 180;
    const t = (to * Math.PI) / 180;
    const large = to - from > 180 ? 1 : 0;
    return `M ${40 + R * Math.cos(f)} ${42 + R * Math.sin(f)} A ${R} ${R} 0 ${large} 1 ${40 + R * Math.cos(t)} ${42 + R * Math.sin(t)}`;
  };
  return (
    <div className="gauge">
      <svg width="80" height="62" viewBox="0 0 80 62" aria-hidden>
        <path d={arc(a0, a1)} stroke="#e1e3e6" strokeWidth="5" fill="none" />
        <path d={arc(a0, a0 + (a1 - a0) * Math.min(1, Math.max(0.001, v)))} stroke="#e8461e" strokeWidth="5" fill="none" />
        <line x1="40" y1="42" x2={40 + 26 * Math.cos(ang)} y2={42 + 26 * Math.sin(ang)} stroke="#16181b" strokeWidth="1.6" />
        <circle cx="40" cy="42" r="3" fill="#16181b" />
      </svg>
      <div>
        <div className="big-num">
          {value}
          <small>{unit}</small>
        </div>
        <div className="cap mu">{label}</div>
      </div>
    </div>
  );
}

const GAUGE_COPY: Record<MonsterId, [string, string, string, string, (t: typeof telemetry.cerberus) => [string, string]]> = {
  cerberus: ['NECK EXT', '%', 'BREATH', 'HZ', (t) => [pad(t.g1 * 100), (0.3 + t.g2 * 0.01).toFixed(2)]],
  kraken: ['JET THRUST', 'KN', 'ARM CURL', '%', (t) => [(t.g1 * 18.4).toFixed(1), pad(t.g2 * 100)]],
  griffin: ['WING SPAN', 'M', 'WINGBEAT', '%', (t) => [(1.2 + t.g1 * 4.4).toFixed(1), pad(t.g2 * 100)]],
};

export function Gauges() {
  useTick(100);
  const active = useTD((s) => s.active);
  const t = telemetry[active];
  const [l1, u1, l2, u2, f] = GAUGE_COPY[active];
  const [v1, v2] = f(t);
  return (
    <section className="pn">
      <header>
        <b>{active === 'kraken' ? 'SIPHON' : active === 'griffin' ? 'FLIGHT' : 'DRIVE'}</b>
        <span className="mu">01</span>
      </header>
      <div className="gauges">
        <Gauge v={t.g1} label={l1} value={v1} unit={u1} />
        <Gauge v={t.g2} label={l2} value={v2} unit={u2} />
      </div>
    </section>
  );
}

export function Servos({ max = 10 }: { max?: number }) {
  useTick(80);
  const active = useTD((s) => s.active);
  const list = telemetry[active].servos.slice(0, max);
  return (
    <section className="pn">
      <header>
        <b>{active === 'cerberus' ? 'LEG + NECK SERVOS' : active === 'kraken' ? 'ARM SERVOS' : 'JOINT SERVOS'}</b>
        <span className="pill">LIVE</span>
      </header>
      <div className="servos" data-testid="servos">
        {list.map((s) => (
          <div className="servo" key={s.name}>
            <span className="mono">{s.name}</span>
            <div className="bar">
              <i style={{ width: `${Math.round(Math.min(1, Math.max(0, s.v)) * 100)}%` }} />
            </div>
            <span className="mono num">{s.deg < -0.5 ? '-' : ''}{pad(Math.abs(s.deg), 3)}°</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pips({ n, of, on }: { n: number; of: number; on?: (i: number) => boolean }) {
  return (
    <div className="pips">
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={(on ? on(i) : i < n) ? 'on' : ''} />
      ))}
    </div>
  );
}

export function Counter() {
  const active = useTD((s) => s.active);
  const c = useTD((s) => s.cerberus);
  const k = useTD((s) => s.kraken);
  const g = useTD((s) => s.griffin);
  if (active === 'cerberus') {
    return (
      <section className="pn">
        <header>
          <b>REGROWTH</b>
          <span className={`pill ${c.maxed ? 'warn' : ''}`}>{c.maxed ? 'LOCKED' : 'ACTIVE'}</span>
        </header>
        <div className="count" data-testid="head-count">
          {c.heads.length} <span>/ {MAX_HEADS} HEADS</span>
        </div>
        <Pips n={c.heads.length} of={MAX_HEADS} />
        <div className="kv">
          <span className="mu">CUTS</span>
          <b className="mono">{pad(c.cuts)}</b>
          <span className="mu">REGROWN</span>
          <b className="mono">{pad(c.regrown)}</b>
        </div>
        <div className="arc mono" data-testid="arc">
          ARC {c.history.join(' / ')}
          {c.maxed ? ' / MAX' : ''}
        </div>
      </section>
    );
  }
  if (active === 'kraken') {
    return (
      <section className="pn">
        <header>
          <b>ASSEMBLY</b>
          <span className={`pill ${k.mantleOff ? 'warn' : ''}`}>{k.mantleOff ? 'CORE OPEN' : 'SEALED'}</span>
        </header>
        <div className="count" data-testid="arm-count">
          {8 - k.armsOff.length} <span>/ 8 ARMS</span>
        </div>
        <Pips n={8} of={8} on={(i) => !k.armsOff.includes(i)} />
        <div className="kv">
          <span className="mu">MANTLE</span>
          <b className="mono">{k.mantleOff ? 'OFF' : 'ON'}</b>
          <span className="mu">INK JETS</span>
          <b className="mono">{pad(k.jets)}</b>
        </div>
      </section>
    );
  }
  return (
    <section className="pn">
      <header>
        <b>ASSEMBLY</b>
        <span className={`pill ${g.wingsOpen ? '' : 'warn'}`}>{g.wingsOpen ? 'DEPLOYED' : 'FOLDED'}</span>
      </header>
      <div className="count" data-testid="feather-count">
        {26 - g.featherOff.length} <span>/ 26 PANELS</span>
      </div>
      <Pips n={26 - g.featherOff.length} of={26} />
      <div className="kv">
        <span className="mu">TALONS</span>
        <b className="mono">{14 - g.talonOff.length} / 14</b>
        <span className="mu">WINGS</span>
        <b className="mono">{g.wingsOpen ? 'OPEN' : 'FOLDED'}</b>
      </div>
    </section>
  );
}

export function Actions({ testPrefix = '' }: { testPrefix?: string }) {
  const active = useTD((s) => s.active);
  const st = useTD((s) => s[s.active]);
  const wingsOpen = useTD((s) => s.griffin.wingsOpen);
  const a = useTD.getState();
  return (
    <section className="pn actions">
      <header>
        <b>OPERATE</b>
        <span className="mu">03</span>
      </header>
      <div className="btns">
        {active === 'kraken' && (
          <button className="btn primary" data-testid={`${testPrefix}inkjet`} onClick={() => a.inkJet()}>
            INK JET
          </button>
        )}
        {active === 'griffin' && (
          <button className="btn primary" data-testid={`${testPrefix}wings`} onClick={() => a.toggleWings()}>
            {wingsOpen ? 'FOLD WINGS' : 'DEPLOY WINGS'}
          </button>
        )}
        <button className={`btn ${st.exploded ? 'on' : ''}`} aria-pressed={st.exploded} data-testid={`${testPrefix}explode`} onClick={() => a.toggleExploded(active)}>
          EXPLODED
        </button>
        <button className={`btn ${st.labels ? 'on' : ''}`} aria-pressed={st.labels} data-testid={`${testPrefix}labels`} onClick={() => a.toggleLabels(active)}>
          LABELS
        </button>
        <button className="btn ghost" data-testid={`${testPrefix}reset`} onClick={() => a.reset(active)}>
          RESET
        </button>
      </div>
      <p className="hint mu">{HINT[active]}</p>
    </section>
  );
}

const HINT: Record<MonsterId, string> = {
  cerberus: 'Tap a neck or head to cut it. Two new heads regrow from the stump, up to 10.',
  kraken: 'Tap a tentacle to detach it. Tap the mantle dome to lift the plate and expose the core.',
  griffin: 'Tap a wing feather panel or a talon to detach it. Fold and deploy the wings.',
};

export function OpLog({ rows = 5 }: { rows?: number }) {
  useTick(500);
  const active = useTD((s) => s.active);
  const log = useTD((s) => s[s.active].log);
  const t0 = log[0]?.t ?? 0;
  const last = log.slice(-rows).reverse();
  return (
    <section className="pn oplog" data-testid="oplog">
      <header>
        <b>OPERATION LOG</b>
        <span className="mu mono">
          {pad(log.length)} OPS / {active.toUpperCase()}
        </span>
      </header>
      <div className="track">
        <i style={{ width: `${Math.min(100, log.length * 8)}%` }} />
        {log.slice(-12).map((_, i) => (
          <b key={i} style={{ left: `${Math.min(100, (i + 1) * 8)}%` }} />
        ))}
      </div>
      <ol>
        {last.map((l, i) => (
          <li key={`${l.t}-${i}`} className={i === 0 ? 'hot' : ''}>
            <span className="mono mu">{fmtTime(l.t - t0 + 1)}</span>
            <span className="mono">{l.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Brand() {
  const active = useTD((s) => s.active);
  const m = MONSTERS.find((x) => x.id === active)!;
  return (
    <div className="brand">
      <div className="badge mono">{m.code}</div>
      <div>
        <div className="cap mu">TEARDOWN SIMULATOR / PROCEDURAL MODEL</div>
        <h1>
          {m.name} {m.code} <em>/</em>
        </h1>
        <div className="cap">{m.sub.toUpperCase()}</div>
      </div>
    </div>
  );
}

export function StatusStrip() {
  useTick(1000);
  const active = useTD((s) => s.active);
  const st = useTD((s) => s[s.active]);
  const [start] = useState(() => Date.now());
  return (
    <div className="status">
      <div>
        <span className="cap mu">SIM ID</span>
        <b className="mono">{MONSTERS.find((m) => m.id === active)!.code}-1031</b>
      </div>
      <div>
        <span className="cap mu">RUNTIME</span>
        <b className="mono">{fmtTime(Date.now() - start)}</b>
      </div>
      <div>
        <span className="cap mu">STATUS</span>
        <b className="mono">
          <i className="dot" /> {st.banner.text}
        </b>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="ui">
      <header className="topbar">
        <Brand />
        <Switcher />
        <StatusStrip />
      </header>
      <Banner />
      <aside className="col left">
        <Gauges />
        <Servos />
      </aside>
      <aside className="col right">
        <Counter />
        <Actions />
      </aside>
      <div className="bottom">
        <OpLog />
      </div>
      <footer className="foot mono mu">
        <span>FIELD SIMULATOR / PROCEDURAL MODEL / NO EXTERNAL MESHES</span>
        <span>DRAG TO ORBIT / PINCH TO ZOOM</span>
      </footer>

      {/* compact layout for 768px and below */}
      <div className="m-top">
        <div className="m-row">
          <Brand />
        </div>
        <Switcher compact />
      </div>
      <div className={`sheet ${open ? 'open' : ''}`} data-testid="sheet">
        <button className="grab" aria-expanded={open} aria-label={open ? 'Collapse panel' : 'Expand panel'} data-testid="sheet-toggle" onClick={() => setOpen((o) => !o)}>
          <i />
          <span className="cap">{open ? 'HIDE DETAILS' : 'DETAILS'}</span>
        </button>
        <MobileQuick />
        {open && (
          <div className="sheet-body">
            <Servos max={8} />
            <OpLog rows={4} />
          </div>
        )}
      </div>
    </div>
  );
}

function MobileQuick() {
  const active = useTD((s) => s.active);
  const c = useTD((s) => s.cerberus);
  const k = useTD((s) => s.kraken);
  const g = useTD((s) => s.griffin);
  const line =
    active === 'cerberus'
      ? `${c.heads.length} / ${MAX_HEADS} HEADS`
      : active === 'kraken'
        ? `${8 - k.armsOff.length} / 8 ARMS${k.mantleOff ? ' / CORE OPEN' : ''}`
        : `${26 - g.featherOff.length} / 26 PANELS / ${14 - g.talonOff.length} TALONS`;
  return (
    <div className="quick">
      <div className="count small" data-testid="m-count">
        {line}
      </div>
      <Actions testPrefix="m-" />
    </div>
  );
}
