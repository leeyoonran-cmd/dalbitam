import * as THREE from "three";
import { CONFIG } from "./config.js";

/* =========================================================
   달빛암 — 3D 온라인 절
   - Three.js 로 절 마당, 대웅전, 석탑, 산신각, 공양간, 산책길
   - Supabase Realtime 으로 같은 법당 사람들 위치·인사 공유
   - Supabase 테이블(wishes)로 소원 연등 공유
   ========================================================= */

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 내 기록 (이 기기에만) ---------- */
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const today = new Date().toDateString();
const me = Object.assign({ day: today, nick: "", mok: 0, bow: 0, tap: 0, bead: 0, pray: 0, localWishes: [] }, store.get("sansa3d", {}));
if (me.day !== today) { me.day = today; me.mok = 0; me.bow = 0; }
const save = () => store.set("sansa3d", me);
const myKey = store.get("sansa3d-key", null) || (() => { const k = "m" + Math.random().toString(36).slice(2, 10); store.set("sansa3d-key", k); return k; })();

$("siteTitle").textContent = CONFIG.siteName;
document.title = CONFIG.siteName;
$("nickInput").value = me.nick || "";

const sayings = [
  "걱정은 내일의 몫으로 남겨 두어도 괜찮아요.", "천천히 들이쉬고, 길게 내쉬어 보세요.", "오늘 하루도 충분히 애썼어요.",
  "지나간 일은 바람처럼 흘려보내요.", "작은 친절 하나가 큰 복이 됩니다.", "지금 이 순간에 머물러 보세요.",
  "마음이 고요하면 길이 보여요.", "비우면 비로소 채워집니다.", "남과 비교하지 않는 하루가 편안한 하루예요.",
  "화가 날 땐 세 번 숨을 쉬고 말해요.", "내가 나에게 다정해지는 연습을 해요."
];
const say = (t) => { $("saying").textContent = t || sayings[Math.floor(Math.random() * sayings.length)]; };

/* =========================================================
   소리 (모두 브라우저에서 직접 합성 — 음원 파일 없음)
   ========================================================= */
let ctx, master, noiseBuf;
const vol = { wind: .3, water: .2, bird: .3, chime: .25, fx: .8 };
function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function tone(freq, dur, v, type = "sine", delay = 0) {
  const c = ac(), t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
const sfx = {
  mok() { const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = "triangle"; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(420, t + .08);
    f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 4;
    g.gain.setValueAtTime(.9 * vol.fx, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + .2); },
  bell() { [[110, .5], [220.5, .25], [331, .12], [466, .06]].forEach(([f, v]) => tone(f, 6, v * vol.fx)); },
  soft() { tone(523, 1.2, .07 * vol.fx); tone(784, 1.2, .04 * vol.fx, "sine", .15); },
  bead() { tone(1300, .07, .06 * vol.fx, "triangle"); },
  chime() { tone(rand(1700, 2600), 2.2, .12 * vol.chime); tone(rand(2600, 3200), 1.5, .05 * vol.chime, "sine", .03); },
  bird() { const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain(), b = rand(2400, 3800);
    o.frequency.setValueAtTime(b, t); o.frequency.exponentialRampToValueAtTime(b * 1.4, t + .08); o.frequency.exponentialRampToValueAtTime(b * .9, t + .16);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05 * vol.bird, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
    o.connect(g).connect(master); o.start(t); o.stop(t + .25); }
};
const loops = {};
function noiseLoop(kind) {
  const c = ac();
  if (!loops[kind]) {
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(), g = c.createGain(); g.gain.value = 0;
    if (kind === "wind") { f.type = "lowpass"; f.frequency.value = 380; const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = .12; lg.gain.value = 220; l.connect(lg).connect(f.frequency); l.start(); }
    else { f.type = "bandpass"; f.frequency.value = 1100; f.Q.value = .6; }
    s.connect(f).connect(g).connect(master); s.start(); loops[kind] = g;
  }
  loops[kind].gain.setTargetAtTime(vol[kind] * (kind === "wind" ? .45 : .2), c.currentTime, .4);
}
[["vWind", "wind"], ["vWater", "water"], ["vBird", "bird"], ["vChime", "chime"], ["vFx", "fx"]].forEach(([id, k]) => {
  $(id).addEventListener("input", (e) => { vol[k] = e.target.value / 100; if (ctx && (k === "wind" || k === "water")) noiseLoop(k); });
});
setInterval(() => {
  if (!ctx || !player) return;
  const nearWalk = zoneOf(player.pos.x, player.pos.z) === "walk";
  if (vol.bird && Math.random() < .3 * vol.bird + (nearWalk ? .25 : .05)) { sfx.bird(); setTimeout(sfx.bird, 170); }
  if (vol.chime && Math.random() < .2 * vol.chime + .05) sfx.chime();
}, 1500);

let chantTimer = null;
$("chantBtn").addEventListener("click", () => {
  ac();
  if (chantTimer) { clearInterval(chantTimer); chantTimer = null; $("chantBtn").textContent = "염불 듣기"; $("chantBtn").classList.remove("on"); return; }
  let i = 0;
  chantTimer = setInterval(() => { sfx.mok(); if (i % 4 === 0) { tone(146.8, 1.4, .05 * vol.fx); tone(220, 1.4, .03 * vol.fx); } i++; }, 700);
  $("chantBtn").textContent = "염불 멈추기"; $("chantBtn").classList.add("on");
});

/* =========================================================
   3D 장면
   ========================================================= */
const canvas = $("world");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#18202c");
scene.fog = new THREE.Fog("#18202c", 28, 70);
const camera = new THREE.PerspectiveCamera(55, 1, .1, 200);

scene.add(new THREE.HemisphereLight("#8fa6c8", "#2a2018", .9));
const moon = new THREE.DirectionalLight("#dfe6ff", .9); moon.position.set(-20, 30, 10); scene.add(moon);

const M = (color, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .85 }, extra));
const mat = {
  ground: M("#4b4236"), stone: M("#8d8f93", { roughness: .95 }), darkStone: M("#6c6e72"), wood: M("#5b3a26"), floor: M("#3b2a1e"),
  pillar: M("#7a2a20"), wall: M("#efe6d2"), roofTile: M("#2b313b"), green: M("#3f8f7d"), gold: M("#d9b44a", { metalness: .6, roughness: .35 }),
  mural: M("#5a2018"), leaf: M("#24463a"), leaf2: M("#1f3a2c"), trunk: M("#3a2a1e"), water: M("#2c5266", { roughness: .2, metalness: .1 }),
  cushion: M("#3c3a36"), skin: M("#c4825a", { roughness: .7 }), robe: M("#c9ccd2"), sash: M("#d9b44a", { roughness: .7 }), eye: M("#2a1810"),
  lantern: new THREE.MeshStandardMaterial({ color: "#f2a65a", emissive: "#f28a3a", emissiveIntensity: 1.2 }),
  flame: new THREE.MeshBasicMaterial({ color: "#ffcf73" }), candle: M("#f2e6c8")
};
const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
const cyl = (rt, rb, h, m, x, y, z, seg = 12, parent = scene) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); parent.add(o); return o; };

