# Teardown Simulator

A 3D teardown simulator with three procedural robot monsters: **Cerberus**, **Kraken** and **Griffin**.
Every model is built in code from primitives (boxes, capsules, cylinders, spheres). There are no model files.

Stack: Next.js 15 (App Router), TypeScript, three.js via @react-three/fiber and @react-three/drei, Zustand.

## Monsters

- **Cerberus CRB-3**: tap a neck or head to cut it. The head floats off with a label, the stump glows orange, and after 1 s the stump regrows on spring arms. Arc 3, 5, 7, 9, 10. At 10 regrowth locks (MAX HEADS) and further cuts only detach.
- **Kraken KR-10**: tap a tentacle to detach it, tap the mantle dome to lift the plate and expose the core, press INK JET to jet backward with the arms streamlined.
- **Griffin GR-1**: tap a wing feather panel or a talon to detach it, fold or deploy the wings.

The segmented switcher swaps monsters instantly. Each monster keeps its own state in a Zustand store keyed by monster.
Extras: orbit with damping, pinch zoom, exploded view, labels toggle, reset per monster.

## Run

```
npm install
npm run dev          # http://localhost:3000
npm run build
```

## Test

```
npx playwright install chromium
npm run build && npm start &
BASE=http://localhost:3000 npm run test:e2e
```

The smoke test drives real taps on projected part positions at 1440x900 and 390x844, checks the Cerberus arc,
detaches on every monster, state persistence across switches, layout overflow, tap target sizes and console errors.
Screenshots land in `shots/`. A debug hook is exposed at `window.__td`.

Style conventions follow Elvar's MIT teardown skill (pale studio, matte white shell over a dark frame, vermilion accents).
