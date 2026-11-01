'use client';
import { useEffect } from 'react';
import Scene from './Scene';
import Dashboard from './ui/Dashboard';
import { useTD, telemetry, type MonsterId } from '@/lib/store';
import { parts, project } from '@/lib/registry';

declare global {
  interface Window {
    __td?: Record<string, unknown>;
  }
}

export default function App() {
  useEffect(() => {
    // debug and test hook
    window.__td = {
      state: () => useTD.getState(),
      heads: () => useTD.getState().cerberus.heads.length,
      headIds: () => useTD.getState().cerberus.heads.map((h) => h.id),
      select: (m: MonsterId) => useTD.getState().setActive(m),
      reset: (m: MonsterId) => useTD.getState().reset(m),
      cut: (id?: number) => {
        const c = useTD.getState().cerberus;
        const h = id ? c.heads.find((x) => x.id === id) : c.heads[0];
        if (!h) return false;
        useTD.getState().cutHead(h.id, [0, 1.6, 1.5], 0, 0.2);
        return true;
      },
      keys: (prefix = '') => [...parts.keys()].filter((k) => k.startsWith(prefix)),
      project: (key: string) => project(key),
      telemetry: () => telemetry,
    };
  }, []);
  return (
    <main className="app">
      <div className="canvas-wrap">
        <Scene />
      </div>
      <Dashboard />
    </main>
  );
}