/* 땅과 산 */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat.ground); ground.rotation.x = -Math.PI / 2; scene.add(ground);
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2, r = rand(55, 70);
  const m = new THREE.Mesh(new THREE.ConeGeometry(rand(14, 24), rand(14, 26), 6), M(i % 2 ? "#1d2633" : "#222d3a"));
  m.position.set(Math.cos(a) * r, 5, Math.sin(a) * r); scene.add(m);
}
const moonBall = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: "#efe6cc" }));
moonBall.position.set(-40, 38, -60); scene.add(moonBall);
// 별
{ const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 500; i++) { const a = rand(0, Math.PI * 2), e = rand(.15, 1.3), r = 90; p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#fff4d6", size: .35, fog: false }))); }

/* 길 */
for (let z = -11; z < 40; z += 1.3) box(2.2, .06, 1, mat.darkStone, Math.sin(z * .15) * (z > 10 ? 1.5 : 0), .03, z);
box(30, .04, 22, M("#5a5044"), 0, .02, 0); // 마당 흙

/* 장애물(충돌) 목록 */
const blockers = []; // {x1,x2,z1,z2}
const block = (x1, x2, z1, z2) => blockers.push({ x1, x2, z1, z2 });

/* 전각 만들기 */
function hall({ w, d, h, x, z, open = false, sign = "" }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  box(w + 1, .5, d + 1, mat.stone, 0, .25, 0, g); // 기단
  box(w, .05, d, mat.floor, 0, .52, 0, g);
  const cols = Math.max(3, Math.round(w / 3.2));
  for (let i = 0; i <= cols; i++) { const px = -w / 2 + (w / cols) * i; cyl(.22, .26, h, mat.pillar, px, .5 + h / 2, d / 2 - .2, 10, g); cyl(.22, .26, h, mat.pillar, px, .5 + h / 2, -d / 2 + .2, 10, g); }
  box(w, h, .2, mat.mural, 0, .5 + h / 2, -d / 2 + .1, g); // 뒷벽
  box(.2, h, d, mat.wall, -w / 2 + .1, .5 + h / 2, 0, g); box(.2, h, d, mat.wall, w / 2 - .1, .5 + h / 2, 0, g);
  if (!open) { box(w, h * .75, .15, mat.wall, 0, .5 + h * .375 + h * .25, d / 2 - .2, g); }
  box(w + .4, .35, d + .4, mat.green, 0, .5 + h + .1, 0, g); // 단청 띠
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4, 1, true), mat.roofTile);
  roof.rotation.y = Math.PI / 4; roof.scale.set((w + 4) * .72, h * .75, (d + 4) * .72); roof.position.y = .5 + h + .25 + h * .37; g.add(roof);
  roof.material.side = THREE.DoubleSide;
  if (sign) { const s = textSprite(sign, { size: 46, color: "#d9b44a", bg: "#2a1612", pad: 18 }); s.position.set(0, .5 + h - .2, d / 2 + .05); s.scale.multiplyScalar(.9); g.add(s); }
  return g;
}

/* 대웅전 (안에 들어갈 수 있음) */
const HALL = { x: 0, z: -19, w: 16, d: 10, h: 4.2 };
const hallG = hall({ ...HALL, open: true, sign: "大雄殿" });
block(-8.6, 8.6, -24.6, -23.6); block(-8.6, -7.6, -24.6, -14); block(7.6, 8.6, -24.6, -14);
// 불상
{ const g = new THREE.Group(); g.position.set(0, .55, -22.4); scene.add(g);
  box(5, 1, 1.6, mat.wood, 0, .5, 0, g);
  cyl(1.3, 1.5, .5, mat.gold, 0, 1.25, 0, 16, g);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), mat.gold); body.scale.set(1.15, 1.25, .8); body.position.y = 2.4; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 16), mat.gold); head.position.y = 3.95; g.add(head);
  const top = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), mat.gold); top.position.y = 4.5; g.add(top);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.5, .08, 8, 40), mat.gold); halo.position.set(0, 3.7, -.5); g.add(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, .05, 8, 50), mat.gold); halo2.position.set(0, 2.9, -.55); g.add(halo2);
  block(-2.6, 2.6, -23.4, -21.5);
}
// 촛대 + 향로
const candles = [];
[-3.3, 3.3].forEach((x) => { cyl(.12, .12, .7, mat.candle, x, 1.4, -21.9); const f = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mat.flame); f.scale.y = 1.8; f.position.set(x, 1.85, -21.9); scene.add(f); candles.push(f); });
const hallLight = new THREE.PointLight("#ffb466", 18, 16, 1.6); hallLight.position.set(0, 3, -20); scene.add(hallLight);
cyl(.35, .25, .35, mat.gold, 0, 1.2, -21.2, 12);
const incense = new THREE.Group(); incense.position.set(0, 1.4, -21.2); scene.add(incense);
cyl(.02, .02, .6, M("#8a5a3a"), 0, .3, 0, 6, incense); incense.visible = false;
const smoke = [];
for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: "#dddddd", transparent: true, opacity: 0 })); s.userData.t = i / 10; incense.add(s); smoke.push(s); }
let incenseUntil = 0;
// 방석
const hallSeats = [];
for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) { const x = c * 1.9, z = -19.2 + r * 1.8; box(1.1, .12, 1.1, mat.cushion, x, .6, z); hallSeats.push({ x, z }); }

/* 석탑 (마당 가운데) */
const PAGODA = { x: 0, z: 0 };
{ let y = 0; [[3, .6], [2.3, 1.2], [2.9, .3], [1.8, 1], [2.4, .25], [1.4, .9], [1.9, .22], [1, .7], [1.4, .2]].forEach(([s, h], i) => { box(s, h, s, i % 2 ? mat.stone : mat.darkStone, 0, y + h / 2, 0); y += h; });
  cyl(.12, .12, 1.4, mat.darkStone, 0, y + .7, 0); block(-1.7, 1.7, -1.7, 1.7); }
const pagodaLamp = new THREE.PointLight("#ffcf8a", 6, 12, 2); pagodaLamp.position.set(0, 1, 5); scene.add(pagodaLamp);

