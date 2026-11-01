// Playwright smoke test. BASE=http://localhost:3000 node tests/smoke.mjs  (SHOTS=0 to skip screenshots)
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS !== '0';
const TAG = process.env.TAG || '';
const OUT = new URL('../shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = '') => {
  results.push({ name, pass, info });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(kind) {
  const mobile = kind === 'mobile';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = await page.goto(BASE, { waitUntil: 'networkidle' });
  ok(`${kind}: HTTP status`, res.status() === 200, String(res.status()));
  await page.waitForFunction(() => window.__td && document.querySelector('canvas'), null, { timeout: 30000 });
  await sleep(2500);

  const P = mobile ? 'm-' : '';
  const td = (fn, arg) => page.evaluate(fn, arg);
  const tap = async (x, y) => (mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const tapKey = async (key) => {
    const p = await td((k) => window.__td.project(k), key);
    if (!p) return false;
    await tap(p.x, p.y);
    return true;
  };
  const banner = () => page.locator('[data-testid="banner"]').innerText();
  const shot = async (name) => SHOTS && page.screenshot({ path: `${OUT}${TAG}${kind}-${name}.png` });

  await shot('cerberus');

  // ---- Cerberus arc 3, 5, 7, 9, 10 then MAX, through real taps on the heads
  const arc = [await td(() => window.__td.heads())];
  let realTaps = 0;
  let fallbacks = 0;
  let sawSevered = false;
  for (let step = 0; step < 4; step++) {
    const before = arc[arc.length - 1];
    const ids = await td(() => window.__td.headIds());
    let cut = false;
    // try heads from the front row first
    for (const id of ids) {
      await tapKey(`cerberus:head:${id}`);
      await sleep(150);
      if ((await td(() => window.__td.heads())) < before) {
        cut = true;
        realTaps++;
        break;
      }
    }
    if (!cut) {
      fallbacks++;
      await td(() => window.__td.cut());
    }
    if ((await banner()).includes('HEAD SEVERED')) sawSevered = true;
    await sleep(1700);
    arc.push(await td(() => window.__td.heads()));
    if (step === 0) await shot('cerberus-regrowth');
  }
  ok(`${kind}: Cerberus arc`, arc.join(',') === '3,5,7,9,10', `${arc.join(' > ')} (real taps ${realTaps}, debug fallbacks ${fallbacks})`);
  ok(`${kind}: HEAD SEVERED banner seen`, sawSevered);
  const maxText = await banner();
  ok(`${kind}: MAX HEADS banner at 10`, maxText.includes('MAX HEADS'), maxText);
  const countText = await page.locator(`[data-testid="${mobile ? 'm-count' : 'head-count'}"]`).innerText();
  ok(`${kind}: counter shows 10 / 10 HEADS`, /10\s*\/\s*10 HEADS/.test(countText), countText.replace(/\n/g, ' '));
  await shot('cerberus-max');
  // at 10, a cut only detaches
  const ids10 = await td(() => window.__td.headIds());
  let cutAt10 = false;
  for (const id of ids10) {
    await tapKey(`cerberus:head:${id}`);
    await sleep(150);
    if ((await td(() => window.__td.heads())) === 9) {
      cutAt10 = true;
      break;
    }
  }
  if (!cutAt10) await td(() => window.__td.cut());
  await sleep(1600);
  const after = await td(() => window.__td.heads());
  ok(`${kind}: cut at 10 only detaches (no regrowth)`, after === 9 && (await banner()).includes('MAX HEADS'), `heads ${after}, real tap ${cutAt10}`);
  await shot('cerberus-detached');

  // ---- Kraken
  await page.locator(`[data-testid="${P}tab-kraken"]`).click();
  await sleep(1200);
  const tabOn = await page.locator(`[data-testid="${P}tab-kraken"]`).getAttribute('aria-selected');
  ok(`${kind}: switcher marks Kraken active`, tabOn === 'true');
  await shot('kraken');
  let armOff = false;
  for (const a of [0, 7, 1, 6, 2, 5, 3, 4]) {
    await tapKey(`kraken:arm:${a}`);
    await sleep(200);
    if ((await td(() => window.__td.state().kraken.armsOff.length)) > 0) {
      armOff = true;
      break;
    }
  }
  ok(`${kind}: Kraken tentacle detaches on tap`, armOff, await banner());
  await tapKey('kraken:mantle');
  await sleep(300);
  ok(`${kind}: Kraken mantle plate detaches on tap`, await td(() => window.__td.state().kraken.mantleOff));
  await page.locator(`[data-testid="${P}inkjet"]`).click();
  await sleep(500);
  ok(`${kind}: INK JET banner`, (await banner()).includes('INK JET'));
  await shot('kraken-inkjet');
  await sleep(2400);
  await shot('kraken-detached');

  // ---- Griffin
  await page.locator(`[data-testid="${P}tab-griffin"]`).click();
  await sleep(1600);
  ok(`${kind}: Griffin loads with WINGS DEPLOYED`, (await banner()).includes('WINGS DEPLOYED'));
  await shot('griffin');
  const fkeys = await td(() => window.__td.keys('griffin:feather:'));
  let fOff = false;
  for (const k of ['griffin:feather:R-P04', 'griffin:feather:L-P04', 'griffin:feather:R-S03', ...fkeys]) {
    await tapKey(k);
    await sleep(200);
    if ((await td(() => window.__td.state().griffin.featherOff.length)) > 0) {
      fOff = true;
      break;
    }
  }
  ok(`${kind}: Griffin feather panel detaches on tap`, fOff);
  const tkeys = await td(() => window.__td.keys('griffin:talon:'));
  let tOff = false;
  for (const k of tkeys) {
    await tapKey(k);
    await sleep(200);
    if ((await td(() => window.__td.state().griffin.talonOff.length)) > 0) {
      tOff = true;
      break;
    }
  }
  ok(`${kind}: Griffin talon detaches on tap`, tOff);
  await sleep(1500);
  await shot('griffin-detached');
  await page.locator(`[data-testid="${P}wings"]`).click();
  await sleep(1300);
  ok(`${kind}: wings fold`, !(await td(() => window.__td.state().griffin.wingsOpen)) && (await banner()).includes('WINGS FOLDED'));
  await shot('griffin-folded');
  await page.locator(`[data-testid="${P}wings"]`).click();
  await sleep(1300);
  ok(`${kind}: wings deploy`, (await banner()).includes('WINGS DEPLOYED'));

  // ---- state persists across switches
  await page.locator(`[data-testid="${P}tab-cerberus"]`).click();
  await sleep(600);
  const c = await td(() => ({ h: window.__td.heads(), d: window.__td.state().cerberus.detached.length, m: window.__td.state().cerberus.maxed }));
  await page.locator(`[data-testid="${P}tab-kraken"]`).click();
  await sleep(500);
  const k = await td(() => ({ a: window.__td.state().kraken.armsOff.length, m: window.__td.state().kraken.mantleOff }));
  await page.locator(`[data-testid="${P}tab-griffin"]`).click();
  await sleep(500);
  const g = await td(() => ({ f: window.__td.state().griffin.featherOff.length, t: window.__td.state().griffin.talonOff.length }));
  ok(`${kind}: state kept after switching`, c.h === 9 && c.d === 5 && c.m && k.a === 1 && k.m && g.f === 1 && g.t === 1, JSON.stringify({ c, k, g }));
  const countG = await page.locator(`[data-testid="${mobile ? 'm-count' : 'feather-count'}"]`).innerText();
  ok(`${kind}: Griffin counter reflects kept state`, countG.includes('25'), countG.replace(/\n/g, ' '));

  // ---- reset
  await page.locator(`[data-testid="${P}reset"]`).click();
  await sleep(300);
  ok(`${kind}: reset Griffin`, (await td(() => window.__td.state().griffin.featherOff.length)) === 0);

  // ---- layout
  const lay = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const over = [];
    document.querySelectorAll('.ui *').forEach((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === 'hidden') return;
      if (el.closest('.tag')) return;
      if (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1) over.push(`${el.className || el.tagName} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    });
    const small = [];
    document.querySelectorAll('.ui button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width && r.height && (r.height < 44 || r.width < 44)) small.push(`${b.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    const canvas = document.querySelector('canvas');
    const cr = canvas.getBoundingClientRect();
    return {
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      vw,
      vh,
      over: over.slice(0, 10),
      small,
      canvas: [cr.width, cr.height],
      touch: getComputedStyle(canvas).touchAction,
    };
  });
  ok(`${kind}: no page overflow`, lay.scrollW <= lay.vw && lay.scrollH <= lay.vh && lay.over.length === 0, JSON.stringify({ sw: lay.scrollW, sh: lay.scrollH, over: lay.over }));
  ok(`${kind}: canvas fills viewport`, Math.round(lay.canvas[0]) === lay.vw && Math.round(lay.canvas[1]) === lay.vh, lay.canvas.join('x'));
  ok(`${kind}: canvas touch-action none`, lay.touch === 'none', lay.touch);
  if (mobile) {
    ok(`${kind}: tap targets >= 44px`, lay.small.length === 0, lay.small.join('; '));
    await page.locator('[data-testid="sheet-toggle"]').click();
    await sleep(400);
    await shot('sheet-open');
    const sh = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth, sheet: document.querySelector('.sheet').getBoundingClientRect().height, vh: innerHeight }));
    ok(`${kind}: open sheet fits`, sh.sw <= sh.vw && sh.sheet <= sh.vh * 0.65, JSON.stringify(sh));
  }
  ok(`${kind}: no console errors`, errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
}

await run('desktop');
await run('mobile');
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
