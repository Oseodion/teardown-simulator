# teardown simulator

three robot monsters you can take apart in your browser. built with next.js and three.js

pick cerberus, kraken or griffin from the dashboard and start pulling parts off. you can switch between them anytime, and each one keeps its own state, so whatever you broke is still broken when you come back

live: [monsterteardown.vercel.app](https://monsterteardown.vercel.app)

![demo](demo.gif)
> demo gif coming once it's recorded

## the monsters

**cerberus**
three-headed robot dog. tap a head or neck to cut it off and you'll see a label line, an orange glowing stump and HEAD SEVERED. two new heads grow back on spring arms, so it goes 3, 5, 7, 9, 10. at 10 heads the regrowth stops and cuts just remove heads. every neck gets its own servo bar on the dashboard

**kraken**
domed mantle with eight segmented tentacles. tap a tentacle to pull it off, or pop the mantle plate to see the core. hit ink jet and it shoots backward with the tentacles streamlined

**griffin**
eagle head, lion body, rearing with its wings out at full span (WINGS DEPLOYED). tap a feather panel or a talon to detach it, and fold or open the wings whenever you want

every monster also has exploded view, labels on or off, and reset

## stack

- next.js (app router) + typescript
- three.js via @react-three/fiber and @react-three/drei
- every model is built from code, no model files
- works on mobile, with big tap targets and a bottom sheet for the panels

## run it locally

```
npm install
npm run dev
```

then open http://localhost:3000

## credits

style inspired by elvar's teardown skill (MIT)

## how it was built

no blender, no model files. every monster is built in code from basic shapes (capsules, boxes, cylinders, spheres) using three.js through @react-three/fiber and @react-three/drei, and each part has its own group so it can come off on its own

the look comes from elvar's teardown skill ([github.com/elvarofficial/teardown](https://github.com/elvarofficial/teardown), MIT): matte white shell over a dark frame, orange on the joints, label lines, gauges and servo bars on a pale studio floor with a radar grid. i also used frames from elvar's jumping spider and fokki's octopus videos as visual references

the whole thing was built end to end by an ai coding agent: the models, the panels, the tests and the deploy config. i picked the monsters and the mechanics, and it did the rest