/* 산신각 · 칠성각 (동쪽) */
const SHRINE = { x: 15, z: -7, w: 6, d: 5, h: 3 };
hall({ ...SHRINE, sign: "山神閣" }); block(11.5, 18.5, -10, -4.2);
const shrineCandle = cyl(.1, .1, .5, mat.candle, 15, .8, -4.1); const shrineFlame = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), mat.flame);
shrineFlame.position.set(15, 1.12, -4.1); shrineFlame.scale.y = 1.8; scene.add(shrineFlame); shrineFlame.visible = false;
const shrineLight = new THREE.PointLight("#ffb466", 0, 8, 2); shrineLight.position.set(15, 1.6, -3.6); scene.add(shrineLight);
let candleUntil = 0;
// 칠성 (북두칠성) 별빛
const sevenStars = new THREE.Group(); scene.add(sevenStars);
[[0, 0], [2, .4], [4, .5], [6, 0], [7, -1.6], [9.4, -1.3], [9.8, .6]].forEach(([x, y]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), new THREE.MeshBasicMaterial({ color: "#fff3c8", fog: false })); s.position.set(20 + x, 22 + y, -40); sevenStars.add(s); });

/* 공양간 (서쪽) */
const KITCHEN = { x: -15, z: -7, w: 7, d: 5, h: 3 };
hall({ ...KITCHEN, sign: "供養間" }); block(-19, -11, -10, -4.2);
box(4, .15, 1.2, mat.wood, -15, .8, -2.8); [[-16.8, -3.2], [-13.2, -3.2], [-16.8, -2.4], [-13.2, -2.4]].forEach(([x, z]) => box(.12, .8, .12, mat.wood, x, .4, z));
block(-17.1, -12.9, -3.5, -2.1);
const bowl = new THREE.Group(); bowl.position.set(-15.6, .9, -2.8); scene.add(bowl); bowl.visible = false;
{ const b = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M("#7a5a40")); b.rotation.x = Math.PI; b.position.y = .28; bowl.add(b);
  const food = new THREE.Mesh(new THREE.CircleGeometry(.26, 16), M("#c98a3a")); food.rotation.x = -Math.PI / 2; food.position.y = .27; bowl.add(food); bowl.userData.food = food; }
const tea = new THREE.Group(); tea.position.set(-14.3, .9, -2.8); scene.add(tea); tea.visible = false;
cyl(.15, .11, .2, M("#e8e2d4"), 0, .1, 0, 12, tea);
const steam = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 4), new THREE.MeshBasicMaterial({ color: "#eee", transparent: true, opacity: 0 })); s.userData.t = i / 6; tea.add(s); steam.push(s); }
let teaUntil = 0;
const kitchenLight = new THREE.PointLight("#ffb466", 6, 9, 2); kitchenLight.position.set(-15, 2.2, -3); scene.add(kitchenLight);

/* 산책길 (남쪽 숲) + 계곡 */
for (let z = 12; z < 44; z += 2.4) for (const side of [-1, 1]) {
  const x = side * rand(4, 8) + Math.sin(z * .15) * 1.5;
  const t = new THREE.Group(); t.position.set(x, 0, z + rand(-.6, .6)); scene.add(t);
  cyl(.18, .25, 2, mat.trunk, 0, 1, 0, 6, t);
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 7), mat.leaf2); c1.position.y = 3; t.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 7), mat.leaf); c2.position.y = 4.4; t.add(c2);
  const s = rand(.8, 1.3); t.scale.set(s, s, s); block(x - .4, x + .4, z - .4, z + .4);
}
const stream = new THREE.Mesh(new THREE.PlaneGeometry(3, 40), mat.water); stream.rotation.x = -Math.PI / 2; stream.position.set(11, .05, 26); scene.add(stream);
for (let i = 0; i < 18; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(.3, .7)), mat.stone); r.position.set(11 + rand(-2.2, 2.2), .1, rand(7, 45)); scene.add(r); }
// 마당 둘레 나무와 석등
[[-12, 6], [12, 6], [-10, -12], [10, -12], [-13, 1], [13, 1]].forEach(([x, z]) => {
  const t = new THREE.Group(); t.position.set(x, 0, z); scene.add(t); cyl(.22, .3, 2.4, mat.trunk, 0, 1.2, 0, 6, t);
  const c = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), mat.leaf); c.position.y = 3.4; t.add(c); block(x - .4, x + .4, z - .4, z + .4); });
[[-4, 4.5], [4, 4.5]].forEach(([x, z]) => { box(.5, 1, .5, mat.stone, x, .5, z); box(.7, .5, .7, mat.stone, x, 1.25, z); const l = new THREE.Mesh(new THREE.SphereGeometry(.15, 8, 6), mat.flame); l.position.set(x, 1.25, z + .36); scene.add(l); block(x - .4, x + .4, z - .4, z + .4); });
// 범종각 (서남쪽)
{ const g = new THREE.Group(); g.position.set(-9, 0, 7); scene.add(g);
  [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([x, z]) => cyl(.15, .18, 3.2, mat.pillar, x, 1.6, z, 8, g));
  const r = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 4), mat.roofTile); r.rotation.y = Math.PI / 4; r.position.y = 3.9; g.add(r);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(.55, .8, 1.5, 16), M("#5a5a4a", { metalness: .7, roughness: .4 })); bell.position.y = 2.2; g.add(bell);
  block(-10.6, -7.4, 5.4, 8.6); }

/* 연등 줄 (소원) */
const lanternGroup = new THREE.Group(); scene.add(lanternGroup);
const lanternSlots = [];
for (let row = 0; row < 3; row++) for (let i = 0; i < 14; i++) lanternSlots.push(new THREE.Vector3(-9.1 + i * 1.4, 4.2 - Math.sin((i / 13) * Math.PI) * .6, -8 + row * 5));
for (let row = 0; row < 3; row++) {
  const pts = []; for (let i = 0; i < 14; i++) { const p = lanternSlots[row * 14 + i]; pts.push(p.x, p.y + .45, p.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#6b5a48" })));
}
const lanternColors = ["#f2a65a", "#e86a5a", "#f2d05a", "#7fc7a0", "#d98ac9", "#7fb0e6"];
function renderLanterns(list) {
  lanternGroup.clear();
  list.slice(0, lanternSlots.length).forEach((w, i) => {
    const color = lanternColors[i % lanternColors.length];
    const m = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .9 }));
    m.scale.y = 1.2; m.position.copy(lanternSlots[i]); m.userData.wish = w; lanternGroup.add(m);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .3, 4), new THREE.MeshBasicMaterial({ color })); tassel.position.y = -.5; m.add(tassel);
  });
}

/* =========================================================
   동자승
   ========================================================= */
function textSprite(text, { size = 40, color = "#ece6d8", bg = "rgba(16,21,29,.7)", pad = 14 } = {}) {
  const c = document.createElement("canvas"), x = c.getContext("2d");
  const font = `${size}px "Gowun Dodum","Apple SD Gothic Neo",sans-serif`;
  x.font = font; const w = Math.ceil(x.measureText(text).width) + pad * 2, h = size + pad * 1.4;
  c.width = w; c.height = h; x.font = font;
  x.fillStyle = bg; const r = h / 2; x.beginPath(); x.roundRect ? x.roundRect(0, 0, w, h, r) : x.rect(0, 0, w, h); x.fill();
  x.fillStyle = color; x.textBaseline = "middle"; x.textAlign = "center"; x.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(w / 110, h / 110, 1); s.renderOrder = 10; return s;
}
function makeMonk(nick, isMe) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(.34, .5, .85, 16), mat.robe); robe.position.y = .62; body.add(robe);
  const sash = new THREE.Mesh(new THREE.BoxGeometry(.2, .95, .06), mat.sash); sash.position.set(.08, .66, .4); sash.rotation.z = -.55; body.add(sash);
  const sashBack = sash.clone(); sashBack.position.z = -.4; body.add(sashBack);
  [-.15, .15].forEach((x) => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .3, 8), mat.robe); leg.position.set(x, .15, 0); body.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), M("#efe8d8")); shoe.scale.set(1, .6, 1.4); shoe.position.set(x, .04, .05); body.add(shoe); });
  const head = new THREE.Group(); head.position.y = 1.38; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.46, 24, 18), mat.skin); skull.scale.set(1, .95, .95); head.add(skull);
  [-.15, .15].forEach((x) => { const e = new THREE.Mesh(new THREE.TorusGeometry(.055, .015, 6, 12, Math.PI), mat.eye); e.position.set(x, .02, .42); head.add(e);
    const ch = new THREE.Mesh(new THREE.CircleGeometry(.06, 12), new THREE.MeshBasicMaterial({ color: "#e0866a", transparent: true, opacity: .55 })); ch.position.set(x * 1.45, -.09, .425); head.add(ch); });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.05, .012, 6, 12, Math.PI), mat.eye); mouth.rotation.z = Math.PI; mouth.position.set(0, -.13, .43); head.add(mouth);
  const hands = new THREE.Group(); body.add(hands);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mat.skin), handR = handL.clone();
  hands.add(handL, handR); handL.position.set(-.42, .62, .08); handR.position.set(.42, .62, .08);
  const label = textSprite(nick || "스님", { color: isMe ? "#f2a65a" : "#ece6d8" }); label.position.y = 2.15; root.add(label);
  scene.add(root);
  return { root, body, head, hands, handL, handR, label, nick, pos: new THREE.Vector3(), target: new THREE.Vector3(), yaw: 0, anim: null, animT: 0, moving: false, bubble: null, bubbleUntil: 0 };
}
function setLabel(m, nick, isMe) { if (m.nick === nick) return; m.root.remove(m.label); m.label.material.map.dispose(); m.label = textSprite(nick || "스님", { color: isMe ? "#f2a65a" : "#ece6d8" }); m.label.position.y = 2.15; m.root.add(m.label); m.nick = nick; }
function bubble(m, text) { if (m.bubble) { m.root.remove(m.bubble); m.bubble.material.map.dispose(); } m.bubble = textSprite(text, { size: 36, color: "#2a1a0c", bg: "rgba(243,238,227,.95)", pad: 12 }); m.bubble.position.y = 2.75; m.root.add(m.bubble); m.bubbleUntil = performance.now() + 2200; }
function playAnim(m, name) { m.anim = name; m.animT = 0; }
function animateMonk(m, dt, now) {
  // 걷기
  const step = m.moving ? Math.abs(Math.sin(now * .012)) * .06 : 0;
  m.body.position.y = step;
  const fy = floorY(m.pos.x, m.pos.z); m.y = (m.y ?? fy) + (fy - (m.y ?? fy)) * Math.min(1, dt * 12);
  m.root.position.set(m.pos.x, m.y, m.pos.z);
  let curYaw = m.root.rotation.y, d = m.yaw - curYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.root.rotation.y = curYaw + d * Math.min(1, dt * 10);
  // 동작
  let bowX = 0, handsUp = 0;
  if (m.anim) {
    m.animT += dt;
    if (m.anim === "bow") { const p = m.animT / 1.6; bowX = Math.sin(Math.min(p, 1) * Math.PI) * 1.05; handsUp = 1; if (p >= 1) m.anim = null; }
    else if (m.anim === "greet") { const p = m.animT / 1.4; handsUp = 1; bowX = Math.sin(Math.min(p, 1) * Math.PI) * .35; if (p >= 1) m.anim = null; }
    else if (m.anim === "mok") { const p = m.animT / .35; handsUp = .6; m.head.rotation.x = Math.sin(Math.min(p, 1) * Math.PI) * .15; if (p >= 1) { m.anim = null; m.head.rotation.x = 0; } }
    else if (m.anim === "pray") { const p = m.animT / 3; handsUp = 1; bowX = .2; if (p >= 1) m.anim = null; }
  }
  m.body.rotation.x = bowX;
  m.body.position.z = Math.sin(bowX) * .25;
  m.handL.position.set(-.42 + handsUp * .36, .62 + handsUp * .38, .08 + handsUp * .32);
  m.handR.position.set(.42 - handsUp * .36, .62 + handsUp * .38, .08 + handsUp * .32);
  if (m.bubble && now > m.bubbleUntil) { m.root.remove(m.bubble); m.bubble.material.map.dispose(); m.bubble = null; }
}

/* =========================================================
   나 (플레이어)
   ========================================================= */
let player;
const SPAWN = new THREE.Vector3(0, 0, 9);
function blocked(x, z) {
  if (Math.abs(x) > 40 || z < -26 || z > 46) return true;
  for (const b of blockers) if (x > b.x1 - .3 && x < b.x2 + .3 && z > b.z1 - .3 && z < b.z2 + .3) return true;
  return false;
}
function floorY(x, z) { return (x > -8.5 && x < 8.5 && z > -24.5 && z < -13.5) ? .55 : 0; }
function zoneOf(x, z) {
  if (z < -13.5 && Math.abs(x) < 9) return "hall";
  if (x > 10.5 && z < -1) return "shrine";
  if (x < -10.5 && z < -1) return "kitchen";
  if (z > 11) return "walk";
  if (Math.hypot(x - PAGODA.x, z - PAGODA.z) < 6) return "pagoda";
  return "yard";
}
const ZONES = {
  yard: { name: "마당", intro: "마당에 들어왔어요. 가고 싶은 곳을 눌러 걸어가 보세요." },
  hall: { name: "대웅전", intro: "부처님 앞이에요. 목탁을 치고 절을 올려 보세요." },
  pagoda: { name: "석탑", intro: "석탑을 천천히 돌며 소원을 떠올려 보세요." },
  shrine: { name: "산신각·칠성각", intro: "산신께는 산의 기운을, 칠성께는 별의 기운을 빌어요." },
  kitchen: { name: "공양간", intro: "오늘의 공양을 골라 보세요. 차도 한 잔 있어요." },
  walk: { name: "산책길", intro: "물소리 들리는 숲길이에요. 천천히 걸어 보세요." }
};
const GOTO = { hall: [0, -16.5], pagoda: [0, 3.2], shrine: [15, -2.6], kitchen: [-15, -1.2], walk: [0, 16], yard: [0, 8] };

/* =========================================================
   카메라 조작
   ========================================================= */
let camYaw = 0, camPitch = .42, camDist = 7.5;
const pointers = new Map(); let downAt = null, pinchStart = 0, distStart = camDist;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 1) downAt = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); distStart = camDist; downAt = null; } });
canvas.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); camDist = clamp(distStart * pinchStart / Math.max(d, 1), 3, 16); return; }
  if (downAt) downAt.moved += Math.abs(dx) + Math.abs(dy);
  camYaw -= dx * .006; camPitch = clamp(camPitch + dy * .004, .12, 1.2);
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (downAt && downAt.moved < 10 && performance.now() - downAt.t < 450) tap(e.clientX, e.clientY);
  downAt = null;
};
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); downAt = null; });
canvas.addEventListener("wheel", (e) => { e.preventDefault(); camDist = clamp(camDist + e.deltaY * .01, 3, 16); }, { passive: false });
window.addEventListener("keydown", (e) => {
  if (!player || e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase(), f = 2.5;
  const fw = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), rt = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  let v = null;
  if (k === "w" || k === "arrowup") v = fw; if (k === "s" || k === "arrowdown") v = fw.clone().negate();
  if (k === "a" || k === "arrowleft") v = rt.clone().negate(); if (k === "d" || k === "arrowright") v = rt;
  if (v) { player.target.copy(player.pos).addScaledVector(v, f); autoPath = null; }
});
function tap(cx, cy) {
  const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hitL = raycaster.intersectObjects(lanternGroup.children, false)[0];
  if (hitL) { const w = hitL.object.userData.wish; toast(`🏮 ${w.text}${w.nick ? " · " + w.nick : ""}`); return; }
  const hitM = raycaster.intersectObjects([...others.values()].map((o) => o.monk.root), true)[0];
  if (hitM) { for (const [key, o] of others) { let n = hitM.object; while (n && n !== o.monk.root) n = n.parent; if (n) { greet(key); return; } } }
  const hit = raycaster.intersectObject(ground)[0];
  if (hit) { player.target.set(hit.point.x, 0, hit.point.z); autoPath = null; }
}

/* =========================================================
   행동 버튼
   ========================================================= */
let autoPath = null; // [{x,z}] 자동 걷기 (탑돌이 등)
let zone = "yard";
const MEALS = [["비빔밥", "#c98a3a"], ["산채나물", "#6f8f4a"], ["연근조림", "#8a5a3a"], ["두부조림", "#e8dcc0"]];
let mealIdx = 0;
const A = (icon, label, fn, hot) => ({ icon, label, fn, hot });
function actionsFor(z) {
  const greetA = A("🙏", "합장", () => greet(null)), beadA = A("📿", "염주", openBeads), wishA = A("🏮", "소원 연등", () => openPanel("wishPanel"));
  if (z === "hall") return [A("🪵", "목탁", doMok, true), A("🙇", "절하기", doBow, true), A("🕯️", "향 피우기", doIncense), greetA, beadA];
  if (z === "pagoda") return [A("🗼", "탑돌이", doTapdori, true), wishA, greetA, beadA];
  if (z === "shrine") return [A("⛰️", "산신 기도", () => doPray("산신"), true), A("✨", "칠성 기도", () => doPray("칠성"), true), A("🕯️", "초 켜기", doCandle), greetA];
  if (z === "kitchen") return [A("🍚", "공양하기", doMeal, true), A("🍵", "차 마시기", doTea, true), greetA, beadA];
  if (z === "walk") return [A("🌊", "계곡 소리", doNature, true), greetA, beadA, wishA];
  return [A("🔔", "범종 치기", doBell), greetA, wishA, beadA];
}
function renderActions() {
  const box = $("actions"); box.innerHTML = "";
  for (const a of actionsFor(zone)) { const b = document.createElement("button"); b.type = "button"; b.className = "act" + (a.hot ? " hot" : ""); b.innerHTML = `<i>${a.icon}</i>`; b.append(a.label); b.onclick = () => { ac(); a.fn(); }; box.appendChild(b); }
  $("placeTag").textContent = ZONES[zone].name;
  document.querySelectorAll("#places button").forEach((b) => b.classList.toggle("here", b.dataset.z === zone));
}
const placeNames = { hall: "대웅전", pagoda: "석탑", shrine: "산신각", kitchen: "공양간", walk: "산책길" };
for (const [z, n] of Object.entries(placeNames)) {
  const b = document.createElement("button"); b.type = "button"; b.dataset.z = z; b.textContent = n;
  b.onclick = () => { const [x, zz] = GOTO[z]; player.pos.set(x, 0, zz); player.target.set(x, 0, zz); autoPath = null; camYaw = z === "walk" ? Math.PI : 0; lastMoveTx = 0; sendPresence(); };
  $("places").appendChild(b);
}

function act(name, extra = {}) { sendPresence({ act: name, ...extra }); }
function doMok() { sfx.mok(); playAnim(player, "mok"); me.mok++; save(); if (me.mok % 10 === 0) say(); bubble(player, `똑 · ${me.mok}`); act("mok"); }
function doBow() {
  if (player.anim === "bow") return;
  sfx.soft(); playAnim(player, "bow"); me.bow++; save(); act("bow");
  bubble(player, `${me.bow}배`);
  if (me.bow === 108) { say("오늘 108배를 모두 마쳤어요. 정말 수고했어요."); sfx.bell(); } else if (me.bow % 12 === 0) say();
}
function doIncense() { incenseUntil = Date.now() + 90000; act("incense"); say("향 연기가 천천히 피어올라요."); }
function doBell() { const bx = -9, bz = 7; if (player.pos.distanceTo(new THREE.Vector3(bx, 0, bz)) > 5) { player.target.set(bx + 2.4, 0, bz); } sfx.bell(); act("bell"); say(); bubble(player, "데엥…"); }
function doTapdori() {
  if (autoPath) return; const pts = []; const r = 3.4; const start = Math.atan2(player.pos.x - PAGODA.x, player.pos.z - PAGODA.z);
  for (let i = 0; i <= 36; i++) { const a = start + (i / 36) * Math.PI * 2; pts.push({ x: PAGODA.x + Math.sin(a) * r, z: PAGODA.z + Math.cos(a) * r }); }
  autoPath = { pts, i: 0, done() { me.tap++; save(); bubble(player, `탑돌이 ${me.tap}바퀴`); act("tap"); if (me.tap % 3 === 0) say(); } };
  say("시계 방향으로 천천히 탑을 돌아요.");
}
function doPray(kind) { playAnim(player, "pray"); me.pray++; save(); sfx.soft(); act("pray", { what: kind });
  say(kind === "산신" ? "산의 기운이 가족을 지켜 주길 빌었어요." : "별빛 아래 모두 건강하고 오래오래 행복하길 빌었어요.");
  if (kind === "칠성") { sevenStars.userData.glowUntil = Date.now() + 6000; } }
function doCandle() { candleUntil = Date.now() + 120000; act("candle"); bubble(player, "초를 밝혔어요"); }
function doMeal() { const [name, color] = MEALS[mealIdx++ % MEALS.length]; bowl.visible = true; bowl.userData.food.material.color.set(color); bubble(player, name); act("meal", { what: name }); say("공양은 감사한 마음으로, 천천히 남김없이."); }
function doTea() { tea.visible = true; teaUntil = Date.now() + 60000; act("tea"); say("따뜻한 차 한 모금에 숨을 골라 보세요."); bubble(player, "후―"); }
function doNature() { vol.water = .7; vol.bird = .6; vol.wind = .35; $("vWater").value = 70; $("vBird").value = 60; $("vWind").value = 35; noiseLoop("water"); noiseLoop("wind"); say("물소리와 새소리를 들으며 천천히 걸어 보세요."); }
function greet(toKey) {
  playAnim(player, "greet"); tone(660, .8, .07 * vol.fx); act("greet", { to: toKey || null });
  const o = toKey && others.get(toKey); bubble(player, o ? `${o.nick}님께 합장` : "🙏 합장");
}

/* =========================================================
   패널: 염주 · 소원 · 법당 · 소리
   ========================================================= */
function openPanel(id) { $(id).hidden = false; if (id === "soundPanel") renderStats(); }
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { b.closest(".panel,.beads-screen").hidden = true; }));
document.querySelectorAll(".panel").forEach((p) => p.addEventListener("click", (e) => { if (e.target === p) p.hidden = true; }));
$("soundBtn").onclick = () => { ac(); noiseLoop("wind"); noiseLoop("water"); openPanel("soundPanel"); };
function renderStats() { $("stats").innerHTML = ""; [["오늘 목탁", me.mok], ["오늘 108배", me.bow], ["탑돌이", me.tap]].forEach(([k, v]) => { const d = document.createElement("div"); d.innerHTML = `<small>${k}</small><b>${v}</b>`; $("stats").appendChild(d); }); }

const BEADS = 27; let beadOffset = 0;
function drawBeads() {
  const ring = $("beadRing"); ring.innerHTML = "";
  for (let i = 0; i < BEADS; i++) {
    const a = ((i + beadOffset) / BEADS) * Math.PI * 2 - Math.PI / 2;
    const b = document.createElement("span"); b.className = "bead" + (i === 0 ? " head" : "");
    b.style.left = `${50 + Math.cos(a) * 40}%`; b.style.top = `${50 + Math.sin(a) * 40}%`; ring.appendChild(b);
  }
  const n = me.bead % 108; $("beadNum").textContent = n === 0 && me.bead > 0 ? 108 : n;
  const round = Math.floor((me.bead - 1) / 108) + 1; $("beadRound").textContent = me.bead === 0 ? "첫 번째 바퀴" : `${["첫", "두", "세", "네", "다섯"][round - 1] || round} 번째 바퀴`;
}
function openBeads() { $("beadPanel").hidden = false; drawBeads(); }
function nextBead() { me.bead++; beadOffset++; save(); sfx.bead(); drawBeads(); if (navigator.vibrate) navigator.vibrate(8); if (me.bead % 108 === 0) { sfx.soft(); say("염주 한 바퀴, 108번의 마음을 모았어요."); } }
$("beadRing").addEventListener("click", nextBead);
$("beadRing").addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); nextBead(); } });

/* 소원 연등 */
let wishes = [];
function renderWishList() {
  const ul = $("wishList"); ul.innerHTML = "";
  if (!wishes.length) { const li = document.createElement("li"); li.textContent = "아직 걸린 연등이 없어요. 첫 소원을 달아 보세요."; ul.appendChild(li); }
  wishes.slice(0, 50).forEach((w) => { const li = document.createElement("li"); li.textContent = w.text; if (w.nick) { const s = document.createElement("small"); s.textContent = w.nick; li.appendChild(s); } ul.appendChild(li); });
  renderLanterns(wishes);
}
const BANNED = ["시발", "씨발", "병신", "좆", "개새"];
$("wishBtn").addEventListener("click", async () => {
  const text = $("wishInput").value.trim().slice(0, 40); if (!text) return;
  if (BANNED.some((b) => text.includes(b))) { $("wishNote").textContent = "고운 말로 적어 주세요."; return; }
  $("wishInput").value = ""; sfx.soft();
  const w = { text, nick: me.nick.slice(0, 8) };
  if (sb) {
    const { error } = await sb.from("wishes").insert(w);
    if (error) { $("wishNote").textContent = "연등을 걸지 못했어요. 잠시 뒤 다시 시도해 주세요."; return; }
    $("wishNote").textContent = "연등을 달았어요. 모두에게 보여요.";
  } else { me.localWishes.unshift(w); me.localWishes = me.localWishes.slice(0, 40); save(); wishes = me.localWishes; renderWishList(); }
});
$("wishInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("wishBtn").click(); });

/* =========================================================
   실시간 (Supabase)
   ========================================================= */
let sb = null, lobby = null, roomCh = null, roomNo = 1, roomJoinedAt = 0;
const others = new Map(); // key -> {monk, nick, seenAt}
const roomCounts = {};
const ACT = { mok: "목탁을 쳤어요", greet: "합장했어요", bow: "절을 올렸어요", incense: "향을 피웠어요", candle: "초를 밝혔어요", pray: "기도를 올렸어요", tap: "탑을 한 바퀴 돌았어요", meal: "공양을 해요", tea: "차를 마셔요", bell: "범종을 울렸어요" };
const online = () => !!sb;

/* 신호 아끼기: 접속 명단(presence)은 들어올 때와 30초마다 한 번만,
   걷기는 목적지가 바뀔 때만, 동작은 그때그때 짧은 메시지(broadcast)로 보내요. */
let lastMoveTx = 0, lastTarget = { x: 1e9, z: 1e9 }, presence = {};
const posPayload = () => ({ k: myKey, x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), tx: +player.target.x.toFixed(2), tz: +player.target.z.toFixed(2) });
function trackMe() { if (roomCh && player) roomCh.track({ nick: me.nick.slice(0, 8), ...posPayload(), at: Date.now() }).catch(() => {}); }
setInterval(trackMe, 30000);
function sendPresence(patch = {}) {
  if (!roomCh || !player) return;
  if (patch.act) { roomCh.send({ type: "broadcast", event: "act", payload: { k: myKey, nick: me.nick.slice(0, 8), act: patch.act, to: patch.to || null, what: patch.what || null, ...posPayload() } }).catch(() => {}); return; }
  const now = Date.now(), t = player.target;
  if (Math.hypot(t.x - lastTarget.x, t.z - lastTarget.z) < .4 || now - lastMoveTx < 450) return;
  lastMoveTx = now; lastTarget = { x: t.x, z: t.z };
  roomCh.send({ type: "broadcast", event: "move", payload: posPayload() }).catch(() => {});
}
function ensureOther(key, p) {
  let o = others.get(key);
  const nick = String(p.nick || o?.nick || "스님").slice(0, 8);
  if (!o) { o = { monk: makeMonk(nick, false), nick }; o.monk.pos.set(clamp(+p.x || 0, -40, 40), 0, clamp(+p.z || 0, -26, 46)); o.monk.target.copy(o.monk.pos); others.set(key, o); }
  if (p.nick) { setLabel(o.monk, nick, false); o.nick = nick; }
  return o;
}
function applyMove(o, p) {
  const x = clamp(+p.x || 0, -40, 40), z = clamp(+p.z || 0, -26, 46);
  if (Math.hypot(o.monk.pos.x - x, o.monk.pos.z - z) > 6) o.monk.pos.set(x, 0, z);
  o.monk.target.set(clamp(+p.tx || x, -40, 40), 0, clamp(+p.tz || z, -26, 46));
}
function onRoomSync() {
  const state = roomCh.presenceState(); const keys = new Set();
  for (const [key, metas] of Object.entries(state)) {
    if (key === myKey) continue; const p = metas[metas.length - 1]; if (!p) continue; keys.add(key);
    const isNew = !others.has(key); const o = ensureOther(key, p); if (isNew) applyMove(o, p);
  }
  for (const [key, o] of others) if (!keys.has(key)) { scene.remove(o.monk.root); others.delete(key); }
  $("peopleCount").textContent = others.size + 1;
}
function onAct({ payload: p }) {
  if (!p || typeof p.k !== "string" || p.k === myKey || !ACT[p.act]) return;
  const key = p.k, o = ensureOther(key, p); applyMove(o, p); const nick = o.nick;
  if (p.act === "bow") playAnim(o.monk, "bow");
  if (p.act === "greet") { playAnim(o.monk, "greet"); bubble(o.monk, "🙏"); }
  if (p.act === "pray") playAnim(o.monk, "pray");
  if (p.act === "incense") incenseUntil = Math.max(incenseUntil, Date.now() + 60000);
  if (p.act === "candle") candleUntil = Math.max(candleUntil, Date.now() + 90000);
  const near = player && o.monk.pos.distanceTo(player.pos) < 14;
  if (p.act === "greet" && p.to === myKey) toast(`${nick}님이 나에게 합장했어요 🙏`, { label: "맞합장", fn: () => greet(key) });
  else if (near && p.act === "greet") toast(`${nick}님이 합장했어요`, { label: "맞합장", fn: () => greet(key) });
  else if (near && p.act !== "bow" && p.act !== "mok") toast(`${nick}님이 ${ACT[p.act]}`);
}

async function joinRoom(n) {
  if (roomCh) { await sb.removeChannel(roomCh); roomCh = null; }
  for (const [, o] of others) scene.remove(o.monk.root); others.clear();
  roomNo = n; roomJoinedAt = Date.now(); $("roomLabel").textContent = `${CONFIG.roomName} ${n}`;
  roomCh = sb.channel(`sansa-room-${n}`, { config: { presence: { key: myKey }, broadcast: { self: false } } });
  roomCh.on("presence", { event: "sync" }, onRoomSync)
    .on("presence", { event: "join" }, ({ key, newPresences }) => { if (Date.now() - roomJoinedAt > 3000 && key !== myKey && !others.has(key)) { const nm = String(newPresences?.[0]?.nick || "스님").slice(0, 8); toast(`${nm}님이 들어왔어요`); } })
    .on("broadcast", { event: "move" }, ({ payload: p }) => { if (!p || typeof p.k !== "string" || p.k === myKey) return; applyMove(ensureOther(p.k, p), p); })
    .on("broadcast", { event: "act" }, onAct);
  roomCh.subscribe((s) => { if (s === "SUBSCRIBED") { trackMe(); lobby && lobby.track({ room: n }).catch(() => {}); } });
}

function countRooms() { if (!lobby) return; const st = lobby.presenceState(); for (let i = 1; i <= CONFIG.roomCount; i++) roomCounts[i] = 0; for (const metas of Object.values(st)) { const r = metas[metas.length - 1]?.room; if (roomCounts[r] !== undefined) roomCounts[r]++; } }
function pickRoom() { countRooms(); for (let i = 1; i <= CONFIG.roomCount; i++) if ((roomCounts[i] || 0) < CONFIG.roomCap) return i; return CONFIG.roomCount; }

async function connect() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) { solo(); return; }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { realtime: { params: { eventsPerSecond: 5 } } });
  } catch { solo(); return; }
  lobby = sb.channel("sansa-lobby", { config: { presence: { key: myKey } } });
  let started = false;
  const start = () => { if (started) return; started = true; joinRoom(pickRoom()); };
  lobby.on("presence", { event: "sync" }, () => { countRooms(); if (!$("roomPanel").hidden) renderRooms(); start(); });
  lobby.subscribe((s) => { if (s === "SUBSCRIBED") setTimeout(start, 1200); if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") { if (!started) solo("연결이 불안정해 혼자 수행 모드로 열었어요."); } });
  // 소원 연등
  const { data } = await sb.from("wishes").select("text,nick,created_at").order("created_at", { ascending: false }).limit(42);
  wishes = data || []; renderWishList();
  sb.channel("sansa-wishes").on("postgres_changes", { event: "INSERT", schema: "public", table: "wishes" }, ({ new: w }) => {
    wishes.unshift({ text: String(w.text || "").slice(0, 40), nick: String(w.nick || "").slice(0, 8) }); wishes = wishes.slice(0, 42); renderWishList();
    if (w.nick !== me.nick) toast(`🏮 새 연등: ${String(w.text).slice(0, 20)}`);
  }).subscribe();
}
function solo(msg) {
  sb = null; $("roomLabel").textContent = "혼자 수행 중"; $("peopleCount").textContent = "1";
  $("wishNote").textContent = "지금은 연등이 이 기기에만 저장돼요.";
  wishes = me.localWishes; renderWishList(); if (msg) toast(msg);
}
function renderRooms() {
  const list = $("roomList"); list.innerHTML = ""; countRooms();
  for (let i = 1; i <= CONFIG.roomCount; i++) {
    const n = roomCounts[i] || 0, full = n >= CONFIG.roomCap;
    const b = document.createElement("button"); b.type = "button"; b.className = i === roomNo ? "cur" : ""; b.disabled = full && i !== roomNo;
    b.innerHTML = `<b>${CONFIG.roomName} ${i}</b><small>${n} / ${CONFIG.roomCap}명${full ? " · 만석" : ""}</small>`;
    b.onclick = () => { $("roomPanel").hidden = true; if (i !== roomNo) joinRoom(i); }; list.appendChild(b);
  }
}
$("roomBtn").onclick = () => { if (!online()) { toast("설정 파일에 Supabase 주소를 넣으면 다른 사람과 함께할 수 있어요."); return; } renderRooms(); openPanel("roomPanel"); };

/* =========================================================
   알림
   ========================================================= */
function toast(text, btn) {
  const t = document.createElement("div"); t.className = "toast" + (btn ? "" : " solo");
  const s = document.createElement("span"); s.textContent = text; t.appendChild(s);
  if (btn) { const b = document.createElement("button"); b.type = "button"; b.textContent = btn.label; b.onclick = () => { ac(); btn.fn(); t.remove(); }; t.appendChild(b); }
  const box = $("toasts"); box.appendChild(t); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => t.remove(), 5100);
}

/* =========================================================
   입장
   ========================================================= */
$("enterBtn").addEventListener("click", enter);
$("nickInput").addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); });
function enter() {
  const nick = $("nickInput").value.trim().slice(0, 8) || ["고요", "청산", "연화", "바람", "달빛", "솔향", "보리"][Math.floor(Math.random() * 7)];
  me.nick = nick; save();
  $("gate").hidden = true; ac(); noiseLoop("wind"); noiseLoop("water");
  player = makeMonk(nick, true); player.pos.copy(SPAWN); player.target.copy(SPAWN); player.yaw = Math.PI;
  zone = zoneOf(player.pos.x, player.pos.z); renderActions(); say(ZONES[zone].intro);
  connect();
}

/* =========================================================
   매 프레임
   ========================================================= */
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener("resize", resize); resize();
const clock = new THREE.Clock(); const camTarget = new THREE.Vector3(); let lastMoveSent = 0;
function moveMonk(m, dt, speed = 3.2) {
  const dx = m.target.x - m.pos.x, dz = m.target.z - m.pos.z, d = Math.hypot(dx, dz);
  if (d > .05) {
    const s = Math.min(d, speed * dt), nx = m.pos.x + (dx / d) * s, nz = m.pos.z + (dz / d) * s;
    if (m === player && blocked(nx, nz)) { m.target.copy(m.pos); m.moving = false; return false; }
    m.pos.x = nx; m.pos.z = nz; m.yaw = Math.atan2(dx, dz); m.moving = true; return true;
  }
  m.moving = false; return false;
}
function tick() {
  const dt = Math.min(clock.getDelta(), .05), now = performance.now(), t = now / 1000;
  if (player) {
    if (autoPath) {
      const p = autoPath.pts[autoPath.i]; player.target.set(p.x, 0, p.z);
      if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < .3) { autoPath.i++; if (autoPath.i >= autoPath.pts.length) { const a = autoPath; autoPath = null; a.done(); } }
    }
    const moved = moveMonk(player, dt, autoPath ? 2 : 3.4);
    if (moved && now - lastMoveSent > 250) { lastMoveSent = now; sendPresence(); }
    animateMonk(player, dt, now);
    const z = zoneOf(player.pos.x, player.pos.z);
    if (z !== zone) { zone = z; renderActions(); say(ZONES[zone].intro); }
    camTarget.lerp(new THREE.Vector3(player.pos.x, 1.2, player.pos.z), Math.min(1, dt * 6));
    const indoor = zone === "hall" ? .7 : 1;
    const dist = camDist * indoor;
    camera.position.set(camTarget.x + Math.sin(camYaw) * Math.cos(camPitch) * dist, camTarget.y + Math.sin(camPitch) * dist, camTarget.z + Math.cos(camYaw) * Math.cos(camPitch) * dist);
    camera.lookAt(camTarget);
  } else {
    camera.position.set(Math.sin(t * .05) * 22, 9, Math.cos(t * .05) * 22 - 4); camera.lookAt(0, 2, -8);
  }
  for (const [, o] of others) { moveMonk(o.monk, dt, 3.6); animateMonk(o.monk, dt, now); }
  // 효과
  const inc = Date.now() < incenseUntil; incense.visible = inc;
  if (inc) smoke.forEach((s) => { s.userData.t = (s.userData.t + dt * .3) % 1; const k = s.userData.t; s.position.set(Math.sin(k * 9) * .1, .6 + k * 1.6, 0); s.scale.setScalar(.6 + k * 1.8); s.material.opacity = Math.sin(k * Math.PI) * .35; });
  candles.forEach((f, i) => { f.scale.x = 1 + Math.sin(t * 13 + i) * .12; });
  hallLight.intensity = 16 + Math.sin(t * 7) * 1.5;
  const cdl = Date.now() < candleUntil; shrineFlame.visible = cdl; shrineLight.intensity = cdl ? 5 + Math.sin(t * 9) : 0;
  const glow = (sevenStars.userData.glowUntil || 0) > Date.now(); sevenStars.children.forEach((s, i) => s.scale.setScalar(glow ? 1.6 + Math.sin(t * 4 + i) * .4 : 1));
  const tv = Date.now() < teaUntil; tea.visible = tv;
  if (tv) steam.forEach((s) => { s.userData.t = (s.userData.t + dt * .4) % 1; const k = s.userData.t; s.position.set(Math.sin(k * 7) * .05, .25 + k * .6, 0); s.material.opacity = Math.sin(k * Math.PI) * .4; });
  lanternGroup.children.forEach((l, i) => { l.rotation.z = Math.sin(t * .8 + i) * .06; });
  stream.material.color.setHSL(.55, .4, .27 + Math.sin(t * 2) * .02);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
renderLanterns(me.localWishes);
requestAnimationFrame(tick);
say("법명을 정하고 산사에 들어가 보세요.");
